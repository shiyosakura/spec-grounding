import { NextRequest, NextResponse } from "next/server";
import { getDb, generateNumber, getTaxRate } from "@/lib/db";

// §3-5: Invoice Issuance
export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { billing_period, customer_mode, selected_customer_ids } = body;

    // §2-5 Guard: billing_period required
    if (!billing_period || billing_period.trim() === "") {
      return NextResponse.json(
        { success: false, error: "Please enter the target year and month." },
        { status: 400 }
      );
    }

    const periodMatch = billing_period.match(/^(\d{4})-(\d{2})$/);
    if (!periodMatch) {
      return NextResponse.json(
        { success: false, error: "Please enter the billing period in YYYY-MM format." },
        { status: 400 }
      );
    }

    const year = parseInt(periodMatch[1], 10);
    const month = parseInt(periodMatch[2], 10);

    // Determine target customers
    let targetCustomers: Array<{ id: number; closing_day: number }>;
    if (customer_mode === 1) {
      const validIds = (selected_customer_ids as number[]).filter((id: number) => id >= 1);
      if (validIds.length === 0) {
        return NextResponse.json(
          { success: false, error: "Please select at least one customer." },
          { status: 400 }
        );
      }
      const placeholders = validIds.map(() => "?").join(",");
      targetCustomers = db
        .prepare(`SELECT id, closing_day FROM customers WHERE id IN (${placeholders})`)
        .all(...validIds) as Array<{ id: number; closing_day: number }>;
    } else {
      targetCustomers = db
        .prepare("SELECT id, closing_day FROM customers WHERE id >= 1")
        .all() as Array<{ id: number; closing_day: number }>;
    }

    const taxRate = getTaxRate();
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);

    let totalInvoicesCreated = 0;

    const processAll = db.transaction(() => {
      for (const customer of targetCustomers) {
        // Calculate closing date cutoff
        let closingDate: string;
        if (customer.closing_day === 0) {
          const lastDay = new Date(year, month, 0).getDate();
          closingDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
        } else {
          closingDate = `${year}-${String(month).padStart(2, "0")}-${String(customer.closing_day).padStart(2, "0")}`;
        }

        // Find unbilled order items for shipped orders, with shipment date <= cutoff
        const targetItems = db
          .prepare(
            `SELECT DISTINCT oi.id as order_item_id, oi.order_id, oi.product_id,
                    oi.product_name_snapshot, oi.quantity, oi.unit_price, oi.shipped_quantity
             FROM order_items oi
             JOIN orders o ON oi.order_id = o.id
             WHERE o.customer_id = ?
               AND o.status = 2
               AND oi.id NOT IN (SELECT ii.order_item_id FROM invoice_items ii)
               AND EXISTS (
                 SELECT 1 FROM shipping_instruction_items sii
                 JOIN shipping_records sr ON sr.shipping_instruction_item_id = sii.id
                 WHERE sii.order_item_id = oi.id
                   AND date(sr.shipped_at) <= ?
               )`
          )
          .all(customer.id, closingDate) as Array<{
            order_item_id: number;
            order_id: number;
            product_id: number;
            product_name_snapshot: string;
            quantity: number;
            unit_price: number;
            shipped_quantity: number;
          }>;

        if (targetItems.length === 0) continue;

        // Step 1: Calculate invoice amount
        const subtotal = targetItems.reduce(
          (sum, item) => sum + item.shipped_quantity * item.unit_price,
          0
        );
        const tax = Math.floor(subtotal * taxRate / 100);
        const invoiceAmount = subtotal + tax;

        // Generate invoice number
        const invoiceNumber = generateNumber(
          "invoice_number_prefix",
          "invoices",
          "invoice_number"
        );

        // Create invoice record
        const invoiceResult = db
          .prepare(
            `INSERT INTO invoices (invoice_number, customer_id, billing_period, invoice_amount, status, issue_date, registered_at)
             VALUES (?, ?, ?, ?, 1, ?, ?)`
          )
          .run(invoiceNumber, customer.id, billing_period, invoiceAmount, today, now);

        const invoiceId = invoiceResult.lastInsertRowid as number;

        // Step 2: Create invoice line items
        const insertInvoiceItem = db.prepare(
          `INSERT INTO invoice_items (invoice_id, order_item_id, product_id, product_name_snapshot, quantity, unit_price)
           VALUES (?, ?, ?, ?, ?, ?)`
        );

        for (const item of targetItems) {
          insertInvoiceItem.run(
            invoiceId,
            item.order_item_id,
            item.product_id,
            item.product_name_snapshot,
            item.shipped_quantity,
            item.unit_price
          );
        }

        // Step 3: Update order status to "invoiced" (3) where all order items are now billed
        // Rule 14: invoice_items must be created first (step 2) before checking this condition
        const affectedOrderIds = [...new Set(targetItems.map((item) => item.order_id))];

        for (const orderId of affectedOrderIds) {
          // Check if all order items for this order are now in invoice_items
          const unbilledCount = db
            .prepare(
              `SELECT COUNT(*) as cnt FROM order_items
               WHERE order_id = ? AND id NOT IN (SELECT order_item_id FROM invoice_items)`
            )
            .get(orderId) as { cnt: number };

          if (unbilledCount.cnt === 0) {
            db.prepare("UPDATE orders SET status = 3, updated_at = ? WHERE id = ?").run(
              now,
              orderId
            );
          }
        }

        totalInvoicesCreated++;
      }
    });

    processAll();

    if (totalInvoicesCreated === 0) {
      return NextResponse.json(
        { success: false, error: "There are no order line items to issue." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { invoices_created: totalInvoicesCreated },
      message: `${totalInvoicesCreated} invoice(s) have been issued.`,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to generate invoices" },
      { status: 500 }
    );
  }
}
