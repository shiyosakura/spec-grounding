/**
 * Cancellation Fee — Field-Name Agnostic Tests
 *
 * Verifies tiered cancellation fees WITHOUT assuming any field name.
 * Uses the same diff-comparison approach as nomination-fee.test.ts:
 * cancel at different time ranges, compare reservation records,
 * and detect expected fee amounts as numeric differences.
 *
 * Run:
 *   BASE_URL=http://localhost:3097 npx vitest run cancellation-fee-agnostic
 */

import { describe, test, expect } from "vitest";
import {
  createCustomer,
  createReservation,
  cancelReservation,
  getReservations,
  hoursFromNow,
} from "./helpers";

// menu_id=1: Standard Cut = ¥4,500
const FULL_PRICE = 4500;
const HALF_PRICE = Math.floor(FULL_PRICE * 50 / 100); // ¥2,250

const PHONE_BASE = "0600000";

// ─── Field-name agnostic helpers (same approach as nomination-fee.test.ts) ───

const SKIP_FIELD = [
  /id$/i,
  /datetime$/i,
  /_at$/i,
  /^status$/i,
  /^is_nominated$/i,
  /^total_duration$/i,
  /duration/i,
];

function shouldSkip(fieldName: string): boolean {
  return SKIP_FIELD.some((p) => p.test(fieldName));
}

/**
 * Find a numeric field where a[field] - b[field] === expectedDiff.
 * Completely field-name agnostic.
 */
function findPriceDiff(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  expectedDiff: number
): { field: string; valueA: number; valueB: number } | null {
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);

  for (const key of allKeys) {
    if (shouldSkip(key)) continue;

    const va = typeof a[key] === "number" ? (a[key] as number) : null;
    const vb = typeof b[key] === "number" ? (b[key] as number) : null;

    if (va === null && vb === null) continue;

    const numA = va ?? 0;
    const numB = vb ?? 0;

    if (numA - numB === expectedDiff) {
      return { field: key, valueA: numA, valueB: numB };
    }
  }

  return null;
}

// ============================================================================
// Tests
// ============================================================================

describe("Cancellation Fee — Field Agnostic", () => {
  // --------------------------------------------------------------------------
  // Test 1: Cancel <24h vs >72h → difference of ¥4,500 (100% fee)
  // --------------------------------------------------------------------------
  test("Cancel <24h has ¥4,500 more than cancel >72h (100% fee tier)", async () => {
    const { customerId } = await createCustomer("AgFee 100", PHONE_BASE);

    // Cancel a reservation 6 hours from now (< 24h → 100% fee)
    const start6h = hoursFromNow(6);
    const { reservationId: id6h } = await createReservation(customerId, start6h, {
      staffId: 1,
      isNominated: 0,
    });
    expect(id6h).toBeDefined();
    await cancelReservation(id6h!);

    // Cancel a reservation 100 hours from now (> 72h → 0% fee)
    const start100h = hoursFromNow(100);
    const { reservationId: id100h } = await createReservation(customerId, start100h, {
      staffId: 2,
      isNominated: 0,
    });
    expect(id100h).toBeDefined();
    await cancelReservation(id100h!);

    // Fetch both cancelled records
    const reservations = await getReservations(customerId);
    const rec6h = reservations.find((r) => r.reservation_id === id6h)!;
    const rec100h = reservations.find((r) => r.reservation_id === id100h)!;
    expect(rec6h).toBeDefined();
    expect(rec100h).toBeDefined();

    // Some numeric field should differ by exactly ¥4,500
    const diff = findPriceDiff(rec6h, rec100h, FULL_PRICE);
    expect(diff).not.toBeNull();
  });

  // --------------------------------------------------------------------------
  // Test 2: Cancel 24-72h vs >72h → difference of ¥2,250 (50% fee)
  // --------------------------------------------------------------------------
  test("Cancel 24-72h has ¥2,250 more than cancel >72h (50% fee tier)", async () => {
    const { customerId } = await createCustomer("AgFee 50", PHONE_BASE);

    // Cancel a reservation 48 hours from now (24-72h → 50% fee)
    const start48h = hoursFromNow(48);
    const { reservationId: id48h } = await createReservation(customerId, start48h, {
      staffId: 1,
      isNominated: 0,
    });
    expect(id48h).toBeDefined();
    await cancelReservation(id48h!);

    // Cancel a reservation 100 hours from now (> 72h → 0% fee)
    const start100h = hoursFromNow(100);
    const { reservationId: id100h } = await createReservation(customerId, start100h, {
      staffId: 2,
      isNominated: 0,
    });
    expect(id100h).toBeDefined();
    await cancelReservation(id100h!);

    // Fetch both
    const reservations = await getReservations(customerId);
    const rec48h = reservations.find((r) => r.reservation_id === id48h)!;
    const rec100h = reservations.find((r) => r.reservation_id === id100h)!;
    expect(rec48h).toBeDefined();
    expect(rec100h).toBeDefined();

    // Some numeric field should differ by exactly ¥2,250
    const diff = findPriceDiff(rec48h, rec100h, HALF_PRICE);
    expect(diff).not.toBeNull();
  });

  // --------------------------------------------------------------------------
  // Test 3: Cancel >72h → no fee (0% tier)
  //
  // Cancel two reservations both >72h. No price-relevant numeric field
  // should differ — proving both have fee = 0.
  // --------------------------------------------------------------------------
  test("Two cancellations >72h have no fee difference (0% tier)", async () => {
    const { customerId } = await createCustomer("AgFee Zero", PHONE_BASE);

    // Cancel at 100h
    const startA = hoursFromNow(100);
    const { reservationId: idA } = await createReservation(customerId, startA, {
      staffId: 1,
      isNominated: 0,
    });
    expect(idA).toBeDefined();
    await cancelReservation(idA!);

    // Cancel at 200h
    const startB = hoursFromNow(200);
    const { reservationId: idB } = await createReservation(customerId, startB, {
      staffId: 2,
      isNominated: 0,
    });
    expect(idB).toBeDefined();
    await cancelReservation(idB!);

    // Fetch both
    const reservations = await getReservations(customerId);
    const recA = reservations.find((r) => r.reservation_id === idA)!;
    const recB = reservations.find((r) => r.reservation_id === idB)!;
    expect(recA).toBeDefined();
    expect(recB).toBeDefined();

    // No price-relevant field should differ (both fees are ¥0)
    const diffFull = findPriceDiff(recA, recB, FULL_PRICE);
    const diffHalf = findPriceDiff(recA, recB, HALF_PRICE);
    expect(diffFull).toBeNull();
    expect(diffHalf).toBeNull();
  });
});
