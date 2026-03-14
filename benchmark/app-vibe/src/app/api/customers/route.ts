import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { seedIfEmpty } from "@/lib/seed";

export async function GET(req: NextRequest) {
  seedIfEmpty();
  const db = getDb();
  const phoneNumber = req.nextUrl.searchParams.get("phone_number");

  if (phoneNumber) {
    const customer = db
      .prepare("SELECT * FROM customers WHERE phone_number = ?")
      .get(phoneNumber);
    return NextResponse.json(customer || null);
  }

  return NextResponse.json([]);
}

export async function POST(req: NextRequest) {
  seedIfEmpty();
  const db = getDb();
  const body = await req.json();
  const { customer_name, phone_number } = body;

  if (!customer_name?.trim()) {
    return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  }
  if (!phone_number?.trim() || !/^\d+$/.test(phone_number)) {
    return NextResponse.json({ error: "Please enter a valid phone number." }, { status: 400 });
  }

  // Search by phone number
  const existing = db
    .prepare("SELECT * FROM customers WHERE phone_number = ?")
    .get(phone_number) as { customer_id: number } | undefined;

  if (existing) {
    // Update name
    db.prepare("UPDATE customers SET customer_name = ? WHERE customer_id = ?").run(
      customer_name,
      existing.customer_id
    );
    return NextResponse.json({ customer_id: existing.customer_id });
  }

  // Create new
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  const result = db
    .prepare(
      "INSERT INTO customers (customer_name, phone_number, account_id, cancellation_penalty_count, registered_at) VALUES (?, ?, NULL, 0, ?)"
    )
    .run(customer_name, phone_number, now);

  return NextResponse.json({ customer_id: result.lastInsertRowid }, { status: 201 });
}
