import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;
    const customerId = Number(id);
    const customer = db.prepare("SELECT * FROM customers WHERE id = ?").get(customerId);

    if (!customer) {
      return NextResponse.json(
        { success: false, error: "Customer not found." },
        { status: 404 }
      );
    }

    // Calculate outstanding_balance:
    //   Sum of invoice_amount for status IN (1=Issued, 2=Partially Paid, 4=Credit Note)
    //   Credit notes (status=4) carry a negative invoice_amount, naturally reducing the balance
    //   Subtract already reconciled amounts
    const outstandingRow = db
      .prepare(
        `SELECT COALESCE(SUM(i.invoice_amount), 0) -
                COALESCE((
                  SELECT SUM(pr.reconciled_amount)
                  FROM payment_reconciliations pr
                  JOIN invoices inv ON pr.invoice_id = inv.id
                  WHERE inv.customer_id = ? AND inv.status IN (1, 2, 4)
                ), 0) as outstanding_balance
         FROM invoices i
         WHERE i.customer_id = ? AND i.status IN (1, 2, 4)`
      )
      .get(customerId, customerId) as { outstanding_balance: number };

    return NextResponse.json({
      success: true,
      data: {
        ...(customer as object),
        outstanding_balance: outstandingRow.outstanding_balance,
      },
    });
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
    const customerId = Number(id);
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

    // Duplicate check (exclude self)
    const existing = db.prepare(
      "SELECT id FROM customers WHERE customer_code = ? AND id != ?"
    ).get(customer_code, customerId) as { id: number } | undefined;
    if (existing) {
      return NextResponse.json(
        { success: false, error: "This code is already in use." },
        { status: 400 }
      );
    }

    db.prepare(
      `UPDATE customers
       SET customer_code = ?, customer_name = ?, address = ?, phone = ?, email = ?, closing_day = ?, credit_limit = ?
       WHERE id = ?`
    ).run(
      customer_code.trim(),
      customer_name.trim(),
      address || "",
      phone || "",
      email || "",
      day,
      limit,
      customerId
    );

    return NextResponse.json({ success: true, data: { id: customerId } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
