import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// §3-4: Quotation Detail Retrieval (existing edit mode)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const quotationId = parseInt(id, 10);

    const quotation = db
      .prepare(
        `SELECT q.*, c.customer_name
         FROM quotations q
         LEFT JOIN customers c ON q.customer_id = c.id
         WHERE q.id = ?`
      )
      .get(quotationId);

    if (!quotation) {
      return NextResponse.json(
        { success: false, error: "Quotation not found" },
        { status: 404 }
      );
    }

    const items = db
      .prepare("SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY id ASC")
      .all(quotationId);

    return NextResponse.json({
      success: true,
      data: { ...quotation, items },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to retrieve quotation" },
      { status: 500 }
    );
  }
}

// §3-7: Quotation Save (existing edit) and §3-8: Quotation Submit (existing edit)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const quotationId = parseInt(id, 10);
    const body = await request.json();
    const { customer_id, subject, expiration_date, items, status } = body;

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

    const existing = db
      .prepare("SELECT * FROM quotations WHERE id = ?")
      .get(quotationId) as { status: number } | undefined;

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Quotation not found" },
        { status: 404 }
      );
    }

    const now = new Date().toISOString().replace("T", " ").slice(0, 19);

    // Determine final status: if status is provided (submit), use it; otherwise keep current
    const finalStatus = status !== undefined ? status : existing.status;

    db.transaction(() => {
      // §3-7 / §3-8: Update quotation header
      db.prepare(`
        UPDATE quotations
        SET customer_id = ?, subject = ?, expiration_date = ?, status = ?, updated_at = ?
        WHERE id = ?
      `).run(customer_id, subject.trim(), expiration_date, finalStatus, now, quotationId);

      // Full replacement of line items
      db.prepare("DELETE FROM quotation_items WHERE quotation_id = ?").run(quotationId);

      const insertItem = db.prepare(`
        INSERT INTO quotation_items (quotation_id, product_id, product_name_snapshot, quantity, unit_price)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const item of items) {
        const product = db
          .prepare("SELECT product_name FROM products WHERE id = ?")
          .get(item.product_id) as { product_name: string } | undefined;
        const snapshotName = product?.product_name ?? "";

        insertItem.run(quotationId, item.product_id, snapshotName, item.quantity, item.unit_price);
      }
    })();

    return NextResponse.json({ success: true, data: { id: quotationId } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to update quotation" },
      { status: 500 }
    );
  }
}

// §3-10: Lost Deal Process
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const quotationId = parseInt(id, 10);

    const existing = db
      .prepare("SELECT * FROM quotations WHERE id = ?")
      .get(quotationId) as { status: number } | undefined;

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Quotation not found" },
        { status: 404 }
      );
    }

    // §2-10: Guard - only submitted quotations can be lost
    if (existing.status !== 1) {
      return NextResponse.json(
        { success: false, error: "Only submitted quotations can be marked as lost." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    db.prepare("UPDATE quotations SET status = 3, updated_at = ? WHERE id = ?").run(now, quotationId);

    return NextResponse.json({ success: true, data: { id: quotationId } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to process lost deal" },
      { status: 500 }
    );
  }
}
