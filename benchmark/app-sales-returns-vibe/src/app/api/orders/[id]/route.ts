import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// §3-14: Order Detail Retrieval
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const orderId = parseInt(id, 10);

    const order = db
      .prepare(
        `SELECT o.*, c.customer_name
         FROM orders o
         LEFT JOIN customers c ON o.customer_id = c.id
         WHERE o.id = ?`
      )
      .get(orderId);

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      );
    }

    const items = db
      .prepare("SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC")
      .all(orderId);

    // Shipping instruction for status summary
    const shippingInstruction = db
      .prepare("SELECT * FROM shipping_instructions WHERE order_id = ? LIMIT 1")
      .get(orderId);

    return NextResponse.json({
      success: true,
      data: { ...order, items, shipping_instruction: shippingInstruction },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to retrieve order" },
      { status: 500 }
    );
  }
}
