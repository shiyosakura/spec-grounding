import { NextRequest, NextResponse } from "next/server";
import { getDb, getSystemSettingInt, calculateCancellationRate } from "@/lib/db";
import { seedIfEmpty } from "@/lib/seed";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  seedIfEmpty();
  const db = getDb();
  const { id } = await params;
  const reservationId = parseInt(id);
  const body = await req.json();
  const { action } = body;

  const reservation = db
    .prepare("SELECT * FROM reservations WHERE reservation_id = ?")
    .get(reservationId) as {
    reservation_id: number;
    customer_id: number;
    status: number;
    start_datetime: string;
  } | undefined;

  if (!reservation) {
    return NextResponse.json({ error: "Reservation not found." }, { status: 404 });
  }

  const now = new Date().toISOString().replace("T", " ").slice(0, 19);

  switch (action) {
    case "cancel": {
      if (reservation.status !== 0) {
        return NextResponse.json({ error: "Only confirmed reservations can be cancelled." }, { status: 400 });
      }

      // Penalty check
      const customer = db
        .prepare("SELECT * FROM customers WHERE customer_id = ?")
        .get(reservation.customer_id) as { cancellation_penalty_count: number };
      const penaltyLimit = getSystemSettingInt("cancellation_penalty_limit", 3);

      if (customer.cancellation_penalty_count >= penaltyLimit) {
        return NextResponse.json(
          { error: "You have reached the maximum number of cancellations and cannot cancel. Please contact us by phone." },
          { status: 400 }
        );
      }

      // Tiered cancellation fee calculation
      const reservationTime = new Date(reservation.start_datetime.replace(" ", "T"));
      const currentTime = new Date();
      const remainingHours = (reservationTime.getTime() - currentTime.getTime()) / (1000 * 60 * 60);

      const cancellationRate = calculateCancellationRate(remainingHours);

      // Calculate total price from reservation menu details
      const menuDetails = db
        .prepare("SELECT * FROM reservation_menu_details WHERE reservation_id = ?")
        .all(reservationId) as { price_at_booking: number }[];
      const totalPrice = menuDetails.reduce((sum, m) => sum + m.price_at_booking, 0);

      // Fee = total price * rate / 100 (rounded down)
      const cancellationFee = Math.floor(totalPrice * cancellationRate / 100);

      // Update reservation status and record cancellation fee
      db.prepare("UPDATE reservations SET status = 1, cancellation_fee = ?, updated_at = ? WHERE reservation_id = ?").run(
        cancellationFee, now, reservationId
      );

      // Increment penalty only when cancellation_rate > 0%
      if (cancellationRate > 0) {
        const newCount = Math.min(customer.cancellation_penalty_count + 1, penaltyLimit);
        db.prepare("UPDATE customers SET cancellation_penalty_count = ? WHERE customer_id = ?").run(
          newCount, reservation.customer_id
        );
      }

      return NextResponse.json({
        ok: true,
        cancellation_rate: cancellationRate,
        cancellation_fee: cancellationFee,
      });
    }

    case "cancel_preview": {
      // Preview cancellation fee without actually cancelling
      if (reservation.status !== 0) {
        return NextResponse.json({ error: "Only confirmed reservations can be cancelled." }, { status: 400 });
      }

      // Penalty check
      const customer = db
        .prepare("SELECT * FROM customers WHERE customer_id = ?")
        .get(reservation.customer_id) as { cancellation_penalty_count: number };
      const penaltyLimit = getSystemSettingInt("cancellation_penalty_limit", 3);

      if (customer.cancellation_penalty_count >= penaltyLimit) {
        return NextResponse.json(
          { error: "You have reached the maximum number of cancellations and cannot cancel. Please contact us by phone." },
          { status: 400 }
        );
      }

      const reservationTime = new Date(reservation.start_datetime.replace(" ", "T"));
      const currentTime = new Date();
      const remainingHours = (reservationTime.getTime() - currentTime.getTime()) / (1000 * 60 * 60);

      const cancellationRate = calculateCancellationRate(remainingHours);

      const menuDetails = db
        .prepare("SELECT * FROM reservation_menu_details WHERE reservation_id = ?")
        .all(reservationId) as { price_at_booking: number }[];
      const totalPrice = menuDetails.reduce((sum, m) => sum + m.price_at_booking, 0);

      const cancellationFee = Math.floor(totalPrice * cancellationRate / 100);

      return NextResponse.json({
        cancellation_rate: cancellationRate,
        cancellation_fee: cancellationFee,
      });
    }

    case "checkin": {
      if (reservation.status !== 0) {
        return NextResponse.json({ error: "Only confirmed reservations can be checked in." }, { status: 400 });
      }
      db.prepare("UPDATE reservations SET status = 2, updated_at = ? WHERE reservation_id = ?").run(now, reservationId);
      return NextResponse.json({ ok: true });
    }

    case "complete": {
      if (reservation.status !== 2) {
        return NextResponse.json({ error: "Only checked-in reservations can be marked as completed." }, { status: 400 });
      }
      db.prepare("UPDATE reservations SET status = 3, updated_at = ? WHERE reservation_id = ?").run(now, reservationId);
      return NextResponse.json({ ok: true });
    }

    case "noshow": {
      if (reservation.status !== 0) {
        return NextResponse.json({ error: "Only confirmed reservations can be marked as no-show." }, { status: 400 });
      }

      // No-show always records 100% cancellation fee
      const menuDetails = db
        .prepare("SELECT * FROM reservation_menu_details WHERE reservation_id = ?")
        .all(reservationId) as { price_at_booking: number }[];
      const totalPrice = menuDetails.reduce((sum, m) => sum + m.price_at_booking, 0);
      const cancellationFee = totalPrice; // 100%

      db.prepare("UPDATE reservations SET status = 4, cancellation_fee = ?, updated_at = ? WHERE reservation_id = ?").run(
        cancellationFee, now, reservationId
      );

      // Penalty increment
      const customer = db
        .prepare("SELECT * FROM customers WHERE customer_id = ?")
        .get(reservation.customer_id) as { cancellation_penalty_count: number };
      const penaltyLimit = getSystemSettingInt("cancellation_penalty_limit", 3);
      const newCount = Math.min(customer.cancellation_penalty_count + 1, penaltyLimit);
      db.prepare("UPDATE customers SET cancellation_penalty_count = ? WHERE customer_id = ?").run(
        newCount, reservation.customer_id
      );

      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }
}
