import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * GET /api/credit-notes/unreconciled
 * List credit notes that are unreconciled (status=0) or partially reconciled (status=1).
 * Used in the reconciliation screen to select credit notes for offset.
 */
export async function GET() {
  try {
    const db = getDb();

    const creditNotes = db
      .prepare(
        `SELECT
           cn.id,
           cn.credit_note_number,
           cn.customer_id,
           cn.invoice_id,
           cn.credit_amount,
           cn.status,
           cn.issue_date,
           c.customer_name,
           i.invoice_number,
           COALESCE((
             SELECT SUM(cnr.reconciled_amount)
             FROM credit_note_reconciliations cnr
             WHERE cnr.credit_note_id = cn.id
           ), 0) AS reconciled_amount,
           cn.credit_amount - COALESCE((
             SELECT SUM(cnr.reconciled_amount)
             FROM credit_note_reconciliations cnr
             WHERE cnr.credit_note_id = cn.id
           ), 0) AS unreconciled_balance
         FROM credit_notes cn
         LEFT JOIN customers c ON cn.customer_id = c.id
         LEFT JOIN invoices i ON cn.invoice_id = i.id
         WHERE cn.status IN (0, 1)
         ORDER BY cn.issue_date DESC, cn.id DESC`
      )
      .all();

    return NextResponse.json({ success: true, data: creditNotes });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
