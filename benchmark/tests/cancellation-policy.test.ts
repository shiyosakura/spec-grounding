/**
 * Cancellation Policy Benchmark Tests
 *
 * These tests verify whether the app correctly implements the TIERED
 * cancellation policy (the "after" spec). The key change:
 *
 *   Before (binary):  < 24h = penalty,  >= 24h = no penalty, no fee tracking
 *   After  (tiered):  < 24h = 100% fee, < 72h = 50% fee, >= 72h = 0% fee
 *
 * Run against any app instance via:
 *   BASE_URL=http://localhost:3001 npm test
 *
 * Expected results:
 *   app-spec  → ALL GREEN  (built from the tiered cancellation spec)
 *   app-vibe  → FAILURES   (vibe-coded change is unlikely to get tiers right)
 */

import { describe, test, expect } from "vitest";
import {
  createCustomer,
  getCustomer,
  createReservation,
  cancelReservation,
  noshowReservation,
  getReservations,
  hoursFromNow,
} from "./helpers";

// ─── Menu prices (from seed data) ───
// menu_id=1: Standard Cut = ¥4,500
const STANDARD_CUT_PRICE = 4500;

// Each test uses a unique day offset to avoid slot conflicts between tests.
// Staff is auto-rotated by the helper's round-robin.

// ============================================================================
// 1. Tiered Cancellation Fee Calculation
// ============================================================================

describe("Tiered Cancellation Fee", () => {
  test("Cancel 72h+ before → fee = ¥0, no penalty", async () => {
    const { customerId, phone } = await createCustomer("Test Free Cancel");
    const start = hoursFromNow(100); // ~4 days → ≥72h tier (0% fee)
    const { reservationId } = await createReservation(customerId, start);
    expect(reservationId).toBeDefined();

    const cancelResult = await cancelReservation(reservationId!);
    expect(cancelResult.status).toBe(200);

    // Verify: reservation has cancellation_fee = 0
    const reservations = await getReservations(customerId);
    const cancelled = reservations.find((r) => r.reservation_id === reservationId);
    expect(cancelled).toBeDefined();
    expect(cancelled!.status).toBe(1); // cancelled
    expect(cancelled!.cancellation_fee).toBe(0);

    // Verify: no penalty increment
    const customer = await getCustomer(phone);
    expect(customer.cancellation_penalty_count).toBe(0);
  });

  test("Cancel 24–72h before → fee = 50% of total price, penalty +1", async () => {
    const { customerId, phone } = await createCustomer("Test Half Fee");
    const start = hoursFromNow(48); // 2 days → 24-72h tier (50% fee)
    const { reservationId } = await createReservation(customerId, start);
    expect(reservationId).toBeDefined();

    const cancelResult = await cancelReservation(reservationId!);
    expect(cancelResult.status).toBe(200);

    // Verify: fee = 50% of ¥4,500 = ¥2,250
    const reservations = await getReservations(customerId);
    const cancelled = reservations.find((r) => r.reservation_id === reservationId);
    expect(cancelled).toBeDefined();
    expect(cancelled!.status).toBe(1);
    expect(cancelled!.cancellation_fee).toBe(Math.floor(STANDARD_CUT_PRICE * 50 / 100));

    // Verify: penalty incremented
    const customer = await getCustomer(phone);
    expect(customer.cancellation_penalty_count).toBe(1);
  });

  test("Cancel < 24h before → fee = 100% of total price, penalty +1", async () => {
    const { customerId, phone } = await createCustomer("Test Full Fee");
    const start = hoursFromNow(6); // 6 hours — use raw offset to avoid weekday adjustment
    const { reservationId } = await createReservation(customerId, start);
    expect(reservationId).toBeDefined();

    const cancelResult = await cancelReservation(reservationId!);
    expect(cancelResult.status).toBe(200);

    // Verify: fee = 100% of ¥4,500 = ¥4,500
    const reservations = await getReservations(customerId);
    const cancelled = reservations.find((r) => r.reservation_id === reservationId);
    expect(cancelled).toBeDefined();
    expect(cancelled!.status).toBe(1);
    expect(cancelled!.cancellation_fee).toBe(STANDARD_CUT_PRICE);

    // Verify: penalty incremented
    const customer = await getCustomer(phone);
    expect(customer.cancellation_penalty_count).toBe(1);
  });
});

