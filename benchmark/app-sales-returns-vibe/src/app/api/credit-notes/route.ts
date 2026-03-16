import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * GET /api/credit-notes
 * List credit notes with customer and invoice info.
 * Query params: customer_id, status, search
 *
 * status: 0=unreconciled, 1=partially reconciled, 2=fully reconciled
 */
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const customerIdParam = searchParams.get("customer_id");
    const statusParam = searchParams.get("status");
    const search = searchParams.get("search") || "";

    let query = `
      SELECT
        cn.id,
        cn.credit_note_number,
        cn.return_id,
        cn.customer_id,
        cn.invoice_id,
        cn.credit_amount,
        cn.status,
        cn.issue_date,
        cn.registered_at,
        c.customer_name,
        i.invoice_number,
        r.return_number,
        COALESCE((
          SELECT SUM(cnr.reconciled_amount)
          FROM credit_note_reconciliations cnr
          WHERE cnr.credit_note_id = cn.id
        ), 0) AS reconciled_amount
      FROM credit_notes cn
      JOIN customers c ON cn.customer_id = c.id
      JOIN invoices i ON cn.invoice_id = i.id
      JOIN returns r ON cn.return_id = r.id
      WHERE 1=1
    `;

    const params: (string | number)[] = [];

    if (customerIdParam) {
      query += ` AND cn.customer_id = ?`;
      params.push(Number(customerIdParam));
    }

    if (statusParam !== null && statusParam !== "") {
      const statusNum = parseInt(statusParam, 10);
      if (!isNaN(statusNum) && statusNum >= 0 && statusNum <= 2) {
        query += ` AND cn.status = ?`;
        params.push(statusNum);
      }
    }

    if (search) {
      query += ` AND (cn.credit_note_number LIKE ? OR c.customer_name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY cn.issue_date DESC, cn.id DESC`;

    const rows = db.prepare(query).all(...params);

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
