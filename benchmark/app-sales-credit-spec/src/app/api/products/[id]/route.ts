import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;
    const product = db.prepare(
      `SELECT p.*, pc.category_name
       FROM products p
       LEFT JOIN product_categories pc ON p.category_id = pc.id
       WHERE p.id = ?`
    ).get(Number(id));

    if (!product) {
      return NextResponse.json(
        { success: false, error: "Product not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: product });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;
    const productId = Number(id);
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

    // Duplicate check (exclude self)
    const existing = db.prepare(
      "SELECT id FROM products WHERE product_code = ? AND id != ?"
    ).get(product_code, productId) as { id: number } | undefined;
    if (existing) {
      return NextResponse.json(
        { success: false, error: "This code is already in use." },
        { status: 400 }
      );
    }

    db.prepare(
      `UPDATE products
       SET product_code = ?, product_name = ?, category_id = ?, standard_unit_price = ?, unit = ?, active = ?
       WHERE id = ?`
    ).run(
      product_code.trim(),
      product_name.trim(),
      category_id ?? 0,
      price,
      unit || "個",
      active ?? 1,
      productId
    );

    return NextResponse.json({ success: true, data: { id: productId } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
