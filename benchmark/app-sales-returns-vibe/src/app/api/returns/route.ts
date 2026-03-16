import { NextRequest, NextResponse } from "next/server";
import { getDb, getSystemSetting, getTaxRate } from "@/lib/db";

interface ReturnItem {
  product_id: number;
  quantity: number;
}

/**
 * GET /api/returns
 * List all returns with customer info.
 */
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";

    let query = `
      SELECT
        r.id,
        r.return_number,
        r.shipping_instruction_id,
        r.customer_id,
        r.status,
        r.registered_at,
        c.customer_name,
        si.shipping_instruction_number
      FROM returns r
      JOIN customers c ON r.customer_id = c.id
      JOIN shipping_instructions si ON r.shipping_instruction_id = si.id
    `;

    const params: (string | number)[] = [];

    if (search) {
      query += ` WHERE (r.return_number LIKE ? OR c.customer_name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY r.registered_at DESC, r.id DESC`;

    const rows = db.prepare(query).all(...params);

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/returns
 * Register a return against a shipped shipping instruction.
 * Body: { shipping_instruction_id: number, items: [{ product_id: number, quantity: number }] }
 *
 * Processing:
 *  1. Validate: shipping_instruction must be status=2 (shipped)
 *  2. Validate: each returned quantity <= originally shipped quantity (partial returns OK)
 *  3. Insert return + return_items
 *  4. Restore product_inventory.physical_stock by returned quantity
 *  5. Find the invoice linked to the order of this shipping instruction
 *  6. Auto-generate credit_note with amount = sum(quantity * unit_price) * (1 + tax_rate/100)
 *  7. Reduce customer.outstanding_balance by credit_note amount
 */
export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { shipping_instruction_id, items } = body as {
      shipping_instruction_id: number;
      items: ReturnItem[];
    };

    // Basic validation
    if (!shipping_instruction_id || shipping_instruction_id < 1) {
      return NextResponse.json(
        { success: false, error: "shipping_instruction_id is required." },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one return item is required." },
        { status: 400 }
      );
    }

    for (const item of items) {
      if (!item.product_id || item.product_id < 1) {
        return NextResponse.json(
          { success: false, error: "Each item must have a valid product_id." },
          { status: 400 }
        );
      }
      if (!item.quantity || item.quantity < 1) {
        return NextResponse.json(
          { success: false, error: "Each item quantity must be at least 1." },
          { status: 400 }
        );
      }
    }

    // Fetch the shipping instruction
    const shippingInstruction = db
      .prepare("SELECT * FROM shipping_instructions WHERE id = ?")
      .get(shipping_instruction_id) as {
        id: number;
        order_id: number;
        customer_id: number;
        status: number;
        shipping_instruction_number: string;
      } | undefined;

    if (!shippingInstruction) {
      return NextResponse.json(
        { success: false, error: "Shipping instruction not found." },
        { status: 404 }
      );
    }

    if (shippingInstruction.status !== 2) {
      return NextResponse.json(
        { success: false, error: "Returns can only be registered for shipped instructions (status=2)." },
        { status: 400 }
      );
    }

    // Fetch shipped items to validate quantities
    const shippedItems = db
      .prepare(
        `SELECT sii.product_id, sii.shipped_quantity, oi.unit_price, p.product_name
         FROM shipping_instruction_items sii
         JOIN order_items oi ON sii.order_item_id = oi.id
         JOIN products p ON sii.product_id = p.id
         WHERE sii.shipping_instruction_id = ?`
      )
      .all(shipping_instruction_id) as Array<{
        product_id: number;
        shipped_quantity: number;
        unit_price: number;
        product_name: string;
      }>;

    const shippedMap = new Map<number, { shipped_quantity: number; unit_price: number; product_name: string }>();
    for (const si of shippedItems) {
      shippedMap.set(si.product_id, {
        shipped_quantity: si.shipped_quantity,
        unit_price: si.unit_price,
        product_name: si.product_name,
      });
    }

    // Calculate already-returned quantities for this shipping instruction
    const alreadyReturnedRows = db
      .prepare(
        `SELECT ri.product_id, SUM(ri.quantity) as already_returned
         FROM return_items ri
         JOIN returns r ON ri.return_id = r.id
         WHERE r.shipping_instruction_id = ?
         GROUP BY ri.product_id`
      )
      .all(shipping_instruction_id) as Array<{ product_id: number; already_returned: number }>;

    const alreadyReturnedMap = new Map<number, number>();
    for (const row of alreadyReturnedRows) {
      alreadyReturnedMap.set(row.product_id, row.already_returned);
    }

    // Validate each return item
    for (const item of items) {
      const shipped = shippedMap.get(item.product_id);
      if (!shipped) {
        return NextResponse.json(
          { success: false, error: `Product ID ${item.product_id} was not found in this shipping instruction.` },
          { status: 400 }
        );
      }
      const alreadyReturned = alreadyReturnedMap.get(item.product_id) ?? 0;
      const remainingReturnable = shipped.shipped_quantity - alreadyReturned;
      if (item.quantity > remainingReturnable) {
        return NextResponse.json(
          {
            success: false,
            error: `Product ID ${item.product_id}: return quantity (${item.quantity}) exceeds returnable quantity (${remainingReturnable}).`,
          },
          { status: 400 }
        );
      }
    }

    // Find the invoice linked to the order
    const invoice = db
      .prepare(
        `SELECT i.id, i.invoice_number, i.invoice_amount
         FROM invoices i
         JOIN invoice_items ii ON ii.invoice_id = i.id
         JOIN order_items oi ON ii.order_item_id = oi.id
         WHERE oi.order_id = ?
         LIMIT 1`
      )
      .get(shippingInstruction.order_id) as {
        id: number;
        invoice_number: string;
        invoice_amount: number;
      } | undefined;

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: "No invoice found for the order associated with this shipping instruction. Please issue an invoice first." },
        { status: 400 }
      );
    }

    const taxRate = getTaxRate();
    const returnNumberPrefix = getSystemSetting("return_number_prefix");
    const creditNoteNumberPrefix = getSystemSetting("credit_note_number_prefix");

    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    const today = now.slice(0, 10);

    // Execute in a transaction
    const processReturn = db.transaction(() => {
      // Generate return_number
      const returnCount = (db.prepare("SELECT COUNT(*) as cnt FROM returns").get() as { cnt: number }).cnt;
      const returnNumber = `${returnNumberPrefix}${String(returnCount + 1).padStart(6, "0")}`;

      // Insert return record
      const returnResult = db.prepare(
        `INSERT INTO returns (return_number, shipping_instruction_id, customer_id, status, registered_at)
         VALUES (?, ?, ?, 0, ?)`
      ).run(returnNumber, shipping_instruction_id, shippingInstruction.customer_id, now);

      const returnId = returnResult.lastInsertRowid as number;

      // Insert return items and restore inventory
      let subtotal = 0;

      for (const item of items) {
        const shipped = shippedMap.get(item.product_id)!;
        const unitPrice = shipped.unit_price;

        db.prepare(
          `INSERT INTO return_items (return_id, product_id, quantity, unit_price)
           VALUES (?, ?, ?, ?)`
        ).run(returnId, item.product_id, item.quantity, unitPrice);

        // Restore physical_stock
        db.prepare(
          `UPDATE product_inventory
           SET physical_stock = MIN(physical_stock + ?, 999999)
           WHERE product_id = ?`
        ).run(item.quantity, item.product_id);

        subtotal += item.quantity * unitPrice;
      }

      // Calculate credit note amount (subtotal + tax)
      const taxAmount = Math.floor(subtotal * taxRate / 100);
      const creditAmount = subtotal + taxAmount;

      // Generate credit_note_number
      const cnCount = (db.prepare("SELECT COUNT(*) as cnt FROM credit_notes").get() as { cnt: number }).cnt;
      const creditNoteNumber = `${creditNoteNumberPrefix}${String(cnCount + 1).padStart(6, "0")}`;

      // Insert credit note
      const cnResult = db.prepare(
        `INSERT INTO credit_notes (credit_note_number, return_id, customer_id, invoice_id, credit_amount, status, issue_date, registered_at)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?)`
      ).run(creditNoteNumber, returnId, shippingInstruction.customer_id, invoice.id, creditAmount, today, now);

      const creditNoteId = cnResult.lastInsertRowid as number;

      // Insert credit note items
      for (const item of items) {
        const shipped = shippedMap.get(item.product_id)!;
        db.prepare(
          `INSERT INTO credit_note_items (credit_note_id, product_id, product_name_snapshot, quantity, unit_price)
           VALUES (?, ?, ?, ?, ?)`
        ).run(creditNoteId, item.product_id, shipped.product_name, item.quantity, shipped.unit_price);
      }

      // Reduce customer's outstanding_balance by creditAmount (minimum 0)
      db.prepare(
        `UPDATE customers
         SET outstanding_balance = MAX(0, outstanding_balance - ?)
         WHERE id = ?`
      ).run(creditAmount, shippingInstruction.customer_id);

      return {
        returnId,
        returnNumber,
        creditNoteId,
        creditNoteNumber,
        creditAmount,
      };
    });

    const result = processReturn();

    return NextResponse.json({
      success: true,
      data: {
        return_id: result.returnId,
        return_number: result.returnNumber,
        credit_note_id: result.creditNoteId,
        credit_note_number: result.creditNoteNumber,
        credit_amount: result.creditAmount,
      },
      message: `Return registered. Credit note ${result.creditNoteNumber} (¥${result.creditAmount.toLocaleString()}) has been issued.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
