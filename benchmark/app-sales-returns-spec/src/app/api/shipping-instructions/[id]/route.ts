import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * GET /api/shipping-instructions/[id]
 * Retrieve a single shipping instruction with line items and shipping records.
 *
 * Spec: §3-6 (Shipping Work Initialization)
 */
export async function GET(
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

    // Get shipping instruction with customer and order info
    const instruction = db.prepare(`
      SELECT
        si.id,
        si.shipping_instruction_number,
        si.order_id,
        si.customer_id,
        si.status,
        si.created_at,
        c.customer_name,
        o.order_number
      FROM shipping_instructions si
      JOIN customers c ON si.customer_id = c.id
      JOIN orders o ON si.order_id = o.id
      WHERE si.id = ?
    `).get(instructionId) as Record<string, unknown> | undefined;

    if (!instruction) {
      return NextResponse.json(
        { success: false, error: "Shipping instruction not found" },
        { status: 404 }
      );
    }

    // Guard: only pending (0) or shipping (1) can be worked on
    const status = instruction.status as number;
    if (status !== 0 && status !== 1) {
      return NextResponse.json(
        {
          success: false,
          error: "Only shipping instructions with status Not Shipped or Shipping can be worked on.",
        },
        { status: 400 }
      );
    }

    // Get line items with product info
    const items = db.prepare(`
      SELECT
        sii.id,
        sii.shipping_instruction_id,
        sii.order_item_id,
        sii.product_id,
        sii.instructed_quantity,
        sii.shipped_quantity,
        p.product_name,
        p.product_code
      FROM shipping_instruction_items sii
      JOIN products p ON sii.product_id = p.id
      WHERE sii.shipping_instruction_id = ?
      ORDER BY sii.id ASC
    `).all(instructionId);

    // Get shipping records for each line item
    const records = db.prepare(`
      SELECT
        sr.id,
        sr.shipping_instruction_item_id,
        sr.shipped_quantity,
        sr.shipped_at
      FROM shipping_records sr
      WHERE sr.shipping_instruction_item_id IN (
        SELECT id FROM shipping_instruction_items WHERE shipping_instruction_id = ?
      )
      ORDER BY sr.shipped_at ASC
    `).all(instructionId);

    // Get physical stock for each product in the instruction
    const productIds = (items as { product_id: number }[]).map((item) => item.product_id);
    const inventoryMap: Record<number, number> = {};
    if (productIds.length > 0) {
      const placeholders = productIds.map(() => "?").join(",");
      const inventoryRows = db.prepare(
        `SELECT product_id, physical_stock FROM product_inventory WHERE product_id IN (${placeholders})`
      ).all(...productIds) as { product_id: number; physical_stock: number }[];
      for (const row of inventoryRows) {
        inventoryMap[row.product_id] = row.physical_stock;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...instruction,
        items,
        shipping_records: records,
        inventory: inventoryMap,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
