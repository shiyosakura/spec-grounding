import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// §3-9: Unreconciled Invoice List Retrieval for a payment's customer
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;
    const paymentId = parseInt(id, 10);

    if (isNaN(paymentId) || paymentId < 1) {
      return NextResponse.json(
        { success: false, error: "Invalid payment ID" },
        { status: 400 }
      );
    }

    // Step 1: Get the customer ID from the payment
    const payment = db
      .prepare("SELECT customer_id, unreconciled_balance FROM payments WHERE id = ?")
      .get(paymentId) as { customer_id: number; unreconciled_balance: number } | undefined;

    if (!payment) {
      return NextResponse.json(
        { success: false, error: "Payment not found" },
        { status: 404 }
      );
    }

    // Step 2: Get invoices for this customer with status = 1 (Issued), 2 (Partially Paid), or 4 (Credit Note)
    // §3-9: Credit Notes (status=4) are included so they can be applied as offsets against normal invoices
    const invoices = db
      .prepare(
        `SELECT i.*,
          COALESCE(
            (SELECT SUM(pr.reconciled_amount) FROM payment_reconciliations pr WHERE pr.invoice_id = i.id),
            0
          ) as total_reconciled
        FROM invoices i
        WHERE i.customer_id = ? AND i.status IN (1, 2, 4)
        ORDER BY i.issue_date ASC`
      )
      .all(payment.customer_id) as Array<{
        id: number;
        invoice_number: string;
        customer_id: number;
        billing_period: string;
        invoice_amount: number;
        status: number;
        issue_date: string;
        total_reconciled: number;
      }>;

    // Step 3: Calculate unreconciled balance per invoice
    const result = invoices.map((inv) => ({
      id: inv.id,
      invoice_number: inv.invoice_number,
      invoice_amount: inv.invoice_amount,
      billing_period: inv.billing_period,
      status: inv.status,
      issue_date: inv.issue_date,
      total_reconciled: inv.total_reconciled,
      unreconciled_balance: inv.invoice_amount - inv.total_reconciled,
    }));

    return NextResponse.json({
      success: true,
      data: {
        payment_unreconciled_balance: payment.unreconciled_balance,
        invoices: result,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to retrieve unreconciled invoices" },
      { status: 500 }
    );
  }
}
