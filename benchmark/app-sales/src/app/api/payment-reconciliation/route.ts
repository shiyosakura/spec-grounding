import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// §3-11: Reconciliation Processing
export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { payment_id, reconciliation_entries } = body;

    // reconciliation_entries: Array<{ invoice_id: number; amount: number }>

    if (!payment_id || payment_id < 1) {
      return NextResponse.json(
        { success: false, error: "Please select a payment." },
        { status: 400 }
      );
    }

    if (
      !reconciliation_entries ||
      !Array.isArray(reconciliation_entries) ||
      reconciliation_entries.length === 0
    ) {
      return NextResponse.json(
        { success: false, error: "Please enter at least one reconciliation amount." },
        { status: 400 }
      );
    }

    // Filter to entries with amount >= 1
    const validEntries = reconciliation_entries.filter(
      (e: { invoice_id: number; amount: number }) => e.amount >= 1
    );

    if (validEntries.length === 0) {
      return NextResponse.json(
        { success: false, error: "Please enter at least one reconciliation amount." },
        { status: 400 }
      );
    }

    // Get payment record
    const payment = db
      .prepare("SELECT * FROM payments WHERE id = ?")
      .get(payment_id) as {
        id: number;
        customer_id: number;
        payment_amount: number;
        unreconciled_balance: number;
      } | undefined;

    if (!payment) {
      return NextResponse.json(
        { success: false, error: "Payment not found." },
        { status: 404 }
      );
    }

    // §2-10 Validation: total must not exceed payment's unreconciled balance
    const reconciliationTotal = validEntries.reduce(
      (sum: number, e: { amount: number }) => sum + e.amount,
      0
    );

    if (reconciliationTotal > payment.unreconciled_balance) {
      return NextResponse.json(
        {
          success: false,
          error: `The reconciliation total exceeds the unreconciled balance of the payment (¥${payment.unreconciled_balance.toLocaleString()}).`,
        },
        { status: 400 }
      );
    }

    // §2-10 Validation: each amount must not exceed invoice's unreconciled balance
    for (const entry of validEntries) {
      const invoice = db
        .prepare("SELECT invoice_amount FROM invoices WHERE id = ?")
        .get(entry.invoice_id) as { invoice_amount: number } | undefined;

      if (!invoice) {
        return NextResponse.json(
          { success: false, error: `Invoice not found: ${entry.invoice_id}` },
          { status: 400 }
        );
      }

      const existingReconciled = db
        .prepare(
          "SELECT COALESCE(SUM(reconciled_amount), 0) as total FROM payment_reconciliations WHERE invoice_id = ?"
        )
        .get(entry.invoice_id) as { total: number };

      const invoiceUnreconciled = invoice.invoice_amount - existingReconciled.total;

      if (entry.amount > invoiceUnreconciled) {
        const invNum = db
          .prepare("SELECT invoice_number FROM invoices WHERE id = ?")
          .get(entry.invoice_id) as { invoice_number: string };
        return NextResponse.json(
          {
            success: false,
            error: `The reconciliation amount for Invoice No. ${invNum.invoice_number} exceeds the unreconciled balance.`,
          },
          { status: 400 }
        );
      }
    }

    const now = new Date().toISOString().replace("T", " ").slice(0, 19);

    // Execute reconciliation in strict order per §3-11 / Rule 14
    const processReconciliation = db.transaction(() => {
      // Step 1: Create payment_reconciliation entries
      const insertReconciliation = db.prepare(
        `INSERT INTO payment_reconciliations (payment_id, invoice_id, reconciled_amount, reconciled_at)
         VALUES (?, ?, ?, ?)`
      );

      for (const entry of validEntries) {
        insertReconciliation.run(payment_id, entry.invoice_id, entry.amount, now);
      }

      // Step 2: Update invoice status based on total reconciled amount
      const affectedInvoiceIds = [...new Set(validEntries.map((e: { invoice_id: number }) => e.invoice_id))];

      for (const invoiceId of affectedInvoiceIds) {
        const invoice = db
          .prepare("SELECT invoice_amount FROM invoices WHERE id = ?")
          .get(invoiceId) as { invoice_amount: number };

        const totalReconciled = db
          .prepare(
            "SELECT COALESCE(SUM(reconciled_amount), 0) as total FROM payment_reconciliations WHERE invoice_id = ?"
          )
          .get(invoiceId) as { total: number };

        if (totalReconciled.total >= invoice.invoice_amount) {
          db.prepare("UPDATE invoices SET status = 3 WHERE id = ?").run(invoiceId);
        } else {
          db.prepare("UPDATE invoices SET status = 2 WHERE id = ?").run(invoiceId);
        }
      }

      // Step 3: Update order status to "completed" (4) if all invoice items are fully paid
      // Find orders related to the updated invoices
      const orderIds = db
        .prepare(
          `SELECT DISTINCT oi.order_id
           FROM invoice_items ii
           JOIN order_items oi ON ii.order_item_id = oi.id
           WHERE ii.invoice_id IN (${affectedInvoiceIds.map(() => "?").join(",")})`
        )
        .all(...affectedInvoiceIds) as Array<{ order_id: number }>;

      for (const { order_id } of orderIds) {
        // Check if ALL order items for this order have their corresponding invoice items
        // in invoices with status = 3 (Fully Paid)
        const allPaid = db
          .prepare(
            `SELECT COUNT(*) as unpaid_count FROM order_items oi
             WHERE oi.order_id = ?
               AND NOT EXISTS (
                 SELECT 1 FROM invoice_items ii
                 JOIN invoices inv ON ii.invoice_id = inv.id
                 WHERE ii.order_item_id = oi.id AND inv.status = 3
               )`
          )
          .get(order_id) as { unpaid_count: number };

        if (allPaid.unpaid_count === 0) {
          db.prepare("UPDATE orders SET status = 4, updated_at = ? WHERE id = ?").run(
            now,
            order_id
          );
        }
      }

      // Step 4: Update payment's unreconciled_balance
      const newBalance = Math.max(0, payment.unreconciled_balance - reconciliationTotal);
      db.prepare(
        "UPDATE payments SET unreconciled_balance = ? WHERE id = ?"
      ).run(newBalance, payment_id);

      // Step 5: Update payment's reconciliation_status
      if (newBalance === 0) {
        db.prepare(
          "UPDATE payments SET reconciliation_status = 2 WHERE id = ?"
        ).run(payment_id);
      } else {
        db.prepare(
          "UPDATE payments SET reconciliation_status = 1 WHERE id = ?"
        ).run(payment_id);
      }
    });

    processReconciliation();

    return NextResponse.json({
      success: true,
      data: null,
      message: "Reconciliation has been completed.",
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to process reconciliation" },
      { status: 500 }
    );
  }
}
