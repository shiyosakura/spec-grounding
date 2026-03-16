/**
 * Credit Limit Enforcement — BtoB Sales Benchmark Tests
 *
 * Verifies that credit limit checking is strictly enforced:
 * - Orders exceeding credit limit are REJECTED (not just warned)
 * - After payment cycle completes, credit is released and orders succeed again
 * - Customer detail includes outstanding balance
 * - credit_limit=0 bypasses credit check
 *
 * Run:
 *   BASE_URL=http://localhost:3001 npx vitest run credit-limit
 */

import { describe, test, expect, beforeAll } from "vitest";
import {
  createSalesCustomer,
  createDirectOrder,
  fullBillingCycle,
  getCustomerDetail,
  getInvoices,
  getProducts,
  generateInvoices,
  registerPayment,
  registerReceiving,
  reconcilePayment,
  shipAllForOrder,
  currentBillingPeriod,
} from "./sales-helpers";

// Tax rate is 10% (system default)
// We use product_id=1 (抵抗器 ¥50/個) for predictable amounts

// ¥85,000 (excl tax) = ¥93,500 (incl tax) — fits within ¥100,000 credit limit
const ORDER_A_QTY = 1700; // 1700 × ¥50 = ¥85,000
const ORDER_A_SUBTOTAL = 85000;
const ORDER_A_TAX = Math.floor(ORDER_A_SUBTOTAL * 10 / 100); // ¥8,500
const ORDER_A_TOTAL = ORDER_A_SUBTOTAL + ORDER_A_TAX; // ¥93,500

// ¥17,000 (excl tax) = ¥18,700 (incl tax) — combined ¥112,200 > ¥100,000
const ORDER_B_QTY = 340; // 340 × ¥50 = ¥17,000
const ORDER_B_SUBTOTAL = 17000;

const CREDIT_LIMIT = 100000;

