import { NextRequest, NextResponse } from "next/server";
import { getDb, generateNumber, getTaxRate } from "@/lib/db";

// §3-1, §3-2, §3-3: Quotation List Retrieval with filter and search
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const filterStatus = parseInt(searchParams.get("status") ?? "-1", 10);
    const searchText = searchParams.get("search") ?? "";

    let query = `
      SELECT q.*, c.customer_name,
        COALESCE(
          (SELECT SUM(qi.quantity * qi.unit_price) FROM quotation_items qi WHERE qi.quotation_id = q.id),
          0
        ) as total_amount
      FROM quotations q
      LEFT JOIN customers c ON q.customer_id = c.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    // §3-2: Status filter
    if (filterStatus >= 0 && filterStatus <= 4) {
      query += " AND q.status = ?";
      params.push(filterStatus);
    }

    // §3-3: Text search on quotation_number and customer_name
    if (searchText.trim() !== "") {
      query += " AND (q.quotation_number LIKE ? OR c.customer_name LIKE ?)";
      const like = `%${searchText.trim()}%`;
      params.push(like, like);
    }

    // Sort by created_at descending
    query += " ORDER BY q.created_at DESC";

    const rows = db.prepare(query).all(...params);

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to retrieve quotations" },
      { status: 500 }
    );
  }
}

// §3-7: Quotation Save (new creation with status=0 Draft)
export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { customer_id, subject, expiration_date, items } = body;

    // §2-7 Validations
    if (!customer_id) {
      return NextResponse.json(
        { success: false, error: "Please select a customer." },
        { status: 400 }
      );
    }
    if (!subject || subject.trim() === "") {
      return NextResponse.json(
        { success: false, error: "Please enter a subject." },
        { status: 400 }
      );
    }
    if (!items || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Please add at least one line item row." },
        { status: 400 }
      );
    }
    for (const item of items) {
      if (!item.product_id) {
        return NextResponse.json(
          { success: false, error: "Please set a product for all line item rows." },
          { status: 400 }
        );
      }
      if (!item.quantity || item.quantity < 1) {
        return NextResponse.json(
          { success: false, error: "Please set a quantity of 1 or more for all line item rows." },
          { status: 400 }
        );
      }
    }

    const quotationNumber = generateNumber(
      "quotation_number_prefix",
      "quotations",
      "quotation_number"
    );

    const now = new Date().toISOString().replace("T", " ").slice(0, 19);

    const insertQuotation = db.prepare(`
      INSERT INTO quotations (quotation_number, customer_id, subject, status, expiration_date, created_by, created_at, updated_at)
      VALUES (?, ?, ?, 0, ?, 'system', ?, ?)
    `);

    const insertItem = db.prepare(`
      INSERT INTO quotation_items (quotation_id, product_id, product_name_snapshot, quantity, unit_price)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = db.transaction(() => {
      const info = insertQuotation.run(
        quotationNumber,
        customer_id,
        subject.trim(),
        expiration_date,
        now,
        now
      );
      const quotationId = info.lastInsertRowid as number;

      for (const item of items) {
        // Snapshot product name
        const product = db
          .prepare("SELECT product_name FROM products WHERE id = ?")
          .get(item.product_id) as { product_name: string } | undefined;
        const snapshotName = product?.product_name ?? "";

        insertItem.run(
          quotationId,
          item.product_id,
          snapshotName,
          item.quantity,
          item.unit_price
        );
      }

      return quotationId;
    })();

    return NextResponse.json({
      success: true,
      data: { id: result, quotation_number: quotationNumber },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to create quotation" },
      { status: 500 }
    );
  }
}
