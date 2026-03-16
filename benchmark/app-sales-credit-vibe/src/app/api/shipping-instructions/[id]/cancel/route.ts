import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * POST /api/shipping-instructions/[id]/cancel
 * Cancel a shipping instruction.
 * Only pending (status=0) instructions can be cancelled.
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

    const instruction = db.prepare(
      "SELECT * FROM shipping_instructions WHERE id = ?"
    ).get(instructionId) as {
      id: number;
      order_id: number;
      status: number;
    } | undefined;

    if (!instruction) {
      return NextResponse.json(
        { success: false, error: "Shipping instruction not found" },
        { status: 404 }
      );
    }

    // Only pending instructions can be cancelled
    if (instruction.status !== 0) {
      return NextResponse.json(
        { success: false, error: "Only pending shipping instructions can be cancelled." },
        { status: 400 }
      );
    }

    const cancelInstruction = db.transaction(() => {
      // Restore allocated stock for each line item
      const items = db.prepare(
        "SELECT * FROM shipping_instruction_items WHERE shipping_instruction_id = ?"
      ).all(instructionId) as {
        product_id: number;
        instructed_quantity: number;
      }[];

      for (const item of items) {
        db.prepare(`
          UPDATE product_inventory
          SET allocated_quantity = MAX(allocated_quantity - ?, 0)
          WHERE product_id = ?
        `).run(item.instructed_quantity, item.product_id);
      }

      // Update instruction status to cancelled (3)
      db.prepare(
        "UPDATE shipping_instructions SET status = 3 WHERE id = ?"
      ).run(instructionId);
    });

    cancelInstruction();

    return NextResponse.json({
      success: true,
      message: "Shipping instruction cancelled.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
