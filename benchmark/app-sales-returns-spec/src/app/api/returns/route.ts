import { NextRequest, NextResponse } from "next/server";
import { getDb, getSystemSetting, getTaxRate } from "@/lib/db";

/**
 * POST /api/returns
 * Register a return against a shipped shipping instruction.
 *
 * Spec: §3-14 (Return Registration Process)
 *
 * Request body:
 *   {
 *     shipping_instruction_id: number,
 *     items: Array<{ product_id: number; quantity: number }>
 *   }
 *
 * Response:
 *   { return_id: number, credit_note_invoice_id: number }
 */
export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { shipping_instruction_id, items } = body;

    // --- Basic input validation ---
    if (!shipping_instruction_id || shipping_instruction_id < 1) {
      return NextResponse.json(
        { success: false, error: "Invalid shipping_instruction_id." },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Please enter a return quantity for at least one row." },
        { status: 400 }
      );
    }

    const validItems = items.filter(
      (item: { product_id: number; quantity: number }) => item.quantity >= 1
    );

    if (validItems.length === 0) {
      return NextResponse.json(
        { success: false, error: "Please enter a return quantity for at least one row." },
        { status: 400 }
      );
    }

    // --- §2-12 Guard: shipping instruction must have status = 2 (Shipped) ---
    const shippingInstruction = db
      .prepare("SELECT * FROM shipping_instructions WHERE id = ?")
      .get(shipping_instruction_id) as {
        id: number;
        customer_id: number;
        order_id: number;
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
        {
          success: false,
          error: "Returns can only be registered for shipped shipping instructions.",
        },
        { status: 400 }
      );
    }

    // --- §2-13 Cumulative return quantity check ---
    // For each item in the request, validate that:
    //   already_returned_qty + new_return_qty <= shipped_qty (per shipping instruction line item)
    const errors: string[] = [];

    for (const item of validItems) {
      // Get the shipping instruction line item for this product under this shipping instruction
      const sili = db
        .prepare(
          `SELECT sili.id, sili.shipped_quantity, sili.order_item_id, p.product_name
           FROM shipping_instruction_items sili
           JOIN products p ON sili.product_id = p.id
           WHERE sili.shipping_instruction_id = ? AND sili.product_id = ?`
        )
        .get(shipping_instruction_id, item.product_id) as {
          id: number;
          shipped_quantity: number;
          order_item_id: number;
          product_name: string;
        } | undefined;

      if (!sili) {
        return NextResponse.json(
          {
            success: false,
            error: `Product ID ${item.product_id} is not in this shipping instruction.`,
          },
          { status: 400 }
        );
      }

      // Calculate already returned quantity for this shipping instruction + product
      const alreadyReturned = db
        .prepare(
          `SELECT COALESCE(SUM(ri.quantity), 0) as total
           FROM return_items ri
           JOIN returns r ON ri.return_id = r.id
           WHERE r.shipping_instruction_id = ? AND ri.product_id = ?`
        )
        .get(shipping_instruction_id, item.product_id) as { total: number };

      const maxReturnable = sili.shipped_quantity - alreadyReturned.total;

      if (item.quantity > maxReturnable) {
        const excess = item.quantity - maxReturnable;
        errors.push(
          `Product "${sili.product_name}": return quantity exceeds maximum returnable by ${excess}.`
        );
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { success: false, error: errors.join(" / ") },
        { status: 400 }
      );
    }

    // --- §3-14: Return Registration Process (in strict order) ---
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    const today = now.slice(0, 10);
    const billingPeriod = today.slice(0, 7); // YYYY-MM

    const taxRate = getTaxRate();
    const invoicePrefix = getSystemSetting("invoice_number_prefix");

    const processReturn = db.transaction(() => {
      // Step 1: Create return record
      const returnInsert = db
        .prepare(
          `INSERT INTO returns (shipping_instruction_id, customer_id, credit_note_invoice_id, created_at)
           VALUES (?, ?, 0, ?)`
        )
        .run(shipping_instruction_id, shippingInstruction.customer_id, now);

      const returnId = returnInsert.lastInsertRowid as number;

      // Step 2: Create return items, copying unit_price from order_item
      const insertReturnItem = db.prepare(
        `INSERT INTO return_items (return_id, product_id, quantity, unit_price)
         VALUES (?, ?, ?, ?)`
      );

      for (const item of validItems) {
        // Get unit_price from the order_item linked via shipping_instruction_item
        const sili = db
          .prepare(
            `SELECT sili.order_item_id
             FROM shipping_instruction_items sili
             WHERE sili.shipping_instruction_id = ? AND sili.product_id = ?`
          )
          .get(shipping_instruction_id, item.product_id) as { order_item_id: number };

        const orderItem = db
          .prepare("SELECT unit_price FROM order_items WHERE id = ?")
          .get(sili.order_item_id) as { unit_price: number };

        insertReturnItem.run(returnId, item.product_id, item.quantity, orderItem.unit_price);
      }

      // Step 3: Increase physical_stock for each returned product
      for (const item of validItems) {
        db.prepare(
          `UPDATE product_inventory
           SET physical_stock = MIN(999999, physical_stock + ?)
           WHERE product_id = ?`
        ).run(item.quantity, item.product_id);
      }

      // Step 4: Auto-generate credit note invoice
      // Retrieve return items just inserted (with unit_price)
      const returnItems = db
        .prepare("SELECT * FROM return_items WHERE return_id = ?")
        .all(returnId) as Array<{ product_id: number; quantity: number; unit_price: number }>;

      // Calculate credit note amount (negative)
      let subtotalSum = 0;
      let taxSum = 0;
      for (const ri of returnItems) {
        const lineSubtotal = ri.quantity * ri.unit_price;
        const lineTax = Math.floor((ri.quantity * ri.unit_price * taxRate) / 100);
        subtotalSum += lineSubtotal;
        taxSum += lineTax;
      }
      const creditNoteAmount = -(subtotalSum + taxSum);

      // Generate credit note invoice number: prefix + "CN-" + sequential number
      const cnCount = db
        .prepare("SELECT COUNT(*) as cnt FROM invoices WHERE invoice_number LIKE ?")
        .get(`${invoicePrefix}CN-%`) as { cnt: number };
      const cnSeq = String(cnCount.cnt + 1).padStart(6, "0");
      const creditNoteNumber = `${invoicePrefix}CN-${cnSeq}`;

      const invoiceInsert = db
        .prepare(
          `INSERT INTO invoices (invoice_number, customer_id, billing_period, invoice_amount, status, return_id, issue_date, registered_at)
           VALUES (?, ?, ?, ?, 4, ?, ?, ?)`
        )
        .run(
          creditNoteNumber,
          shippingInstruction.customer_id,
          billingPeriod,
          creditNoteAmount,
          returnId,
          today,
          now
        );

      const creditNoteInvoiceId = invoiceInsert.lastInsertRowid as number;

      // Step 5: Update return.credit_note_invoice_id
      db.prepare(
        "UPDATE returns SET credit_note_invoice_id = ? WHERE id = ?"
      ).run(creditNoteInvoiceId, returnId);

      return { return_id: returnId, credit_note_invoice_id: creditNoteInvoiceId };
    });

    const result = processReturn();

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * GET /api/returns
 * List all returns, optionally filtered by shipping_instruction_id.
 */
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const shippingInstructionId = searchParams.get("shipping_instruction_id");

    let query = `
      SELECT r.*, c.customer_name, si.shipping_instruction_number
      FROM returns r
      JOIN customers c ON r.customer_id = c.id
      JOIN shipping_instructions si ON r.shipping_instruction_id = si.id
    `;
    const params: (string | number)[] = [];

    if (shippingInstructionId) {
      query += " WHERE r.shipping_instruction_id = ?";
      params.push(Number(shippingInstructionId));
    }

    query += " ORDER BY r.created_at DESC";

    const rows = db.prepare(query).all(...params);

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
