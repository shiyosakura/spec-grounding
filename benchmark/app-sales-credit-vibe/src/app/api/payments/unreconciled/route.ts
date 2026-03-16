import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// §3-8: Unreconciled Payment List Retrieval
export async function GET() {
  try {
    const db = getDb();

    // Retrieve payments with reconciliation_status = 0 (Unreconciled) or 1 (Partially Reconciled)
    const payments = db
      .prepare(
        `SELECT p.*, c.customer_name
         FROM payments p
         LEFT JOIN customers c ON p.customer_id = c.id
         WHERE p.reconciliation_status IN (0, 1)
         ORDER BY p.payment_date DESC, p.id DESC`
      )
      .all();

    return NextResponse.json({ success: true, data: payments });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to retrieve unreconciled payments" },
      { status: 500 }
    );
  }
}
