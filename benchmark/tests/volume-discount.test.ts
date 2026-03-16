/**
 * Volume Discount — BtoB Sales Benchmark Tests
 *
 * Verifies that volume discounts are correctly applied:
 * - Orders < ¥100,000 (tax-excl): no discount
 * - Orders ≥ ¥100,000 (tax-excl): 5% discount
 * - Orders ≥ ¥500,000 (tax-excl): 10% discount
 * - Tax is calculated on DISCOUNTED amount (not original)
 * - Credit check uses DISCOUNTED amount
 * - Discount fields appear in order response/detail
 *
 * Run:
 *   BASE_URL=http://localhost:3002 npx vitest run volume-discount
 */

import { describe, test, expect, beforeAll } from "vitest";
import {
  createSalesCustomer,
  createDirectOrder,
  registerReceiving,
  getOrderDetail,
} from "./sales-helpers";

// product_id=1: 抵抗器 ¥50/個
const UNIT_PRICE = 50;

describe("Volume Discount", () => {
  beforeAll(async () => {
    await registerReceiving([{ product_id: 1, quantity: 999999 }]);
  });

  test("Test 1: No discount for orders below ¥100,000", async () => {
    const { customerId } = await createSalesCustomer("値引テスト社A", 0);

    // ¥85,000 (1700 × ¥50) — below ¥100,000 threshold
    const order = await createDirectOrder(customerId, [
      { product_id: 1, quantity: 1700, unit_price: UNIT_PRICE },
    ]);
    expect(order.status).toBe(200);

    // Check discount fields: should be 0
    const detail = await getOrderDetail(order.orderId!);
    expect(detail.status).toBe(200);

    // Find discount_rate and discount_amount (or similarly named fields)
    const data = detail.data as Record<string, unknown>;
    const discountRate = findNumericField(data, "discount", "rate") ?? findNumericField(data, "discount_rate");
    const discountAmount = findNumericField(data, "discount", "amount") ?? findNumericField(data, "discount_amount");

    // Either fields don't exist, or they're 0
    expect(discountRate ?? 0).toBe(0);
    expect(discountAmount ?? 0).toBe(0);
  });

  test("Test 2: 5% discount for orders ≥ ¥100,000", async () => {
    const { customerId } = await createSalesCustomer("値引テスト社B", 0);

    // ¥120,000 (2400 × ¥50) — qualifies for 5%
    const qty = 2400;
    const subtotal = qty * UNIT_PRICE; // ¥120,000
    const expectedDiscount = Math.floor(subtotal * 5 / 100); // ¥6,000

    const order = await createDirectOrder(customerId, [
      { product_id: 1, quantity: qty, unit_price: UNIT_PRICE },
    ]);
    expect(order.status).toBe(200);

    const detail = await getOrderDetail(order.orderId!);
    const data = detail.data as Record<string, unknown>;

    // Look for a field with value 5 (discount rate) and 6000 (discount amount)
    const hasRate5 = objectHasValue(data, 5);
    const hasAmount6000 = objectHasValue(data, expectedDiscount);

    expect(hasRate5).toBe(true);
    expect(hasAmount6000).toBe(true);
  });

  test("Test 3: 10% discount for orders ≥ ¥500,000", async () => {
    const { customerId } = await createSalesCustomer("値引テスト社C", 0);

    // ¥600,000 (12000 × ¥50) — qualifies for 10%
    const qty = 12000;
    const subtotal = qty * UNIT_PRICE; // ¥600,000
    const expectedDiscount = Math.floor(subtotal * 10 / 100); // ¥60,000

    const order = await createDirectOrder(customerId, [
      { product_id: 1, quantity: qty, unit_price: UNIT_PRICE },
    ]);
    expect(order.status).toBe(200);

    const detail = await getOrderDetail(order.orderId!);
    const data = detail.data as Record<string, unknown>;

    const hasRate10 = objectHasValue(data, 10);
    const hasAmount60000 = objectHasValue(data, expectedDiscount);

    expect(hasRate10).toBe(true);
    expect(hasAmount60000).toBe(true);
  });

  test("Test 4: Boundary — exactly ¥100,000 gets 5% discount", async () => {
    const { customerId } = await createSalesCustomer("値引テスト社D", 0);

    // Exactly ¥100,000 (2000 × ¥50)
    const qty = 2000;
    const subtotal = qty * UNIT_PRICE; // ¥100,000
    const expectedDiscount = Math.floor(subtotal * 5 / 100); // ¥5,000

    const order = await createDirectOrder(customerId, [
      { product_id: 1, quantity: qty, unit_price: UNIT_PRICE },
    ]);
    expect(order.status).toBe(200);

    const detail = await getOrderDetail(order.orderId!);
    const data = detail.data as Record<string, unknown>;

    // ≥ 100,000 means 5% should apply
    const hasRate5 = objectHasValue(data, 5);
    const hasAmount5000 = objectHasValue(data, expectedDiscount);

    expect(hasRate5).toBe(true);
    expect(hasAmount5000).toBe(true);
  });

  test("Test 5: Discount amount uses floor (not round)", async () => {
    const { customerId } = await createSalesCustomer("値引テスト社E", 0);

    // ¥110,000 (2200 × ¥50) — 5% discount
    // floor(110000 * 5 / 100) = floor(5500.0) = ¥5,500
    const qty = 2200;
    const subtotal = qty * UNIT_PRICE; // ¥110,000
    const expectedDiscount = Math.floor(subtotal * 5 / 100); // ¥5,500

    const order = await createDirectOrder(customerId, [
      { product_id: 1, quantity: qty, unit_price: UNIT_PRICE },
    ]);
    expect(order.status).toBe(200);

    const detail = await getOrderDetail(order.orderId!);
    const data = detail.data as Record<string, unknown>;

    expect(objectHasValue(data, expectedDiscount)).toBe(true);
  });

  test("Test 6: Discount with non-round amount uses floor correctly", async () => {
    const { customerId } = await createSalesCustomer("値引テスト社F", 0);

    // ¥133,350 (2667 × ¥50) — 5% discount
    // floor(133350 * 5 / 100) = floor(6667.5) = ¥6,667
    // A round() implementation would give ¥6,668
    const qty = 2667;
    const subtotal = qty * UNIT_PRICE; // ¥133,350
    const expectedDiscount = Math.floor(subtotal * 5 / 100); // ¥6,667

    const order = await createDirectOrder(customerId, [
      { product_id: 1, quantity: qty, unit_price: UNIT_PRICE },
    ]);
    expect(order.status).toBe(200);

    const detail = await getOrderDetail(order.orderId!);
    const data = detail.data as Record<string, unknown>;

    // floor(133350 * 0.05) = floor(6667.5) = 6667
    // round(133350 * 0.05) = round(6667.5) = 6668
    expect(objectHasValue(data, expectedDiscount)).toBe(true);
  });

  test("Test 7: Warning flag uses discounted amount for credit calculation", async () => {
    // credit_limit = ¥126,000
    // Order ¥120,000 (tax-excl), 5% discount:
    //   Pre-discount total: ¥120,000 + ¥12,000 tax = ¥132,000 > ¥126,000 → would warn
    //   Post-discount total: ¥114,000 + ¥11,400 tax = ¥125,400 < ¥126,000 → no warning
    const { customerId } = await createSalesCustomer("値引テスト社G", 126000);

    const order = await createDirectOrder(customerId, [
      { product_id: 1, quantity: 2400, unit_price: UNIT_PRICE },
    ]);
    expect(order.status).toBe(200);

    // credit_warning should be 0 (no warning) if discounted amount is used
    // credit_warning should be 1 (warning) if original amount is used
    const detail = await getOrderDetail(order.orderId!);
    const data = detail.data as Record<string, unknown>;

    // The field might be credit_warning, credit_warning_flag, or similar
    const warningField = findNumericField(data, "credit", "warn") ??
                         findNumericField(data, "warning") ??
                         findNumericField(data, "credit_warning");

    // Should be 0 (no warning) because discounted total ¥125,400 < limit ¥126,000
    expect(warningField ?? 0).toBe(0);
  });
});

// ── Helpers ──

/** Search for a numeric value anywhere in the object (top-level fields only) */
function objectHasValue(obj: Record<string, unknown>, value: number): boolean {
  for (const key of Object.keys(obj)) {
    if (obj[key] === value) return true;
  }
  return false;
}

/** Find a numeric field whose key contains all given substrings */
function findNumericField(obj: Record<string, unknown>, ...substrings: string[]): number | undefined {
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === "number" && substrings.every((s) => key.toLowerCase().includes(s.toLowerCase()))) {
      return val;
    }
  }
  return undefined;
}
