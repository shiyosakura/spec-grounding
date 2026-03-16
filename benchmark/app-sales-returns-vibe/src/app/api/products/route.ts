import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search") || "";

    let query = `
      SELECT p.*, pc.category_name
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.id
    `;
    const params: string[] = [];

    if (search) {
      query += ` WHERE p.product_code LIKE ? OR p.product_name LIKE ?`;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY p.product_code ASC`;

    const products = db.prepare(query).all(...params);

    return NextResponse.json({ success: true, data: products });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { product_code, product_name, category_id, standard_unit_price, unit, active } = body;

    // Validation
    if (!product_code || !product_code.trim()) {
      return NextResponse.json(
        { success: false, error: "Please enter the product code." },
        { status: 400 }
      );
    }
    if (!product_name || !product_name.trim()) {
      return NextResponse.json(
        { success: false, error: "Please enter the product name." },
        { status: 400 }
      );
    }
    const price = Number(standard_unit_price);
    if (isNaN(price) || price < 0 || price > 9999999) {
      return NextResponse.json(
        { success: false, error: "Please enter a standard unit price between ¥0 and ¥9,999,999." },
        { status: 400 }
      );
    }

    // Duplicate check
    const existing = db.prepare("SELECT id FROM products WHERE product_code = ?").get(product_code);
    if (existing) {
      return NextResponse.json(
        { success: false, error: "This code is already in use." },
        { status: 400 }
      );
    }

    // Create product + inventory in transaction
    const result = db.transaction(() => {
      const insertResult = db.prepare(
        `INSERT INTO products (product_code, product_name, category_id, standard_unit_price, unit, active)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(
        product_code.trim(),
        product_name.trim(),
        category_id ?? 0,
        price,
        unit || "個",
        active ?? 1
      );

      const productId = insertResult.lastInsertRowid;

      // Create product_inventory record
      db.prepare(
        `INSERT INTO product_inventory (product_id, physical_stock, allocated_quantity) VALUES (?, 0, 0)`
      ).run(productId);

      return productId;
    })();

    return NextResponse.json({ success: true, data: { id: result } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
