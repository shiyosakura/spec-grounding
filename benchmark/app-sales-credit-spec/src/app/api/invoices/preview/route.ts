import { NextRequest, NextResponse } from "next/server";
import { getDb, getTaxRate } from "@/lib/db";

// §3-4: Target Order Line Preview Retrieval
export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { billing_period, customer_mode, selected_customer_ids } = body;

    // §2-4 Guard: billing_period required
    if (!billing_period || billing_period.trim() === "") {
      return NextResponse.json(
        { success: false, error: "Please enter the target year and month." },
        { status: 400 }
      );
    }

    // Validate YYYY-MM format
    const periodMatch = billing_period.match(/^(\d{4})-(\d{2})$/);
    if (!periodMatch) {
      return NextResponse.json(
        { success: false, error: "Please enter the billing period in YYYY-MM format." },
        { status: 400 }
      );
    }

    const year = parseInt(periodMatch[1], 10);
    const month = parseInt(periodMatch[2], 10);

    // §2-4 Guard: individual mode requires at least 1 customer
    if (
      customer_mode === 1 &&
      (!selected_customer_ids || selected_customer_ids.filter((id: number) => id >= 1).length === 0)
    ) {
      return NextResponse.json(
        { success: false, error: "Please select at least one customer." },
        { status: 400 }
      );
    }

    // Step 1: Determine target customer IDs
    let targetCustomers: Array<{ id: number; customer_name: string; closing_day: number }>;
    if (customer_mode === 1) {
      const validIds = (selected_customer_ids as number[]).filter((id) => id >= 1);
      const placeholders = validIds.map(() => "?").join(",");
      targetCustomers = db
        .prepare(`SELECT id, customer_name, closing_day FROM customers WHERE id IN (${placeholders})`)
        .all(...validIds) as Array<{ id: number; customer_name: string; closing_day: number }>;
    } else {
      targetCustomers = db
        .prepare("SELECT id, customer_name, closing_day FROM customers WHERE id >= 1")
        .all() as Array<{ id: number; customer_name: string; closing_day: number }>;
    }

    const taxRate = getTaxRate();
    const previewResults: Array<{
      customer_id: number;
      customer_name: string;
      order_numbers: string[];
      line_item_count: number;
      subtotal: number;
      tax: number;
      estimated_amount: number;
      order_items: Array<{
        order_item_id: number;
        order_id: number;
        product_name_snapshot: string;
        quantity: number;
        unit_price: number;
        shipped_quantity: number;
      }>;
    }> = [];

    for (const customer of targetCustomers) {
      // Calculate closing date cutoff
      let closingDate: string;
      if (customer.closing_day === 0) {
        // End of month
        const lastDay = new Date(year, month, 0).getDate();
        closingDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      } else {
        closingDate = `${year}-${String(month).padStart(2, "0")}-${String(customer.closing_day).padStart(2, "0")}`;
      }

      // Step 2: Find orders with status = 2 (Shipment Complete) for this customer
      // that have unbilled order line items
      // Step 3: Filter by shipment date <= closing date cutoff
      const targetItems = db
        .prepare(
          `SELECT DISTINCT oi.id as order_item_id, oi.order_id, oi.product_id,
                  oi.product_name_snapshot, oi.quantity, oi.unit_price, oi.shipped_quantity,
                  o.order_number
           FROM order_items oi
           JOIN orders o ON oi.order_id = o.id
           WHERE o.customer_id = ?
             AND o.status = 2
             AND oi.id NOT IN (SELECT ii.order_item_id FROM invoice_items ii)
             AND EXISTS (
               SELECT 1 FROM shipping_instruction_items sii
               JOIN shipping_records sr ON sr.shipping_instruction_item_id = sii.id
               WHERE sii.order_item_id = oi.id
                 AND date(sr.shipped_at) <= ?
             )`
        )
        .all(customer.id, closingDate) as Array<{
          order_item_id: number;
          order_id: number;
          product_id: number;
          product_name_snapshot: string;
          quantity: number;
          unit_price: number;
          shipped_quantity: number;
          order_number: string;
        }>;

      if (targetItems.length === 0) continue;

      const orderNumbers = [...new Set(targetItems.map((item) => item.order_number))];
      const subtotal = targetItems.reduce(
        (sum, item) => sum + item.shipped_quantity * item.unit_price,
        0
      );
      const tax = Math.floor(subtotal * taxRate / 100);

      previewResults.push({
        customer_id: customer.id,
        customer_name: customer.customer_name,
        order_numbers: orderNumbers,
        line_item_count: targetItems.length,
        subtotal,
        tax,
        estimated_amount: subtotal + tax,
        order_items: targetItems.map((item) => ({
          order_item_id: item.order_item_id,
          order_id: item.order_id,
          product_name_snapshot: item.product_name_snapshot,
          quantity: item.quantity,
          unit_price: item.unit_price,
          shipped_quantity: item.shipped_quantity,
        })),
      });
    }

    return NextResponse.json({
      success: true,
      data: previewResults,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to retrieve preview data" },
      { status: 500 }
    );
  }
}
