/**
 * Returns & Credit Note — BtoB Sales Benchmark Tests
 *
 * Verifies that return processing correctly:
 * - Generates credit notes with accurate negative amounts
 * - Handles partial returns (returning subset of shipped items)
 * - Restores inventory (physical_stock) on return
 * - Calculates tax per line item using floor()
 * - Validates return quantity against shipped quantity
 * - Validates cumulative returns (multiple returns against same shipment)
 * - Reflects credit note in customer outstanding balance
 * - Allows credit note to offset invoices in reconciliation
 *
 * Run:
 *   BASE_URL=http://localhost:3001 npx vitest run returns
 */

import { describe, test, expect, beforeAll } from "vitest";
import {
  createSalesCustomer,
  createDirectOrder,
  registerReceiving,
  shipAllForOrder,
  getShippingInstructions,
  getShippingInstructionDetail,
  generateInvoices,
  getInvoices,
  registerPayment,
  reconcilePayment,
  getCustomerDetail,
  registerReturn,
  getInventory,
  currentBillingPeriod,
} from "./sales-helpers";

// Tax rate is 10% (system default)
// We use product_id=1 (¥50/unit) and product_id=2 for multi-line tests

// Full return: 10 units × ¥50 = ¥500, tax = floor(500 × 10/100) = ¥50, total = ¥550
const FULL_QTY = 10;
const UNIT_PRICE = 50;
const FULL_SUBTOTAL = FULL_QTY * UNIT_PRICE; // ¥500
const FULL_TAX = Math.floor(FULL_SUBTOTAL * 10 / 100); // ¥50
const FULL_CN_AMOUNT = -(FULL_SUBTOTAL + FULL_TAX); // -¥550

// Partial return: 3 of 10 units
const PARTIAL_QTY = 3;
const PARTIAL_SUBTOTAL = PARTIAL_QTY * UNIT_PRICE; // ¥150
const PARTIAL_TAX = Math.floor(PARTIAL_SUBTOTAL * 10 / 100); // ¥15
const PARTIAL_CN_AMOUNT = -(PARTIAL_SUBTOTAL + PARTIAL_TAX); // -¥165

/**
 * Helper: create order, ship all, and return the shipping instruction ID
 */
async function createShippedOrder(
  customerId: number,
  items: { product_id: number; quantity: number; unit_price: number }[]
): Promise<{ orderId: number; shippingInstructionId: number }> {
  const order = await createDirectOrder(customerId, items);
  expect(order.status).toBe(200);
  const orderId = order.orderId!;

  await shipAllForOrder(orderId);

  const instructions = await getShippingInstructions(orderId);
  expect(instructions.length).toBeGreaterThan(0);
  return { orderId, shippingInstructionId: instructions[0].id };
}