// ============================================================================
// 2. No-Show (always 100% fee)
// ============================================================================

describe("No-Show", () => {
  test("No-show → fee = 100% of total price, penalty +1", async () => {
    const { customerId, phone } = await createCustomer("Test NoShow");
    const start = hoursFromNow(120); // 5 days
    const { reservationId } = await createReservation(customerId, start);
    expect(reservationId).toBeDefined();

    const result = await noshowReservation(reservationId!);
    expect(result.status).toBe(200);

    // Verify: fee = 100% regardless of time remaining
    const reservations = await getReservations(customerId);
    const noshow = reservations.find((r) => r.reservation_id === reservationId);
    expect(noshow).toBeDefined();
    expect(noshow!.status).toBe(4); // no-show
    expect(noshow!.cancellation_fee).toBe(STANDARD_CUT_PRICE);

    // Verify: penalty incremented
    const customer = await getCustomer(phone);
    expect(customer.cancellation_penalty_count).toBe(1);
  });
});

// ============================================================================
// 3. Reservation Modification (no fee, no penalty)
// ============================================================================

describe("Reservation Modification", () => {
  test("Modification cancels old reservation with fee = ¥0, no penalty", async () => {
    const { customerId, phone } = await createCustomer("Test Modify");
    const originalStart = hoursFromNow(8); // within 24h
    const { reservationId: originalId } = await createReservation(customerId, originalStart);
    expect(originalId).toBeDefined();

    // Create a new reservation as modification of the original (different day to avoid conflict)
    const newStart = hoursFromNow(144); // 6 days
    const { reservationId: newId, status } = await createReservation(customerId, newStart, {
      modificationSourceId: originalId,
    });
    expect(status).toBe(201);
    expect(newId).toBeDefined();

    // Verify: original reservation cancelled with fee = 0
    const reservations = await getReservations(customerId);
    const original = reservations.find((r) => r.reservation_id === originalId);
    expect(original).toBeDefined();
    expect(original!.status).toBe(1); // cancelled
    expect(original!.cancellation_fee).toBe(0);

    // Verify: new reservation is confirmed
    const modified = reservations.find((r) => r.reservation_id === newId);
    expect(modified).toBeDefined();
    expect(modified!.status).toBe(0); // confirmed

    // Verify: no penalty
    const customer = await getCustomer(phone);
    expect(customer.cancellation_penalty_count).toBe(0);
  });
});

// ============================================================================
// 4. Cancellation Policy Data Exists
// ============================================================================

describe("Cancellation Policy Master Data", () => {
  test("cancellation_fee field exists on reservation records", async () => {
    const { customerId } = await createCustomer("Test Policy Check");
    const start = hoursFromNow(168); // 7 days
    const { reservationId } = await createReservation(customerId, start);
    expect(reservationId).toBeDefined();

    await cancelReservation(reservationId!);

    const reservations = await getReservations(customerId);
    const cancelled = reservations.find((r) => r.reservation_id === reservationId);

    // The key assertion: cancellation_fee field EXISTS on the reservation
    expect(cancelled).toHaveProperty("cancellation_fee");
  });
});

// ============================================================================
// 5. Penalty Blocking
// ============================================================================

describe("Penalty Blocking", () => {
  test("Customer at penalty limit cannot create new reservations", async () => {
    const { customerId } = await createCustomer("Test Blocked");

    // Burn through 3 penalties with < 24h cancellations (100% fee each)
    // Use different time offsets (3h, 4h, 5h) to avoid slot conflicts
    for (let i = 0; i < 3; i++) {
      const start = hoursFromNow(3 + i);
      const { reservationId } = await createReservation(customerId, start);
      expect(reservationId).toBeDefined();
      const result = await cancelReservation(reservationId!);
      expect(result.status).toBe(200);
    }

    // 4th reservation should be blocked
    const start = hoursFromNow(192); // 8 days
    const { status } = await createReservation(customerId, start);
    expect(status).toBe(400);
  });
});
