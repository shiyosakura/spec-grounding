import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// §3-8: Quotation Submit (status 0 → 1)
export async function POST(
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

    if (existing.status !== 0) {
      return NextResponse.json(
        { success: false, error: "Only draft quotations can be submitted." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    db.prepare("UPDATE quotations SET status = 1, updated_at = ? WHERE id = ?").run(
      now,
      quotationId
    );

    return NextResponse.json({ success: true, data: { id: quotationId } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to submit quotation" },
      { status: 500 }
    );
  }
}
