import { NextRequest, NextResponse } from "next/server";
import { getDb, generateNumber, getTaxRate } from "@/lib/db";

// §3-9: Order Conversion + Credit Check + Order Confirmation (Chained)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const quotationId = parseInt(id, 10);

    const quotation = db
      .prepare("SELECT * FROM quotations WHERE id = ?")
      .get(quotationId) as {
      id: number;
      customer_id: number;
      subject: string;
      status: number;
    } | undefined;

    if (!quotation) {
      return NextResponse.json(
        { success: false, error: "Quotation not found" },
        { status: 404 }
      );
    }

    // §2-9: Guard condition - status must be 1 (Submitted)
    if (quotation.status !== 1) {
      return NextResponse.json(
        { success: false, error: "Only submitted quotations can be converted to orders." },
        { status: 400 }
      );
    }

    const quotationItems = db
      .prepare("SELECT * FROM quotation_items WHERE quotation_id = ?")
      .all(quotationId) as {
      id: number;
      product_id: number;
      product_name_snapshot: string;
      quantity: number;
      unit_price: number;
    }[];

    const taxRate = getTaxRate();
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);

    const orderNumber = generateNumber("order_number_prefix", "orders", "order_number");
    const shippingInstructionNumber = generateNumber(
      "shipping_instruction_number_prefix",
      "shipping_instructions",
      "shipping_instruction_number"
    );

    const result = db.transaction(() => {
      // === Order Conversion Phase (§3-9 steps 1-5) ===

      // Step 2: Create Order Data
      const orderInfo = db
        .prepare(
          `INSERT INTO orders (order_number, customer_id, quotation_id, subject, status, credit_warning, ordered_at, updated_at, discount_rate, discount_amount)
           VALUES (?, ?, ?, ?, 0, 0, ?, ?, 0, 0)`
        )
        .run(orderNumber, quotation.customer_id, quotationId, quotation.subject, now, now);
      const orderId = orderInfo.lastInsertRowid as number;

      // Step 3: Create Order Line Items from quotation line items
      const insertOrderItem = db.prepare(
        `INSERT INTO order_items (order_id, product_id, product_name_snapshot, quantity, unit_price, shipped_quantity)
         VALUES (?, ?, ?, ?, ?, 0)`
      );
      for (const qi of quotationItems) {
        insertOrderItem.run(orderId, qi.product_id, qi.product_name_snapshot, qi.quantity, qi.unit_price);
      }

      // Step 4-5: Update quotation status to 2 (Ordered)
      db.prepare("UPDATE quotations SET status = 2, updated_at = ? WHERE id = ?").run(now, quotationId);

      // === Volume Discount Phase (§3-9 step 5.5-5.6) ===
      const thisOrderSubtotalRow = db
        .prepare(
          `SELECT COALESCE(SUM(quantity * unit_price), 0) as subtotal FROM order_items WHERE order_id = ?`
        )
        .get(orderId) as { subtotal: number };
      const thisOrderSubtotal = thisOrderSubtotalRow.subtotal;

      let discountRate = 0;
      if (thisOrderSubtotal >= 500000) {
        discountRate = 10;
      } else if (thisOrderSubtotal >= 100000) {
        discountRate = 5;
      }
      const discountAmount = Math.floor((thisOrderSubtotal * discountRate) / 100);

      db.prepare("UPDATE orders SET discount_rate = ?, discount_amount = ? WHERE id = ?")
        .run(discountRate, discountAmount, orderId);

      // === Credit Check Phase (§3-9 steps 6-7, using discounted amounts) ===
      const customer = db
        .prepare("SELECT credit_limit FROM customers WHERE id = ?")
        .get(quotation.customer_id) as { credit_limit: number };

      let creditWarning = 0;

      if (customer.credit_limit >= 1) {
        // Sum billing_amount from outstanding invoices (status 1=Issued or 2=Partially Paid)
        const billingTotal = db
          .prepare(
            `SELECT COALESCE(SUM(invoice_amount), 0) as total
             FROM invoices
             WHERE customer_id = ? AND status IN (1, 2)`
          )
          .get(quotation.customer_id) as { total: number };

        // Sum order amounts for confirmed orders not yet billed, excluding newly created order
        const unbilledOrders = db
          .prepare(
            `SELECT o.id, o.discount_amount FROM orders o
             WHERE o.customer_id = ? AND o.status = 0 AND o.id != ?
             AND NOT EXISTS (
               SELECT 1 FROM invoice_items ii
               INNER JOIN order_items oi ON ii.order_item_id = oi.id
               WHERE oi.order_id = o.id
             )`
          )
          .all(quotation.customer_id, orderId) as { id: number; discount_amount: number }[];

        let unbilledOrderTotal = 0;
        for (const uo of unbilledOrders) {
          const orderSubtotalRow = db
            .prepare(
              `SELECT COALESCE(SUM(quantity * unit_price), 0) as subtotal FROM order_items WHERE order_id = ?`
            )
            .get(uo.id) as { subtotal: number };
          const discountedSubtotal = orderSubtotalRow.subtotal - uo.discount_amount;
          const taxAmount = Math.floor((discountedSubtotal * taxRate) / 100);
          unbilledOrderTotal += discountedSubtotal + taxAmount;
        }

        // This order's discounted amount
        const thisDiscountedSubtotal = thisOrderSubtotal - discountAmount;
        const thisOrderTax = Math.floor((thisDiscountedSubtotal * taxRate) / 100);
        const thisOrderTotal = thisDiscountedSubtotal + thisOrderTax;

        const outstandingTotal = billingTotal.total + unbilledOrderTotal + thisOrderTotal;

        if (outstandingTotal > customer.credit_limit) {
          creditWarning = 1;
          db.prepare("UPDATE orders SET credit_warning = 1 WHERE id = ?").run(orderId);
        }
      }

      // === Order Confirmation Phase (§3-9 steps 8-10) ===

      // Step 8: Increment allocation_count in product_inventory
      const orderItems = db
        .prepare("SELECT * FROM order_items WHERE order_id = ?")
        .all(orderId) as { id: number; product_id: number; quantity: number }[];

      for (const oi of orderItems) {
        db.prepare(
          `UPDATE product_inventory
           SET allocated_quantity = MIN(allocated_quantity + ?, 999999)
           WHERE product_id = ?`
        ).run(oi.quantity, oi.product_id);
      }

      // Step 9: Create Shipping Instruction
      const siInfo = db
        .prepare(
          `INSERT INTO shipping_instructions (shipping_instruction_number, order_id, customer_id, status, created_at)
           VALUES (?, ?, ?, 0, ?)`
        )
        .run(shippingInstructionNumber, orderId, quotation.customer_id, now);
      const shippingInstructionId = siInfo.lastInsertRowid as number;

      // Step 10: Create Shipping Instruction Line Items
      const insertSiItem = db.prepare(
        `INSERT INTO shipping_instruction_items (shipping_instruction_id, order_item_id, product_id, instructed_quantity, shipped_quantity)
         VALUES (?, ?, ?, ?, 0)`
      );
      for (const oi of orderItems) {
        insertSiItem.run(shippingInstructionId, oi.id, oi.product_id, oi.quantity);
      }

      return { orderId, orderNumber, creditWarning };
    })();

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to convert quotation to order" },
      { status: 500 }
    );
  }
}
