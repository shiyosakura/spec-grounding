import { NextRequest, NextResponse } from "next/server";
import { getDb, generateNumber } from "@/lib/db";

/**
 * GET /api/shipping-instructions
 * List shipping instructions (excluding cancelled by default).
 * Query params: status (-1=all excl cancelled, 0=pending, 1=shipping, 2=shipped), search
 *
 * Spec: §3-3, §3-4, §3-5
 */
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const statusFilter = parseInt(searchParams.get("status") ?? "0", 10);
    const search = searchParams.get("search") || "";

    let query = `
      SELECT
        si.id,
        si.shipping_instruction_number,
        si.order_id,
        si.customer_id,
        si.status,
        si.created_at,
        c.customer_name,
        o.order_number,
        (SELECT COUNT(*) FROM shipping_instruction_items sii WHERE sii.shipping_instruction_id = si.id) AS item_count
      FROM shipping_instructions si
      JOIN customers c ON si.customer_id = c.id
      JOIN orders o ON si.order_id = o.id
      WHERE si.status != 3
    `;

    const params: (string | number)[] = [];

    // Status filter
    if (statusFilter !== -1) {
      query += ` AND si.status = ?`;
      params.push(statusFilter);
    }

    // Text search
    if (search) {
      query += ` AND (si.shipping_instruction_number LIKE ? OR c.customer_name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY si.created_at ASC`;

    const rows = db.prepare(query).all(...params);

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/shipping-instructions
 * Create a shipping instruction from an order.
 * Body: { order_id: number }
 *
 * Note: This endpoint is provided for completeness but shipping instructions
 * are primarily created from the Order Management module (101_order_spec.md).
 * Validation: order must be status 0 (confirmed) or 1 (shipping in progress).
 */
export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { order_id } = body;

    if (!order_id) {
      return NextResponse.json(
        { success: false, error: "order_id is required" },
        { status: 400 }
      );
    }

    // Validate order exists and status is confirmed (0) or shipping in progress (1)
    const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(order_id) as {
      id: number;
      customer_id: number;
      status: number;
    } | undefined;

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      );
    }

    if (order.status !== 0 && order.status !== 1) {
      return NextResponse.json(
        { success: false, error: "Shipping instructions can only be created for confirmed or shipping in progress orders." },
        { status: 400 }
      );
    }

    // Check if shipping instruction already exists for this order
    const existing = db.prepare(
      "SELECT id FROM shipping_instructions WHERE order_id = ? AND status != 3"
    ).get(order_id);

    if (existing) {
      return NextResponse.json(
        { success: false, error: "A shipping instruction already exists for this order." },
        { status: 400 }
      );
    }

    const shippingNumber = generateNumber(
      "shipping_instruction_number_prefix",
      "shipping_instructions",
      "shipping_instruction_number"
    );

    const orderItems = db.prepare(
      "SELECT * FROM order_items WHERE order_id = ?"
    ).all(order_id) as {
      id: number;
      product_id: number;
      quantity: number;
    }[];

    if (orderItems.length === 0) {
      return NextResponse.json(
        { success: false, error: "Order has no line items" },
        { status: 400 }
      );
    }

    const createInstruction = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO shipping_instructions (shipping_instruction_number, order_id, customer_id, status)
        VALUES (?, ?, ?, 0)
      `).run(shippingNumber, order_id, order.customer_id);

      const instructionId = result.lastInsertRowid;

      const insertItem = db.prepare(`
        INSERT INTO shipping_instruction_items (shipping_instruction_id, order_item_id, product_id, instructed_quantity, shipped_quantity)
        VALUES (?, ?, ?, ?, 0)
      `);

      for (const item of orderItems) {
        insertItem.run(instructionId, item.id, item.product_id, item.quantity);
      }

      // Increment allocated_quantity for each product
      const updateInventory = db.prepare(`
        UPDATE product_inventory
        SET allocated_quantity = MIN(allocated_quantity + ?, 999999)
        WHERE product_id = ?
      `);

      for (const item of orderItems) {
        updateInventory.run(item.quantity, item.product_id);
      }

      return instructionId;
    });

    const instructionId = createInstruction();

    return NextResponse.json({
      success: true,
      data: { id: instructionId, shipping_instruction_number: shippingNumber },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
