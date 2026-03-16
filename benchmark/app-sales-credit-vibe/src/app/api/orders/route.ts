import { NextRequest, NextResponse } from "next/server";
import { getDb, generateNumber, getTaxRate } from "@/lib/db";

// §3-11, §3-12, §3-13: Order List Retrieval with filter and search
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const filterStatus = parseInt(searchParams.get("status") ?? "-1", 10);
    const searchText = searchParams.get("search") ?? "";

    let query = `
      SELECT o.*, c.customer_name,
        COALESCE(
          (SELECT SUM(oi.quantity * oi.unit_price) FROM order_items oi WHERE oi.order_id = o.id),
          0
        ) as total_amount,
        (SELECT si.status FROM shipping_instructions si WHERE si.order_id = o.id LIMIT 1) as shipping_status
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    // §3-12: Status filter
    if (filterStatus >= 0 && filterStatus <= 5) {
      query += " AND o.status = ?";
      params.push(filterStatus);
    }

    // §3-13: Text search on order_number and customer_name
    if (searchText.trim() !== "") {
      query += " AND (o.order_number LIKE ? OR c.customer_name LIKE ?)";
      const like = `%${searchText.trim()}%`;
      params.push(like, like);
    }

    // Sort by order_date descending
    query += " ORDER BY o.ordered_at DESC";

    const rows = db.prepare(query).all(...params);

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to retrieve orders" },
      { status: 500 }
    );
  }
}

// Direct order creation (same validations as quotation + credit check + order confirmation)
export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { customer_id, subject, items } = body;

    // Validations (same as §2-7)
    if (!customer_id) {
      return NextResponse.json(
        { success: false, error: "Please select a customer." },
        { status: 400 }
      );
    }
    if (!subject || subject.trim() === "") {
      return NextResponse.json(
        { success: false, error: "Please enter a subject." },
        { status: 400 }
      );
    }
    if (!items || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Please add at least one line item row." },
        { status: 400 }
      );
    }
    for (const item of items) {
      if (!item.product_id) {
        return NextResponse.json(
          { success: false, error: "Please set a product for all line item rows." },
          { status: 400 }
        );
      }
      if (!item.quantity || item.quantity < 1) {
        return NextResponse.json(
          { success: false, error: "Please set a quantity of 1 or more for all line item rows." },
          { status: 400 }
        );
      }
    }

    const taxRate = getTaxRate();
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    const orderNumber = generateNumber("order_number_prefix", "orders", "order_number");
    const shippingInstructionNumber = generateNumber(
      "shipping_instruction_number_prefix",
      "shipping_instructions",
      "shipping_instruction_number"
    );

    const result = db.transaction(() => {
      // Create Order
      const orderInfo = db
        .prepare(
          `INSERT INTO orders (order_number, customer_id, quotation_id, subject, status, credit_warning, ordered_at, updated_at)
           VALUES (?, ?, 0, ?, 0, 0, ?, ?)`
        )
        .run(orderNumber, customer_id, subject.trim(), now, now);
      const orderId = orderInfo.lastInsertRowid as number;

      // Create Order Line Items
      const insertOrderItem = db.prepare(
        `INSERT INTO order_items (order_id, product_id, product_name_snapshot, quantity, unit_price, shipped_quantity)
         VALUES (?, ?, ?, ?, ?, 0)`
      );
      for (const item of items) {
        const product = db
          .prepare("SELECT product_name FROM products WHERE id = ?")
          .get(item.product_id) as { product_name: string } | undefined;
        const snapshotName = product?.product_name ?? "";
        insertOrderItem.run(orderId, item.product_id, snapshotName, item.quantity, item.unit_price);
      }

      // Credit Check — reject order if credit limit exceeded
      const customer = db
        .prepare("SELECT credit_limit FROM customers WHERE id = ?")
        .get(customer_id) as { credit_limit: number };

      if (customer.credit_limit >= 1) {
        // Outstanding invoices: invoice_amount minus reconciled amounts
        const billingTotal = db
          .prepare(
            `SELECT COALESCE(SUM(i.invoice_amount - COALESCE(pr.reconciled, 0)), 0) as total
             FROM invoices i
             LEFT JOIN (
               SELECT invoice_id, SUM(reconciled_amount) as reconciled
               FROM payment_reconciliations GROUP BY invoice_id
             ) pr ON pr.invoice_id = i.id
             WHERE i.customer_id = ? AND i.status IN (1, 2)`
          )
          .get(customer_id) as { total: number };

        const unbilledOrders = db
          .prepare(
            `SELECT o.id FROM orders o
             WHERE o.customer_id = ? AND o.status = 0 AND o.id != ?
             AND NOT EXISTS (
               SELECT 1 FROM invoice_items ii
               INNER JOIN order_items oi ON ii.order_item_id = oi.id
               WHERE oi.order_id = o.id
             )`
          )
          .all(customer_id, orderId) as { id: number }[];

        let unbilledOrderTotal = 0;
        for (const uo of unbilledOrders) {
          const orderSubtotal = db
            .prepare(
              `SELECT COALESCE(SUM(quantity * unit_price), 0) as subtotal FROM order_items WHERE order_id = ?`
            )
            .get(uo.id) as { subtotal: number };
          const taxAmount = Math.floor((orderSubtotal.subtotal * taxRate) / 100);
          unbilledOrderTotal += orderSubtotal.subtotal + taxAmount;
        }

        const thisOrderSubtotal = db
          .prepare(
            `SELECT COALESCE(SUM(quantity * unit_price), 0) as subtotal FROM order_items WHERE order_id = ?`
          )
          .get(orderId) as { subtotal: number };
        const thisOrderTax = Math.floor((thisOrderSubtotal.subtotal * taxRate) / 100);
        const thisOrderTotal = thisOrderSubtotal.subtotal + thisOrderTax;

        const outstandingTotal = billingTotal.total + unbilledOrderTotal + thisOrderTotal;

        if (outstandingTotal > customer.credit_limit) {
          throw new Error(`CREDIT_LIMIT_EXCEEDED:${outstandingTotal}:${customer.credit_limit}`);
        }
      }

      // Order Confirmation: Increment allocation
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

      // Create Shipping Instruction
      const siInfo = db
        .prepare(
          `INSERT INTO shipping_instructions (shipping_instruction_number, order_id, customer_id, status, created_at)
           VALUES (?, ?, ?, 0, ?)`
        )
        .run(shippingInstructionNumber, orderId, customer_id, now);
      const shippingInstructionId = siInfo.lastInsertRowid as number;

      // Create Shipping Instruction Line Items
      const insertSiItem = db.prepare(
        `INSERT INTO shipping_instruction_items (shipping_instruction_id, order_item_id, product_id, instructed_quantity, shipped_quantity)
         VALUES (?, ?, ?, ?, 0)`
      );
      for (const oi of orderItems) {
        insertSiItem.run(shippingInstructionId, oi.id, oi.product_id, oi.quantity);
      }

      return { orderId, orderNumber };
    })();

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.startsWith("CREDIT_LIMIT_EXCEEDED:")) {
      const parts = msg.split(":");
      const outstanding = Number(parts[1]);
      const limit = Number(parts[2]);
      return NextResponse.json(
        {
          success: false,
          error: `Credit limit exceeded. Outstanding: ¥${outstanding.toLocaleString()}, Limit: ¥${limit.toLocaleString()}. Order rejected.`,
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to create order" },
      { status: 500 }
    );
  }
}
