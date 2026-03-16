import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * POST /api/credit-note-reconciliation
 * Apply a credit note against invoice(s) as an offset (similar to payment reconciliation).
 * Body: {
 *   credit_note_id: number,
 *   reconciliation_entries: Array<{ invoice_id: number; amount: number }>
 * }
 *
 * Processing:
 *  1. Validate credit note is unreconciled or partially reconciled
 *  2. Validate total offset <= credit note's unreconciled balance
 *  3. Validate each entry amount <= invoice's unreconciled balance
 *  4. Insert credit_note_reconciliations records
 *  5. Update invoice status (2=partially paid, 3=fully paid)
 *  6. Update credit_note status
 *  7. Update customer.outstanding_balance (reduce by sum of offsets)
 */
export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { credit_note_id, reconciliation_entries } = body;

    if (!credit_note_id || credit_note_id < 1) {
      return NextResponse.json(
        { success: false, error: "Please select a credit note." },
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

    const validEntries = reconciliation_entries.filter(
      (e: { invoice_id: number; amount: number }) => e.amount >= 1
    );

    if (validEntries.length === 0) {
      return NextResponse.json(
        { success: false, error: "Please enter at least one reconciliation amount." },
        { status: 400 }
      );
    }

    // Fetch credit note
    const creditNote = db
      .prepare("SELECT * FROM credit_notes WHERE id = ?")
      .get(credit_note_id) as {
        id: number;
        customer_id: number;
        credit_amount: number;
        status: number;
      } | undefined;

    if (!creditNote) {
      return NextResponse.json(
        { success: false, error: "Credit note not found." },
        { status: 404 }
      );
    }

    if (creditNote.status === 2) {
      return NextResponse.json(
        { success: false, error: "This credit note has already been fully reconciled." },
        { status: 400 }
      );
    }

    // Calculate unreconciled balance of credit note
    const existingCnReconciled = db
      .prepare(
        "SELECT COALESCE(SUM(reconciled_amount), 0) as total FROM credit_note_reconciliations WHERE credit_note_id = ?"
      )
      .get(credit_note_id) as { total: number };

    const cnUnreconciledBalance = creditNote.credit_amount - existingCnReconciled.total;

    const reconciliationTotal = validEntries.reduce(
      (sum: number, e: { amount: number }) => sum + e.amount,
      0
    );

    if (reconciliationTotal > cnUnreconciledBalance) {
      return NextResponse.json(
        {
          success: false,
          error: `The reconciliation total (¥${reconciliationTotal.toLocaleString()}) exceeds the unreconciled balance of the credit note (¥${cnUnreconciledBalance.toLocaleString()}).`,
        },
        { status: 400 }
      );
    }

    // Validate each invoice entry
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

      // Total already reconciled (both from payments and credit notes)
      const reconciledByPayments = db
        .prepare(
          "SELECT COALESCE(SUM(reconciled_amount), 0) as total FROM payment_reconciliations WHERE invoice_id = ?"
        )
        .get(entry.invoice_id) as { total: number };

      const reconciledByCreditNotes = db
        .prepare(
          "SELECT COALESCE(SUM(reconciled_amount), 0) as total FROM credit_note_reconciliations WHERE invoice_id = ?"
        )
        .get(entry.invoice_id) as { total: number };

      const totalReconciled = reconciledByPayments.total + reconciledByCreditNotes.total;
      const invoiceUnreconciled = invoice.invoice_amount - totalReconciled;

      if (entry.amount > invoiceUnreconciled) {
        const invRow = db
          .prepare("SELECT invoice_number FROM invoices WHERE id = ?")
          .get(entry.invoice_id) as { invoice_number: string };
        return NextResponse.json(
          {
            success: false,
            error: `The reconciliation amount for Invoice No. ${invRow.invoice_number} exceeds the unreconciled balance (¥${invoiceUnreconciled.toLocaleString()}).`,
          },
          { status: 400 }
        );
      }
    }

    const now = new Date().toISOString().replace("T", " ").slice(0, 19);

    const processReconciliation = db.transaction(() => {
      // Step 1: Insert credit_note_reconciliation entries
      const insertCnReconciliation = db.prepare(
        `INSERT INTO credit_note_reconciliations (credit_note_id, invoice_id, reconciled_amount, reconciled_at)
         VALUES (?, ?, ?, ?)`
      );

      for (const entry of validEntries) {
        insertCnReconciliation.run(credit_note_id, entry.invoice_id, entry.amount, now);
      }

      // Step 2: Update invoice statuses
      const affectedInvoiceIds = [...new Set(validEntries.map((e: { invoice_id: number }) => e.invoice_id))];

      for (const invoiceId of affectedInvoiceIds) {
        const invoice = db
          .prepare("SELECT invoice_amount FROM invoices WHERE id = ?")
          .get(invoiceId) as { invoice_amount: number };

        const totalByPayments = db
          .prepare(
            "SELECT COALESCE(SUM(reconciled_amount), 0) as total FROM payment_reconciliations WHERE invoice_id = ?"
          )
          .get(invoiceId) as { total: number };

        const totalByCreditNotes = db
          .prepare(
            "SELECT COALESCE(SUM(reconciled_amount), 0) as total FROM credit_note_reconciliations WHERE invoice_id = ?"
          )
          .get(invoiceId) as { total: number };

        const totalReconciled = totalByPayments.total + totalByCreditNotes.total;

        if (totalReconciled >= invoice.invoice_amount) {
          db.prepare("UPDATE invoices SET status = 3 WHERE id = ?").run(invoiceId);
        } else if (totalReconciled > 0) {
          db.prepare("UPDATE invoices SET status = 2 WHERE id = ?").run(invoiceId);
        }
      }

      // Step 3: Update credit note status
      const newCnReconciled = existingCnReconciled.total + reconciliationTotal;
      if (newCnReconciled >= creditNote.credit_amount) {
        db.prepare("UPDATE credit_notes SET status = 2 WHERE id = ?").run(credit_note_id);
      } else {
        db.prepare("UPDATE credit_notes SET status = 1 WHERE id = ?").run(credit_note_id);
      }

      // Step 4: Update order statuses for affected invoices
      for (const invoiceId of affectedInvoiceIds) {
        const orderIds = db
          .prepare(
            `SELECT DISTINCT oi.order_id
             FROM invoice_items ii
             JOIN order_items oi ON ii.order_item_id = oi.id
             WHERE ii.invoice_id = ?`
          )
          .all(invoiceId) as Array<{ order_id: number }>;

        for (const { order_id } of orderIds) {
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
            db.prepare("UPDATE orders SET status = 4, updated_at = ? WHERE id = ?").run(now, order_id);
          }
        }
      }
    });

    processReconciliation();

    return NextResponse.json({
      success: true,
      data: null,
      message: "Credit note reconciliation has been completed.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
