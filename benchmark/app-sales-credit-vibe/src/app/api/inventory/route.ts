import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * GET /api/inventory
 * Retrieve inventory list with product info.
 * Query params: search (partial match on product_code or product_name)
 *
 * Spec: §3-1 (list retrieval), §3-2 (text search)
 */
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";

    let query = `
      SELECT
        pi.product_id,
        pi.physical_stock,
        pi.allocated_quantity,
        p.product_code,
        p.product_name,
        p.unit,
        p.active,
        p.category_id,
        pc.category_name
      FROM product_inventory pi
      JOIN products p ON pi.product_id = p.id
      LEFT JOIN product_categories pc ON p.category_id = pc.id
    `;

    const params: string[] = [];

    if (search) {
      query += ` WHERE (p.product_code LIKE ? OR p.product_name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY p.product_code ASC`;

    const rows = db.prepare(query).all(...params);

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
