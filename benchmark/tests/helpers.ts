/**
 * Test helpers for the cancellation policy benchmark.
 *
 * BASE_URL env var selects the target app (default: http://localhost:3000).
 * Each helper wraps a single API call and returns the parsed JSON + status.
 */

declare const __BASE_URL__: string | undefined;

function getBase(): string {
  // Try multiple env var passing methods (vitest worker isolation varies)
  const url =
    (typeof __BASE_URL__ !== "undefined" ? __BASE_URL__ : undefined) ??
    // @ts-expect-error import.meta.env may have custom property
    (typeof import.meta !== "undefined" ? import.meta.env?.BASE_URL_OVERRIDE : undefined) ??
    process.env.BASE_URL ??
    "http://localhost:3097";
  return url.replace(/\/+$/, "");
}

async function api(path: string, init?: RequestInit) {
  const url = `${getBase()}${path}`;
  const res = await fetch(url, init);
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

// ── Customers ──

let customerSeq = 0;

/** Create a fresh customer with a unique phone number. Returns customer_id. */
export async function createCustomer(name = "Test User") {
  customerSeq++;
  const phone = `0900000${String(customerSeq).padStart(4, "0")}`;
  const { body } = await api("/api/customers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customer_name: name, phone_number: phone }),
  });
  return { customerId: body.customer_id as number, phone };
}

/** Fetch customer by phone number. Tries both param names for compatibility. */
export async function getCustomer(phone: string) {
  // Try phone_number first (app-spec), then phone (app-baseline/app-vibe)
  let { body } = await api(`/api/customers?phone_number=${phone}`);
  if (!body || (Array.isArray(body) && body.length === 0)) {
    ({ body } = await api(`/api/customers?phone=${phone}`));
    if (Array.isArray(body)) body = body[0] ?? null;
  }
  return body;
}

// ── Reservations ──

let reservationSeq = 0;

/**
 * Create a reservation at a specific datetime.
 * Uses staff_id=1 and menu_id=1 (Standard Cut, ¥4500, 60min) by default.
 * Auto-assigns staff_id round-robin (1-3) to avoid slot conflicts.
 */
export async function createReservation(
  customerId: number,
  startDatetime: string,
  opts?: { menuIds?: number[]; staffId?: number; modificationSourceId?: number }
) {
  reservationSeq++;
  // Round-robin staff 1-3 to avoid time slot conflicts
  const staffId = opts?.staffId ?? ((reservationSeq - 1) % 3) + 1;
  const { status, body } = await api("/api/reservations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customer_id: customerId,
      staff_id: staffId,
      is_nominated: 1,
      start_datetime: startDatetime,
      menu_ids: opts?.menuIds ?? [1],
      modification_source_reservation_id: opts?.modificationSourceId ?? 0,
    }),
  });
  return { status, reservationId: body?.reservation_id as number | undefined, body };
}

/** Cancel a reservation. */
export async function cancelReservation(reservationId: number) {
  return api(`/api/reservations/${reservationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "cancel" }),
  });
}

/** Mark a reservation as no-show. */
export async function noshowReservation(reservationId: number) {
  return api(`/api/reservations/${reservationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "noshow" }),
  });
}

/** Fetch reservations for a customer. */
export async function getReservations(customerId: number) {
  const { body } = await api(`/api/reservations?customer_id=${customerId}`);
  return body as Array<{
    reservation_id: number;
    status: number;
    cancellation_fee?: number;
    [key: string]: unknown;
  }>;
}

// ── Time helpers ──

/** Format a Date to "YYYY-MM-DD HH:MM" (space-separated, no seconds). */
export function formatDatetime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Return a datetime string N hours from now. */
export function hoursFromNow(hours: number): string {
  const d = new Date(Date.now() + hours * 60 * 60 * 1000);
  return formatDatetime(d);
}

/**
 * Return a datetime string N hours from now, adjusted to fall on a weekday
 * (Mon-Sat) during working hours (10:00-18:00) so staff is available.
 * Adds minuteOffset to avoid collisions between tests.
 */
export function workingHoursFromNow(hours: number, minuteOffset = 0): string {
  const d = new Date(Date.now() + hours * 60 * 60 * 1000 + minuteOffset * 60 * 1000);

  // Move past Sunday (day 0) to Monday
  while (d.getDay() === 0) {
    d.setDate(d.getDate() + 1);
  }

  // Clamp to working hours
  if (d.getHours() < 9) d.setHours(10, 0, 0, 0);
  if (d.getHours() >= 18) {
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    // Re-check Sunday
    while (d.getDay() === 0) {
      d.setDate(d.getDate() + 1);
    }
  }

  return formatDatetime(d);
}
