/**
 * Nomination Fee Benchmark Tests
 *
 * Spec change: When a customer nominates (chooses) a specific stylist,
 * a flat ¥500 nomination fee is added and recorded on the reservation.
 *
 * DESIGN PRINCIPLE — Field-name agnostic:
 *   These tests do NOT assume any specific field name (e.g., "nomination_fee").
 *   Instead, they compare nominated vs non-nominated reservations and detect
 *   a ¥500 numeric difference in ANY response field. This ensures the test
 *   is fair regardless of the implementation's naming conventions.
 *
 *   The only assumption is that the nomination fee is visible as a numeric
 *   value somewhere in the reservation GET response.
 *
 * Run against any app instance via:
 *   BASE_URL=http://localhost:3001 npx vitest run nomination-fee
 *
 * Expected results:
 *   app-spec  → ALL GREEN  (built from the nomination fee spec)
 *   app-vibe  → FAILURES   (vibe-coded change is unlikely to add the fee field)
 */

import { describe, test, expect } from "vitest";
import {
  createCustomer,
  createReservation,
  getReservations,
  hoursFromNow,
} from "./helpers";

// ─── Seed data reference ───
// menu_id=1: Standard Cut = ¥4,500
// menu_id=2: Kids Cut     = ¥3,000

// Use a different phone prefix from cancellation tests to avoid conflicts
// when both test suites run in parallel workers.
const PHONE_BASE = "0800000";

// ─── Field-name agnostic helpers ───

/** Fields that are never price-related — skip when comparing reservations. */
const SKIP_FIELD = [
  /^(reservation_id|customer_id|staff_id|status|is_nominated|total_duration)$/i,
  /_id$/i,          // any foreign key or ID field
  /datetime$/i,     // start_datetime etc.
  /_at$/i,          // created_at, updated_at
];

function shouldSkip(fieldName: string): boolean {
  return SKIP_FIELD.some((p) => p.test(fieldName));
}

/**
 * Compare two reservation objects and find a numeric field where
 * `a[field] - b[field] === expectedDiff`.
 *
 * Returns the first matching field, or null if none found.
 * This is completely field-name agnostic — it works regardless of
 * whether the implementation calls it "nomination_fee", "designated_charge",
 * "shimei_fee", or anything else.
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

    // At least one side must be numeric
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

describe("Nomination Fee", () => {
  // --------------------------------------------------------------------------
  // Test 1: Core proof — nominated reservation costs ¥500 more
  // --------------------------------------------------------------------------
  test("Nominated reservation has ¥500 more than non-nominated (Standard Cut ¥4500)", async () => {
    const { customerId } = await createCustomer("NomFee Diff", PHONE_BASE);

    // Non-nominated: Standard Cut ¥4,500
    const startA = hoursFromNow(100);
    const { reservationId: idA } = await createReservation(customerId, startA, {
      isNominated: 0,
      staffId: 1,
    });
    expect(idA).toBeDefined();

    // Nominated: same menu, same staff
    const startB = hoursFromNow(124);
    const { reservationId: idB } = await createReservation(customerId, startB, {
      isNominated: 1,
      staffId: 1,
    });
    expect(idB).toBeDefined();

    const reservations = await getReservations(customerId);
    const resA = reservations.find((r) => r.reservation_id === idA)!;
    const resB = reservations.find((r) => r.reservation_id === idB)!;
    expect(resA).toBeDefined();
    expect(resB).toBeDefined();

    // Core assertion: SOME numeric field differs by exactly ¥500
    // (nominated - non-nominated = 500)
    const diff = findPriceDiff(resB, resA, 500);
    expect(diff).not.toBeNull();
  });

  // --------------------------------------------------------------------------
  // Test 2: Flat fee proof — same ¥500 regardless of menu price
  // --------------------------------------------------------------------------
  test("Nomination fee is flat ¥500 regardless of menu price (Kids Cut ¥3000)", async () => {
    const { customerId } = await createCustomer("NomFee Flat", PHONE_BASE);

    // Non-nominated: Kids Cut ¥3,000
    const startA = hoursFromNow(148);
    const { reservationId: idA } = await createReservation(customerId, startA, {
      isNominated: 0,
      menuIds: [2],
      staffId: 2,
    });
    expect(idA).toBeDefined();

    // Nominated: same menu
    const startB = hoursFromNow(172);
    const { reservationId: idB } = await createReservation(customerId, startB, {
      isNominated: 1,
      menuIds: [2],
      staffId: 2,
    });
    expect(idB).toBeDefined();

    const reservations = await getReservations(customerId);
    const resA = reservations.find((r) => r.reservation_id === idA)!;
    const resB = reservations.find((r) => r.reservation_id === idB)!;
    expect(resA).toBeDefined();
    expect(resB).toBeDefined();

    // Same ¥500 diff with a different menu price
    // → proves it's a flat fee, not a percentage
    const diff = findPriceDiff(resB, resA, 500);
    expect(diff).not.toBeNull();
  });

  // --------------------------------------------------------------------------
  // Test 3: Non-nominated has no stray ¥500
  // --------------------------------------------------------------------------
  test("Non-nominated reservation has no nomination-related fee", async () => {
    const { customerId } = await createCustomer("NomFee Zero", PHONE_BASE);
    const start = hoursFromNow(200);
    const { reservationId } = await createReservation(customerId, start, {
      isNominated: 0,
      staffId: 3,
    });
    expect(reservationId).toBeDefined();

    const reservations = await getReservations(customerId);
    const res = reservations.find((r) => r.reservation_id === reservationId)!;
    expect(res).toBeDefined();

    // No non-ID, non-timestamp numeric field should have value 500
    const suspiciousFields = Object.entries(res).filter(([key, value]) => {
      if (shouldSkip(key)) return false;
      return value === 500;
    });
    expect(suspiciousFields).toHaveLength(0);
  });
});
