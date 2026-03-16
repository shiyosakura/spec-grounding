import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// §3-1, §3-2, §3-3: Invoice List Retrieval with filter and search
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const filterStatus = parseInt(searchParams.get("status") ?? "-1", 10);
    const searchText = searchParams.get("search") ?? "";

    let query = `
      SELECT i.*, c.customer_name
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    // §3-2: Status filter
    if (filterStatus >= 0 && filterStatus <= 3) {
      query += " AND i.status = ?";
      params.push(filterStatus);
    }

    // §3-3: Text search on invoice_number and customer_name
    if (searchText.trim() !== "") {
      query += " AND (i.invoice_number LIKE ? OR c.customer_name LIKE ?)";
      const like = `%${searchText.trim()}%`;
      params.push(like, like);
    }

    // Sort by issue_date descending
    query += " ORDER BY i.issue_date DESC, i.id DESC";

    const rows = db.prepare(query).all(...params);

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to retrieve invoices" },
      { status: 500 }
    );
  }
}