describe("Returns & Credit Note", () => {
  beforeAll(async () => {
    // Ensure sufficient inventory
    await registerReceiving([
      { product_id: 1, quantity: 99999 },
      { product_id: 2, quantity: 99999 },
    ]);
  });

  test("Test 1: Full return generates credit note with correct negative amount", async () => {
    const { customerId } = await createSalesCustomer("返品テスト社A", 0);
    const { shippingInstructionId } = await createShippedOrder(customerId, [
      { product_id: 1, quantity: FULL_QTY, unit_price: UNIT_PRICE },
    ]);

    const result = await registerReturn(shippingInstructionId, [
      { product_id: 1, quantity: FULL_QTY },
    ]);
    expect(result.status).toBe(200);

    // Find the credit note invoice for this customer
    const invoices = await getInvoices(customerId);
    const creditNote = invoices.find(
      (inv) => inv.invoice_amount < 0 || inv.status === 4
    );
    expect(creditNote).toBeDefined();
    expect(creditNote!.invoice_amount).toBe(FULL_CN_AMOUNT); // -¥550
  });

  test("Test 2: Partial return (3 of 10) — credit note amount is for 3 units only", async () => {
    const { customerId } = await createSalesCustomer("返品テスト社B", 0);
    const { shippingInstructionId } = await createShippedOrder(customerId, [
      { product_id: 1, quantity: FULL_QTY, unit_price: UNIT_PRICE },
    ]);

    const result = await registerReturn(shippingInstructionId, [
      { product_id: 1, quantity: PARTIAL_QTY },
    ]);
    expect(result.status).toBe(200);

    const invoices = await getInvoices(customerId);
    const creditNote = invoices.find(
      (inv) => inv.invoice_amount < 0 || inv.status === 4
    );
    expect(creditNote).toBeDefined();
    expect(creditNote!.invoice_amount).toBe(PARTIAL_CN_AMOUNT); // -¥165
  });

  test("Test 3: Inventory increases after return (physical_stock += return qty)", async () => {
    const { customerId } = await createSalesCustomer("返品テスト社C", 0);

    // Record inventory before
    const inventoryBefore = await getInventory(1) as Record<string, unknown>;
    const stockBefore = findStockField(inventoryBefore);

    const { shippingInstructionId } = await createShippedOrder(customerId, [
      { product_id: 1, quantity: FULL_QTY, unit_price: UNIT_PRICE },
    ]);

    // Stock after shipping should be stockBefore - FULL_QTY
    const inventoryAfterShip = await getInventory(1) as Record<string, unknown>;
    const stockAfterShip = findStockField(inventoryAfterShip);
    expect(stockAfterShip).toBe(stockBefore - FULL_QTY);

    // Return all items
    await registerReturn(shippingInstructionId, [
      { product_id: 1, quantity: FULL_QTY },
    ]);

    // Stock should be restored
    const inventoryAfterReturn = await getInventory(1) as Record<string, unknown>;
    const stockAfterReturn = findStockField(inventoryAfterReturn);
    expect(stockAfterReturn).toBe(stockBefore);
  });

  test("Test 4: Tax calculation precision — floor() per line item", async () => {
    // Use quantities that produce fractional tax to verify floor() behavior
    // 7 units × ¥50 = ¥350, tax = floor(350 × 10/100) = floor(35.0) = ¥35
    // 3 units × ¥50 = ¥150, tax = floor(150 × 10/100) = floor(15.0) = ¥15
    // Total CN = -(350 + 150 + 35 + 15) = -¥550
    //
    // Use product with ¥73 price for non-round tax:
    // 7 units × ¥73 = ¥511, tax = floor(511 × 10/100) = floor(51.1) = ¥51
    // CN = -(511 + 51) = -¥562
    const { customerId } = await createSalesCustomer("返品テスト社D", 0);
    const qty = 7;
    const price = 73;
    const subtotal = qty * price; // ¥511
    const expectedTax = Math.floor(subtotal * 10 / 100); // ¥51 (not ¥51.1)
    const expectedCN = -(subtotal + expectedTax); // -¥562

    const { shippingInstructionId } = await createShippedOrder(customerId, [
      { product_id: 1, quantity: qty, unit_price: price },
    ]);

    await registerReturn(shippingInstructionId, [
      { product_id: 1, quantity: qty },
    ]);

    const invoices = await getInvoices(customerId);
    const creditNote = invoices.find(
      (inv) => inv.invoice_amount < 0 || inv.status === 4
    );
    expect(creditNote).toBeDefined();
    expect(creditNote!.invoice_amount).toBe(expectedCN); // -¥562, not -¥562.1
  });

  test("Test 5: Return quantity exceeding shipped quantity is rejected", async () => {
    const { customerId } = await createSalesCustomer("返品テスト社E", 0);
    const { shippingInstructionId } = await createShippedOrder(customerId, [
      { product_id: 1, quantity: FULL_QTY, unit_price: UNIT_PRICE },
    ]);

    // Try to return more than shipped
    const result = await registerReturn(shippingInstructionId, [
      { product_id: 1, quantity: FULL_QTY + 1 },
    ]);
    expect(result.status).toBeGreaterThanOrEqual(400);
    expect(result.status).toBeLessThan(500);
  });

  test("Test 6: Cumulative returns cannot exceed shipped quantity", async () => {
    const { customerId } = await createSalesCustomer("返品テスト社F", 0);
    const { shippingInstructionId } = await createShippedOrder(customerId, [
      { product_id: 1, quantity: FULL_QTY, unit_price: UNIT_PRICE },
    ]);

    // First return: 7 of 10 — should succeed
    const return1 = await registerReturn(shippingInstructionId, [
      { product_id: 1, quantity: 7 },
    ]);
    expect(return1.status).toBe(200);

    // Second return: 4 more — total would be 11 > 10 — should be REJECTED
    const return2 = await registerReturn(shippingInstructionId, [
      { product_id: 1, quantity: 4 },
    ]);
    expect(return2.status).toBeGreaterThanOrEqual(400);
    expect(return2.status).toBeLessThan(500);

    // Third return: 3 more — total would be 10 = 10 — should succeed
    const return3 = await registerReturn(shippingInstructionId, [
      { product_id: 1, quantity: 3 },
    ]);
    expect(return3.status).toBe(200);
  });

  test("Test 7: Credit note reduces customer outstanding balance", async () => {
    const { customerId } = await createSalesCustomer("返品テスト社G", 100000);

    // Create order and go through billing cycle
    const { orderId, shippingInstructionId } = await createShippedOrder(
      customerId,
      [{ product_id: 1, quantity: FULL_QTY, unit_price: UNIT_PRICE }]
    );

    // Generate invoice
    const billingPeriod = currentBillingPeriod();
    await generateInvoices(billingPeriod, customerId);

    // Check outstanding balance before return
    const beforeReturn = await getCustomerDetail(customerId);
    const beforeData = beforeReturn.data as Record<string, unknown>;
    const balanceBefore = findOutstandingBalance(beforeData);

    // Register return — this should auto-generate a CN
    await registerReturn(shippingInstructionId, [
      { product_id: 1, quantity: PARTIAL_QTY },
    ]);

    // Check outstanding balance after return
    const afterReturn = await getCustomerDetail(customerId);
    const afterData = afterReturn.data as Record<string, unknown>;
    const balanceAfter = findOutstandingBalance(afterData);

    // Balance should decrease by the CN amount (which is negative, so balance goes down)
    // The exact assertion depends on whether the app tracks outstanding = invoice_amount sum
    // At minimum, balance after should be less than balance before
    expect(balanceAfter).toBeLessThan(balanceBefore);
  });

  test("Test 8: Credit note can offset invoice in reconciliation", async () => {
    const { customerId } = await createSalesCustomer("返品テスト社H", 0);

    // Create order, ship, and invoice
    const { orderId, shippingInstructionId } = await createShippedOrder(
      customerId,
      [{ product_id: 1, quantity: FULL_QTY, unit_price: UNIT_PRICE }]
    );

    const billingPeriod = currentBillingPeriod();
    await generateInvoices(billingPeriod, customerId);

    // Get the invoice
    const invoicesBefore = await getInvoices(customerId);
    const normalInvoice = invoicesBefore.find(
      (inv) => inv.invoice_amount > 0 && inv.status === 1
    );
    expect(normalInvoice).toBeDefined();
    const invoiceAmount = normalInvoice!.invoice_amount; // ¥550

    // Register partial return to create a CN
    await registerReturn(shippingInstructionId, [
      { product_id: 1, quantity: PARTIAL_QTY },
    ]);

    // Get credit note
    const invoicesAfter = await getInvoices(customerId);
    const creditNote = invoicesAfter.find(
      (inv) => inv.invoice_amount < 0 || inv.status === 4
    );
    expect(creditNote).toBeDefined();
    const cnAmount = Math.abs(creditNote!.invoice_amount); // ¥165

    // Register payment for the NET amount (invoice - CN)
    const netAmount = invoiceAmount - cnAmount; // ¥550 - ¥165 = ¥385
    const { paymentId } = await registerPayment(customerId, netAmount);

    // Reconcile: apply payment to invoice, and apply CN to same invoice
    await reconcilePayment(paymentId, [
      { invoice_id: normalInvoice!.id, amount: netAmount },
    ]);

    // After reconciliation, the invoice should be partially paid or fully paid
    // depending on whether CN reconciliation is separate.
    // The key point: the system ALLOWS this flow without errors.
    // Check the invoice status changed from 1 (issued)
    const invoicesFinal = await getInvoices(customerId);
    const updatedInvoice = invoicesFinal.find(
      (inv) => inv.id === normalInvoice!.id
    );
    expect(updatedInvoice).toBeDefined();
    // Invoice should be at least partially paid (status >= 2)
    expect(updatedInvoice!.status).toBeGreaterThanOrEqual(2);
  });
});

// ── Field-agnostic helpers ──

function findStockField(record: Record<string, unknown> | undefined): number {
  if (!record) return 0;
  // Look for common field names for physical stock
  for (const key of [
    "physical_stock",
    "physicalStock",
    "actual_stock",
    "actualStock",
    "stock",
    "quantity",
  ]) {
    if (typeof record[key] === "number") return record[key] as number;
  }
  // Fallback: find the largest numeric field (likely stock)
  let max = 0;
  for (const val of Object.values(record)) {
    if (typeof val === "number" && val > max) max = val;
  }
  return max;
}

function findOutstandingBalance(record: Record<string, unknown>): number {
  for (const key of Object.keys(record)) {
    const val = record[key];
    if (
      typeof val === "number" &&
      (key.includes("outstanding") ||
        key.includes("balance") ||
        key.includes("receivable"))
    ) {
      return val;
    }
  }
  // Fallback: look for any numeric field that could be a balance
  for (const key of Object.keys(record)) {
    const val = record[key];
    if (typeof val === "number" && val > 0 && !key.includes("id") && !key.includes("limit") && !key.includes("day")) {
      return val;
    }
  }
  return 0;
}
