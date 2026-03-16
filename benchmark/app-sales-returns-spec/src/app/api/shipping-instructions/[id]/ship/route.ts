import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

interface ShipQuantity {
  shipping_instruction_item_id: number;
  quantity: number;
}

/**
 * POST /api/shipping-instructions/[id]/ship
 * Process shipment (partial or full).
 * Body: { items: [{ shipping_instruction_item_id, quantity }] }
 *
 * Spec: §2-7 (validation), §3-8 (shipping confirmation), §2-9/§3-9 (status update)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;
    const instructionId = parseInt(id, 10);

    if (isNaN(instructionId)) {
      return NextResponse.json(
        { success: false, error: "Invalid shipping instruction ID" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const shipItems: ShipQuantity[] = body.items || [];

    // Filter out items with quantity 0 (not shipping this time)
    const activeItems = shipItems.filter((item) => item.quantity > 0);

    // §2-7 Guard: at least one row must have quantity >= 1
    if (activeItems.length === 0) {
      return NextResponse.json(
        { success: false, error: "Please enter a current shipping quantity for at least one row." },
        { status: 400 }
      );
    }

    // Get instruction
    const instruction = db.prepare(
      "SELECT * FROM shipping_instructions WHERE id = ?"
    ).get(instructionId) as { id: number; order_id: number; status: number } | undefined;

    if (!instruction) {
      return NextResponse.json(
        { success: false, error: "Shipping instruction not found" },
        { status: 404 }
      );
    }

    if (instruction.status !== 0 && instruction.status !== 1) {
      return NextResponse.json(
        { success: false, error: "Only pending or shipping in progress instructions can be shipped." },
        { status: 400 }
      );
    }

    // Get all instruction line items
    const instructionItems = db.prepare(
      "SELECT * FROM shipping_instruction_items WHERE shipping_instruction_id = ?"
    ).all(instructionId) as {
      id: number;
      order_item_id: number;
      product_id: number;
      instructed_quantity: number;
      shipped_quantity: number;
    }[];

    const itemMap = new Map(instructionItems.map((item) => [item.id, item]));

    // §2-7 Upper Limit Check
    const errors: string[] = [];
    for (const shipItem of activeItems) {
      const instrItem = itemMap.get(shipItem.shipping_instruction_item_id);
      if (!instrItem) {
        errors.push(`Line item ID ${shipItem.shipping_instruction_item_id} not found.`);
        continue;
      }

      if (shipItem.quantity < 1) {
        errors.push(`Shipping quantity must be 1 or more.`);
        continue;
      }

      const remaining = instrItem.instructed_quantity - instrItem.shipped_quantity;
      if (shipItem.quantity > remaining) {
        // Get product name for error message
        const product = db.prepare("SELECT product_name FROM products WHERE id = ?").get(instrItem.product_id) as { product_name: string };
        const excess = shipItem.quantity - remaining;
        errors.push(
          `${product.product_name}: Shipping quantity exceeds remaining by ${excess}. (Remaining: ${remaining})`
        );
      }

      // Check physical stock
      const inventory = db.prepare(
        "SELECT physical_stock FROM product_inventory WHERE product_id = ?"
      ).get(instrItem.product_id) as { physical_stock: number } | undefined;

      if (inventory && shipItem.quantity > inventory.physical_stock) {
        const product = db.prepare("SELECT product_name FROM products WHERE id = ?").get(instrItem.product_id) as { product_name: string };
        errors.push(
          `${product.product_name}: Insufficient physical stock. (Available: ${inventory.physical_stock}, Requested: ${shipItem.quantity})`
        );
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { success: false, error: errors.join("\n"), details: errors },
        { status: 400 }
      );
    }

    // §3-8 Shipping Confirmation Process (in transaction)
    const processShipment = db.transaction(() => {
      const now = new Date().toISOString().replace("T", " ").slice(0, 19);

      for (const shipItem of activeItems) {
        const instrItem = itemMap.get(shipItem.shipping_instruction_item_id)!;

        // Step 1: Create shipping_records entry
        db.prepare(`
          INSERT INTO shipping_records (shipping_instruction_item_id, shipped_quantity, shipped_at)
          VALUES (?, ?, ?)
        `).run(instrItem.id, shipItem.quantity, now);

        // Step 2: Update shipping_instruction_items.shipped_quantity
        const newShipped = Math.min(
          instrItem.shipped_quantity + shipItem.quantity,
          instrItem.instructed_quantity
        );
        db.prepare(`
          UPDATE shipping_instruction_items
          SET shipped_quantity = ?
          WHERE id = ?
        `).run(newShipped, instrItem.id);

        // Step 3: Decrement product_inventory.physical_stock (lower limit 0)
        db.prepare(`
          UPDATE product_inventory
          SET physical_stock = MAX(physical_stock - ?, 0)
          WHERE product_id = ?
        `).run(shipItem.quantity, instrItem.product_id);

        // Step 4: Decrement product_inventory.allocated_quantity (lower limit 0)
        db.prepare(`
          UPDATE product_inventory
          SET allocated_quantity = MAX(allocated_quantity - ?, 0)
          WHERE product_id = ?
        `).run(shipItem.quantity, instrItem.product_id);

        // Step 5: Increment order_items.shipped_quantity
        const orderItem = db.prepare(
          "SELECT * FROM order_items WHERE id = ?"
        ).get(instrItem.order_item_id) as { id: number; quantity: number; shipped_quantity: number };

        const newOrderShipped = Math.min(
          orderItem.shipped_quantity + shipItem.quantity,
          orderItem.quantity
        );
        db.prepare(`
          UPDATE order_items
          SET shipped_quantity = ?
          WHERE id = ?
        `).run(newOrderShipped, orderItem.id);
      }

      // §2-9 / §3-9: Status update after all rows processed

      // Re-read all instruction items to check completion
      const updatedItems = db.prepare(
        "SELECT * FROM shipping_instruction_items WHERE shipping_instruction_id = ?"
      ).all(instructionId) as {
        instructed_quantity: number;
        shipped_quantity: number;
      }[];

      const allItemsComplete = updatedItems.every(
        (item) => item.shipped_quantity >= item.instructed_quantity
      );

      const newInstructionStatus = allItemsComplete ? 2 : 1; // 2=shipped, 1=shipping

      // Update shipping instruction status
      db.prepare(`
        UPDATE shipping_instructions SET status = ? WHERE id = ?
      `).run(newInstructionStatus, instructionId);

      // Check and update order status
      const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(instruction.order_id) as {
        id: number;
        status: number;
      };

      // Only update if order status < 3 (not yet invoiced or above)
      if (order.status < 3) {
        const orderItems = db.prepare(
          "SELECT * FROM order_items WHERE order_id = ?"
        ).all(order.id) as { quantity: number; shipped_quantity: number }[];

        const allOrderItemsShipped = orderItems.every(
          (item) => item.shipped_quantity >= item.quantity
        );

        const newOrderStatus = allOrderItemsShipped ? 2 : 1; // 2=shipped, 1=shipping
        db.prepare(`
          UPDATE orders SET status = ?, updated_at = ? WHERE id = ?
        `).run(newOrderStatus, now, order.id);
      }

      return { newInstructionStatus };
    });

    const result = processShipment();

    return NextResponse.json({
      success: true,
      data: {
        instruction_id: instructionId,
        new_status: result.newInstructionStatus,
      },
      message: "Shipment processed successfully.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
