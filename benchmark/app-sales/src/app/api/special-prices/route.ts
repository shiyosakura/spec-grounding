import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const searchParams = request.nextUrl.searchParams;
    const customerId = searchParams.get("customer_id");
    const productId = searchParams.get("product_id");

    let query = `
      SELECT sp.*,
        c.customer_name, c.customer_code,
        p.product_name, p.standard_unit_price
      FROM special_prices sp
      JOIN customers c ON sp.customer_id = c.id
      JOIN products p ON sp.product_id = p.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (customerId && Number(customerId) > 0) {
      query += ` AND sp.customer_id = ?`;
      params.push(Number(customerId));
    }
    if (productId && Number(productId) > 0) {
      query += ` AND sp.product_id = ?`;
      params.push(Number(productId));
    }

    query += ` ORDER BY c.customer_code ASC`;

    const specialPrices = db.prepare(query).all(...params);

    return NextResponse.json({ success: true, data: specialPrices });
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
    const { customer_id, product_id, special_unit_price } = body;

    // Validation
    if (!customer_id || Number(customer_id) < 1) {
      return NextResponse.json(
        { success: false, error: "Please select a customer." },
        { status: 400 }
      );
    }
    if (!product_id || Number(product_id) < 1) {
      return NextResponse.json(
        { success: false, error: "Please select a product." },
        { status: 400 }
      );
    }
    const price = Number(special_unit_price);
    if (isNaN(price) || price < 0 || price > 9999999) {
      return NextResponse.json(
        { success: false, error: "Please enter a special unit price between ¥0 and ¥9,999,999." },
        { status: 400 }
      );
    }

    // Duplicate check
    const existing = db.prepare(
      "SELECT id FROM special_prices WHERE customer_id = ? AND product_id = ?"
    ).get(Number(customer_id), Number(product_id));
    if (existing) {
      return NextResponse.json(
        { success: false, error: "This combination of customer and product is already registered." },
        { status: 400 }
      );
    }

    const result = db.prepare(
      `INSERT INTO special_prices (customer_id, product_id, special_unit_price) VALUES (?, ?, ?)`
    ).run(Number(customer_id), Number(product_id), price);

    return NextResponse.json({ success: true, data: { id: result.lastInsertRowid } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
