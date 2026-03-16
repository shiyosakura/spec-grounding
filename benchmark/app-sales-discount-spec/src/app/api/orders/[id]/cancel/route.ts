import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// §3-15: Order Cancellation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const orderId = parseInt(id, 10);

    const order = db
      .prepare("SELECT * FROM orders WHERE id = ?")
      .get(orderId) as { id: number; status: number } | undefined;

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      );
    }

    // §2-15: Guard - only confirmed (status=0) orders can be cancelled
    if (order.status !== 0) {
      return NextResponse.json(
        { success: false, error: "Only confirmed orders can be cancelled." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString().replace("T", " ").slice(0, 19);

    db.transaction(() => {
      // Step 1: Retrieve order line items (must reference quantities before any changes)
      const orderItems = db
        .prepare("SELECT * FROM order_items WHERE order_id = ?")
        .all(orderId) as { id: number; product_id: number; quantity: number }[];

      // Step 2: Release allocation (subtract quantity from allocated_quantity)
      for (const oi of orderItems) {
        db.prepare(
          `UPDATE product_inventory
           SET allocated_quantity = MAX(allocated_quantity - ?, 0)
           WHERE product_id = ?`
        ).run(oi.quantity, oi.product_id);
      }

      // Step 3-4: Cancel shipping instruction
      const shippingInstruction = db
        .prepare("SELECT * FROM shipping_instructions WHERE order_id = ?")
        .get(orderId) as { id: number } | undefined;

      if (shippingInstruction) {
        db.prepare("UPDATE shipping_instructions SET status = 3 WHERE id = ?").run(
          shippingInstruction.id
        );
      }

      // Step 5-6: Cancel order
      db.prepare("UPDATE orders SET status = 5, updated_at = ? WHERE id = ?").run(
        now,
        orderId
      );
    })();

    return NextResponse.json({ success: true, data: { id: orderId } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to cancel order" },
      { status: 500 }
    );
  }
}
