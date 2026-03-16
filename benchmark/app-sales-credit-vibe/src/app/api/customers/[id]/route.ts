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
    const customer = db.prepare("SELECT * FROM customers WHERE id = ?").get(customerId) as Record<string, unknown> | undefined;

    if (!customer) {
      return NextResponse.json(
        { success: false, error: "Customer not found." },
        { status: 404 }
      );
    }

    // Calculate outstanding balance (unpaid invoice remainders + unbilled order totals)
    const invoiceBalance = db
      .prepare(
        `SELECT COALESCE(SUM(i.invoice_amount - COALESCE(pr.reconciled, 0)), 0) as total
         FROM invoices i
         LEFT JOIN (
           SELECT invoice_id, SUM(reconciled_amount) as reconciled
           FROM payment_reconciliations GROUP BY invoice_id
         ) pr ON pr.invoice_id = i.id
         WHERE i.customer_id = ? AND i.status IN (1, 2)`
      )
      .get(customerId) as { total: number };

    const taxRateRow = db
      .prepare("SELECT value FROM system_settings WHERE key = 'tax_rate'")
      .get() as { value: string } | undefined;
    const taxRate = taxRateRow ? parseInt(taxRateRow.value, 10) : 10;

    const unbilledOrders = db
      .prepare(
        `SELECT o.id FROM orders o
         WHERE o.customer_id = ? AND o.status IN (0, 1, 2, 3)
         AND NOT EXISTS (
           SELECT 1 FROM invoice_items ii
           INNER JOIN order_items oi ON ii.order_item_id = oi.id
           WHERE oi.order_id = o.id
         )`
      )
      .all(customerId) as { id: number }[];

    let unbilledOrderTotal = 0;
    for (const uo of unbilledOrders) {
      const orderSubtotal = db
        .prepare(
          `SELECT COALESCE(SUM(quantity * unit_price), 0) as subtotal FROM order_items WHERE order_id = ?`
        )
        .get(uo.id) as { subtotal: number };
      const taxAmount = Math.floor((orderSubtotal.subtotal * taxRate) / 100);
      unbilledOrderTotal += orderSubtotal.subtotal + taxAmount;
    }

    const outstandingBalance = invoiceBalance.total + unbilledOrderTotal;

    return NextResponse.json({
      success: true,
      data: {
        ...customer,
        outstanding_balance: outstandingBalance,
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