describe("Credit Limit Enforcement", () => {
  beforeAll(async () => {
    // Ensure sufficient inventory for all tests
    await registerReceiving([{ product_id: 1, quantity: 99999 }]);
  });

  test("Test 1: Order exceeding credit limit is rejected", async () => {
    // Create customer with ¥100,000 credit limit
    const { customerId } = await createSalesCustomer(
      "与信テスト社A",
      CREDIT_LIMIT
    );

    // First order: ¥93,500 (incl tax) — should succeed
    const order1 = await createDirectOrder(customerId, [
      { product_id: 1, quantity: ORDER_A_QTY, unit_price: 50 },
    ]);
    expect(order1.status).toBe(200);
    expect(order1.orderId).toBeDefined();

    // Second order: ¥18,700 (incl tax) — total ¥112,200 > ¥100,000 — should be REJECTED
    const order2 = await createDirectOrder(customerId, [
      { product_id: 1, quantity: ORDER_B_QTY, unit_price: 50 },
    ]);
    expect(order2.status).toBeGreaterThanOrEqual(400);
    expect(order2.status).toBeLessThan(500);
    expect(order2.orderId).toBeUndefined();
  });

  test("Test 2: Credit released after full billing cycle — 3-module cross-cutting", async () => {
    // Create customer with ¥100,000 credit limit
    const { customerId } = await createSalesCustomer(
      "与信テスト社B",
      CREDIT_LIMIT
    );

    // Place order that fits within credit limit
    const order1 = await createDirectOrder(customerId, [
      { product_id: 1, quantity: ORDER_A_QTY, unit_price: 50 },
    ]);
    expect(order1.status).toBe(200);
    const orderId1 = order1.orderId!;

    // Confirm over-limit order is rejected
    const orderBlocked = await createDirectOrder(customerId, [
      { product_id: 1, quantity: ORDER_B_QTY, unit_price: 50 },
    ]);
    expect(orderBlocked.status).toBeGreaterThanOrEqual(400);

    // Execute full billing cycle: ship → invoice → payment → reconcile
    await fullBillingCycle(customerId, orderId1);

    // NOW the credit should be released — same order should succeed
    const orderAfterPayment = await createDirectOrder(customerId, [
      { product_id: 1, quantity: ORDER_B_QTY, unit_price: 50 },
    ]);
    expect(orderAfterPayment.status).toBe(200);
    expect(orderAfterPayment.orderId).toBeDefined();
  });

  test("Test 3: Outstanding balance field appears on customer detail", async () => {
    const { customerId } = await createSalesCustomer(
      "与信テスト社C",
      CREDIT_LIMIT
    );

    // Get baseline customer detail
    const before = await getCustomerDetail(customerId);
    expect(before.status).toBe(200);

    // Place an order
    await createDirectOrder(customerId, [
      { product_id: 1, quantity: ORDER_A_QTY, unit_price: 50 },
    ]);

    // Get customer detail after order
    const after = await getCustomerDetail(customerId);
    expect(after.status).toBe(200);

    // Find a numeric field that changed to approximately ORDER_A_TOTAL (¥93,500)
    // Field-name agnostic: look for any field that wasn't there before or changed
    const beforeData = before.data as Record<string, unknown>;
    const afterData = after.data as Record<string, unknown>;

    let foundBalance = false;
    for (const key of Object.keys(afterData)) {
      const val = afterData[key];
      if (typeof val === "number" && val > 0) {
        const prevVal = typeof beforeData[key] === "number" ? (beforeData[key] as number) : 0;
        // Check if this field appeared/changed and is close to the expected outstanding amount
        if (val !== prevVal && val >= ORDER_A_SUBTOTAL && val <= ORDER_A_TOTAL) {
          foundBalance = true;
          break;
        }
      }
    }

    expect(foundBalance).toBe(true);
  });

  test("Test 4: credit_limit=0 disables credit check", async () => {
    const { customerId } = await createSalesCustomer("与信テスト社D", 0);

    // Place a huge order — should succeed when credit_limit=0
    const order = await createDirectOrder(customerId, [
      { product_id: 1, quantity: 10000, unit_price: 50 },
    ]);
    expect(order.status).toBe(200);
    expect(order.orderId).toBeDefined();
  });

  test("Test 5: Partial reconciliation does NOT release credit (conservative check)", async () => {
    // The spec uses full invoice amount (not net of reconciliation) for credit check.
    // This is a deliberate conservative business decision that cannot be inferred from
    // natural language alone.

    const { customerId } = await createSalesCustomer(
      "与信テスト社E",
      CREDIT_LIMIT // ¥100,000
    );

    // Order A: ¥93,500 (incl tax) — fits within limit
    const order1 = await createDirectOrder(customerId, [
      { product_id: 1, quantity: ORDER_A_QTY, unit_price: 50 },
    ]);
    expect(order1.status).toBe(200);
    const orderId1 = order1.orderId!;

    // Ship and invoice (but do NOT pay full amount)
    await shipAllForOrder(orderId1);
    const billingPeriod = currentBillingPeriod();
    await generateInvoices(billingPeriod, customerId);

    // Find the invoice
    const invoices = await getInvoices(customerId);
    const invoice = invoices.find((inv) => inv.status === 1);
    expect(invoice).toBeDefined();

    // Partial payment: pay only ¥50,000 of ¥93,500 invoice
    const { paymentId } = await registerPayment(customerId, 50000);
    await reconcilePayment(paymentId, [
      { invoice_id: invoice!.id, amount: 50000 },
    ]);

    // Invoice should now be status=2 (Partially Paid), remaining ¥43,500
    // Credit check per spec: uses FULL invoice amount (¥93,500), not remaining (¥43,500)
    // So: ¥93,500 + ¥18,700 = ¥112,200 > ¥100,000 → should REJECT

    const order2 = await createDirectOrder(customerId, [
      { product_id: 1, quantity: ORDER_B_QTY, unit_price: 50 },
    ]);
    expect(order2.status).toBeGreaterThanOrEqual(400);
    expect(order2.status).toBeLessThan(500);
    expect(order2.orderId).toBeUndefined();
  });
});
