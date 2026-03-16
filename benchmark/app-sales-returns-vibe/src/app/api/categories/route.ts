import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = getDb();
    const categories = db.prepare(
      "SELECT * FROM product_categories ORDER BY id ASC"
    ).all();

    return NextResponse.json({ success: true, data: categories });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
