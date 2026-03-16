import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// §3-7: Payment Save
export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { customer_id, payment_amount, payment_date, payment_method, notes } = body;

    // §2-7 Validation
    if (!customer_id || customer_id < 1) {
      return NextResponse.json(
        { success: false, error: "Please select a customer." },
        { status: 400 }
      );
    }

    if (!payment_amount || payment_amount < 1) {
      return NextResponse.json(
        { success: false, error: "Please enter a payment amount of at least ¥1." },
        { status: 400 }
      );
    }

    if (!payment_date) {
      return NextResponse.json(
        { success: false, error: "Please enter the payment date." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString().replace("T", " ").slice(0, 19);

    // Step 1: Create payment record
    const result = db
      .prepare(
        `INSERT INTO payments (customer_id, payment_amount, payment_date, payment_method, reconciliation_status, unreconciled_balance, notes, registered_at)
         VALUES (?, ?, ?, ?, 0, ?, ?, ?)`
      )
      .run(
        customer_id,
        payment_amount,
        payment_date,
        payment_method ?? 0,
        payment_amount, // unreconciled_balance = payment_amount
        notes ?? "",
        now
      );

    return NextResponse.json({
      success: true,
      data: { id: result.lastInsertRowid },
      message: "Payment has been registered.",
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to register payment" },
      { status: 500 }
    );
  }
}
