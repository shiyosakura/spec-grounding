/**
 * BtoB Sales Management — Test helpers
 *
 * BASE_URL env var selects the target app (default: http://localhost:3001).
 * Each helper wraps a single API call and returns parsed JSON.
 */

declare const __BASE_URL__: string | undefined;

function getBase(): string {
  const url =
    (typeof __BASE_URL__ !== "undefined" ? __BASE_URL__ : undefined) ??
    // @ts-expect-error import.meta.env may have custom property
    (typeof import.meta !== "undefined" ? import.meta.env?.BASE_URL_OVERRIDE : undefined) ??
    process.env.BASE_URL ??
    "http://localhost:3001";
  return url.replace(/\/+$/, "");
}

async function api(path: string, init?: RequestInit) {
  const url = `${getBase()}${path}`;
  const res = await fetch(url, init);
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

function post(path: string, data: unknown) {
  return api(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

// ── Customers ──

let customerSeq = 0;

export async function createSalesCustomer(
  name: string,
  creditLimit: number,
  closingDay = 0
) {
  customerSeq++;
  const code = `TST-${String(customerSeq).padStart(3, "0")}`;
  const { status, body } = await post("/api/customers", {
    customer_code: code,
    customer_name: name,
    address: "東京都千代田区1-1",
    phone: `03-0000-${String(customerSeq).padStart(4, "0")}`,
    email: `test${customerSeq}@example.com`,
    closing_day: closingDay,
    credit_limit: creditLimit,
  });
  return { status, customerId: body?.data?.id as number, body };
}

export async function getCustomerDetail(customerId: number) {
  const { status, body } = await api(`/api/customers/${customerId}`);
  return { status, data: body?.data ?? body, body };
}

// ── Products & Inventory ──

export async function getProducts() {
  const { body } = await api("/api/products");
  return (body?.data ?? []) as Array<{
    id: number;
    product_code: string;
    product_name: string;
    standard_unit_price: number;
    [key: string]: unknown;
  }>;
}

export async function registerReceiving(items: { product_id: number; quantity: number }[]) {
  const today = new Date().toISOString().slice(0, 10);
  const { status, body } = await post("/api/receivings", {
    receipt_date: today,
    notes: "Test receiving",
    items,
  });
  return { status, body };
}

// ── Orders ──

export async function createDirectOrder(
  customerId: number,
  items: { product_id: number; quantity: number; unit_price: number }[]
) {
  const { status, body } = await post("/api/orders", {
    customer_id: customerId,
    subject: "Test order",
    items,
  });
  return {
    status,
    orderId: body?.data?.orderId as number | undefined,
    orderNumber: body?.data?.orderNumber as string | undefined,
    creditWarning: body?.data?.creditWarning as number | undefined,
    body,
  };
}

export async function getOrderDetail(orderId: number) {
  const { status, body } = await api(`/api/orders/${orderId}`);
  return { status, data: body?.data ?? body, body };
}

// ── Shipping ──

export async function getShippingInstructions(orderId?: number) {
  const path = "/api/shipping-instructions?status=-1";
  const { body } = await api(path);
  const all = (body?.data ?? []) as Array<{
    id: number;
    order_id: number;
    status: number;
    [key: string]: unknown;
  }>;
  if (orderId !== undefined) {
    return all.filter((si) => si.order_id === orderId);
  }
  return all;
}

export async function getShippingInstructionDetail(instructionId: number) {
  const { body } = await api(`/api/shipping-instructions/${instructionId}`);
  return body?.data as {
    id: number;
    items: Array<{
      id: number;
      instructed_quantity: number;
      shipped_quantity: number;
      [key: string]: unknown;
    }>;
    [key: string]: unknown;
  };
}

export async function shipItems(
  instructionId: number,
  items: { shipping_instruction_item_id: number; quantity: number }[]
) {
  const { status, body } = await post(
    `/api/shipping-instructions/${instructionId}/ship`,
    { items }
  );
  return { status, body };
}

/** Ship all items for a given order (full shipment). */
export async function shipAllForOrder(orderId: number) {
  const instructions = await getShippingInstructions(orderId);
  if (instructions.length === 0) throw new Error(`No shipping instruction for order ${orderId}`);
  const si = instructions[0];
  const detail = await getShippingInstructionDetail(si.id);
  const items = detail.items.map((it) => ({
    shipping_instruction_item_id: it.id,
    quantity: it.instructed_quantity - it.shipped_quantity,
  }));
  return shipItems(si.id, items);
}

// ── Invoices ──

export async function generateInvoices(
  billingPeriod: string,
  customerId?: number
) {
  const payload: Record<string, unknown> = { billing_period: billingPeriod };
  if (customerId !== undefined) {
    payload.customer_mode = 1;
    payload.selected_customer_ids = [customerId];
  } else {
    payload.customer_mode = 0;
  }
  const { status, body } = await post("/api/invoices/generate", payload);
  return { status, invoicesCreated: body?.data?.invoices_created as number, body };
}

export async function getInvoices(customerId?: number) {
  const { body } = await api("/api/invoices?status=-1");
  const all = (body?.data ?? []) as Array<{
    id: number;
    customer_id: number;
    invoice_amount: number;
    status: number;
    [key: string]: unknown;
  }>;
  if (customerId !== undefined) {
    return all.filter((inv) => inv.customer_id === customerId);
  }
  return all;
}

// ── Payments ──

export async function registerPayment(
  customerId: number,
  amount: number,
  date?: string
) {
  const paymentDate = date ?? new Date().toISOString().slice(0, 10);
  const { status, body } = await post("/api/payments/register", {
    customer_id: customerId,
    payment_amount: amount,
    payment_date: paymentDate,
    payment_method: 0,
    notes: "Test payment",
  });
  return { status, paymentId: body?.data?.id as number, body };
}

// ── Reconciliation ──

export async function reconcilePayment(
  paymentId: number,
  entries: { invoice_id: number; amount: number }[]
) {
  const { status, body } = await post("/api/payment-reconciliation", {
    payment_id: paymentId,
    reconciliation_entries: entries,
  });
  return { status, body };
}

// ── Composite: Full Billing Cycle ──

/**
 * Execute a complete billing cycle for one order:
 * ship all → generate invoice → register payment → reconcile
 *
 * Returns the invoice amount paid.
 */
export async function fullBillingCycle(
  customerId: number,
  orderId: number
): Promise<{ invoiceAmount: number }> {
  // 1. Ship all items
  await shipAllForOrder(orderId);

  // 2. Generate invoice
  const billingPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM
  await generateInvoices(billingPeriod, customerId);

  // 3. Find the invoice
  const invoices = await getInvoices(customerId);
  const unpaid = invoices.filter((inv) => inv.status === 1);
  if (unpaid.length === 0) throw new Error("No unpaid invoice found after generation");
  const invoice = unpaid[unpaid.length - 1]; // latest

  // 4. Register payment for exact invoice amount
  const { paymentId } = await registerPayment(customerId, invoice.invoice_amount);

  // 5. Reconcile
  await reconcilePayment(paymentId, [
    { invoice_id: invoice.id, amount: invoice.invoice_amount },
  ]);

  return { invoiceAmount: invoice.invoice_amount };
}

// ── Returns ──

export async function registerReturn(
  shippingInstructionId: number,
  items: { product_id: number; quantity: number }[]
) {
  const { status, body } = await post(`/api/returns`, {
    shipping_instruction_id: shippingInstructionId,
    items,
  });
  return {
    status,
    returnId: body?.data?.return_id ?? body?.data?.returnId ?? body?.data?.id as number | undefined,
    creditNoteId: body?.data?.credit_note_invoice_id ?? body?.data?.creditNoteInvoiceId ?? body?.data?.creditNoteId as number | undefined,
    body,
  };
}

export async function getInventory(productId?: number) {
  const { body } = await api("/api/inventory");
  const all = (body?.data ?? []) as Array<{
    product_id: number;
    physical_stock: number;
    [key: string]: unknown;
  }>;
  if (productId !== undefined) {
    return all.find((inv) =>
      inv.product_id === productId ||
      (inv as Record<string, unknown>).id === productId
    );
  }
  return all;
}

export async function getInvoiceDetail(invoiceId: number) {
  const { status, body } = await api(`/api/invoices/${invoiceId}`);
  return { status, data: body?.data ?? body, body };
}

// ── Utility ──

/** Current billing period as YYYY-MM. */
export function currentBillingPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}
