import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search") || "";

    let query = `SELECT * FROM customers`;
    const params: string[] = [];

    if (search) {
      query += ` WHERE customer_code LIKE ? OR customer_name LIKE ?`;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY customer_code ASC`;

    const customers = db.prepare(query).all(...params);

    return NextResponse.json({ success: true, data: customers });
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
    const { customer_code, customer_name, address, phone, email, closing_day, credit_limit } = body;

    // Validation
    if (!customer_code || !customer_code.trim()) {
      return NextResponse.json(
        { success: false, error: "Please enter the customer code." },
        { status: 400 }
      );
    }
    if (!customer_name || !customer_name.trim()) {
      return NextResponse.json(
        { success: false, error: "Please enter the customer name." },
        { status: 400 }
      );
    }
    const limit = Number(credit_limit);
    if (isNaN(limit) || limit < 0 || limit > 99999999) {
      return NextResponse.json(
        { success: false, error: "Please enter a credit limit between ¥0 and ¥99,999,999." },
        { status: 400 }
      );
    }
    const day = Number(closing_day);
    if (isNaN(day) || !Number.isInteger(day) || (day !== 0 && (day < 1 || day > 28))) {
      return NextResponse.json(
        { success: false, error: "Please enter 0 (end of month) or an integer between 1 and 28 for the closing day." },
        { status: 400 }
      );
    }

    // Duplicate check
    const existing = db.prepare("SELECT id FROM customers WHERE customer_code = ?").get(customer_code);
    if (existing) {
      return NextResponse.json(
        { success: false, error: "This code is already in use." },
        { status: 400 }
      );
    }

    const result = db.prepare(
      `INSERT INTO customers (customer_code, customer_name, address, phone, email, closing_day, credit_limit)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      customer_code.trim(),
      customer_name.trim(),
      address || "",
      phone || "",
      email || "",
      day,
      limit
    );

    return NextResponse.json({ success: true, data: { id: result.lastInsertRowid } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
