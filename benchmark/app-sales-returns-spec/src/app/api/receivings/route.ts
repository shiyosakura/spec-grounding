import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * GET /api/receivings
 * List recent receivings with line items.
 * Query params: limit (default 20)
 *
 * Spec: §3-10
 */
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const receivings = db.prepare(`
      SELECT
        r.id,
        r.receipt_date,
        r.notes,
        r.registered_by,
        r.registered_at
      FROM receivings r
      ORDER BY r.registered_at DESC
      LIMIT ?
    `).all(limit) as {
      id: number;
      receipt_date: string;
      notes: string;
      registered_by: string;
      registered_at: string;
    }[];

    // Get line items for each receiving
    const result = receivings.map((receiving) => {
      const items = db.prepare(`
        SELECT
          ri.id,
          ri.receiving_id,
          ri.product_id,
          ri.received_quantity,
          p.product_code,
          p.product_name
        FROM receiving_items ri
        JOIN products p ON ri.product_id = p.id
        WHERE ri.receiving_id = ?
        ORDER BY ri.id ASC
      `).all(receiving.id);

      return { ...receiving, items };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

interface ReceivingLineItem {
  product_id: number;
  quantity: number;
}

/**
 * POST /api/receivings
 * Create a receiving with line items.
 * Body: { receipt_date: string, notes?: string, items: [{ product_id, quantity }] }
 *
 * Spec: §2-11 (validation), §3-11 (save)
 */
export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { receipt_date, notes = "", items } = body as {
      receipt_date: string;
      notes?: string;
      items: ReceivingLineItem[];
    };

    // §2-11 Validation
    if (!receipt_date) {
      return NextResponse.json(
        { success: false, error: "Please enter a receiving date." },
        { status: 400 }
      );
    }

    // Filter to items with a product selected (product_id > 0)
    const validItems = (items || []).filter(
      (item) => item.product_id && item.product_id > 0
    );

    if (validItems.length === 0) {
      return NextResponse.json(
        { success: false, error: "Please enter at least one line item." },
        { status: 400 }
      );
    }

    // Check each row for quantity >= 1
    for (let i = 0; i < validItems.length; i++) {
      if (!validItems[i].quantity || validItems[i].quantity < 1) {
        return NextResponse.json(
          {
            success: false,
            error: `Please enter a receiving quantity of 1 or more (Row: ${i + 1}).`,
          },
          { status: 400 }
        );
      }
    }

    // Validate product IDs exist
    for (const item of validItems) {
      const product = db.prepare("SELECT id FROM products WHERE id = ?").get(item.product_id);
      if (!product) {
        return NextResponse.json(
          { success: false, error: `Product ID ${item.product_id} not found.` },
          { status: 400 }
        );
      }
    }

    // §3-11 Save
    const createReceiving = db.transaction(() => {
      // Step 1: Create receiving record
      const result = db.prepare(`
        INSERT INTO receivings (receipt_date, notes, registered_by)
        VALUES (?, ?, 'system')
      `).run(receipt_date, notes);

      const receivingId = result.lastInsertRowid;

      // Step 2: Create receiving line items
      const insertItem = db.prepare(`
        INSERT INTO receiving_items (receiving_id, product_id, received_quantity)
        VALUES (?, ?, ?)
      `);

      for (const item of validItems) {
        insertItem.run(receivingId, item.product_id, item.quantity);
      }

      // Step 3: Increment product_inventory.physical_stock (upper limit 999999)
      const updateInventory = db.prepare(`
        UPDATE product_inventory
        SET physical_stock = MIN(physical_stock + ?, 999999)
        WHERE product_id = ?
      `);

      for (const item of validItems) {
        updateInventory.run(item.quantity, item.product_id);
      }

      return receivingId;
    });

    const receivingId = createReceiving();

    return NextResponse.json({
      success: true,
      data: { id: receivingId },
      message: "Receiving registered successfully.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
