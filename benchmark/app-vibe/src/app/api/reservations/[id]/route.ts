import { NextRequest, NextResponse } from "next/server";
import { getDb, getSystemSettingInt } from "@/lib/db";
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
      const tier1Hours = getSystemSettingInt("cancellation_tier1_hours", 72);
      const tier1Rate = getSystemSettingInt("cancellation_tier1_rate", 0);
      const tier2Hours = getSystemSettingInt("cancellation_tier2_hours", 24);
      const tier2Rate = getSystemSettingInt("cancellation_tier2_rate", 50);
      const tier3Rate = getSystemSettingInt("cancellation_tier3_rate", 100);

      const reservationTime = new Date(reservation.start_datetime.replace(" ", "T"));
      const currentTime = new Date();
      const hoursBeforeReservation = (reservationTime.getTime() - currentTime.getTime()) / (1000 * 60 * 60);

      let cancellationFeeRate: number;
      if (hoursBeforeReservation >= tier1Hours) {
        cancellationFeeRate = tier1Rate;    // 72h+ before: free
      } else if (hoursBeforeReservation >= tier2Hours) {
        cancellationFeeRate = tier2Rate;    // 24-72h before: 50%
      } else {
        cancellationFeeRate = tier3Rate;    // <24h before: 100%
      }

      db.prepare("UPDATE reservations SET status = 1, cancellation_fee_rate = ?, updated_at = ? WHERE reservation_id = ?").run(
        cancellationFeeRate, now, reservationId
      );

      // Penalty increment for cancellations with fee
      if (cancellationFeeRate > 0) {
        const newCount = Math.min(customer.cancellation_penalty_count + 1, penaltyLimit);
        db.prepare("UPDATE customers SET cancellation_penalty_count = ? WHERE customer_id = ?").run(
          newCount, reservation.customer_id
        );
      }

      // Calculate cancellation fee amount
      const menuDetails = db.prepare(
        "SELECT SUM(price_at_booking) as total FROM reservation_menu_details WHERE reservation_id = ?"
      ).get(reservationId) as { total: number };
      const totalPrice = menuDetails.total || 0;
      const cancellationFee = Math.floor(totalPrice * cancellationFeeRate / 100);

      return NextResponse.json({
        ok: true,
        cancellation_fee_rate: cancellationFeeRate,
        cancellation_fee: cancellationFee,
        total_price: totalPrice,
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
      const noshowFeeRate = getSystemSettingInt("noshow_fee_rate", 100);
      db.prepare("UPDATE reservations SET status = 4, cancellation_fee_rate = ?, updated_at = ? WHERE reservation_id = ?").run(
        noshowFeeRate, now, reservationId
      );

      // Penalty increment
      const noshowCustomer = db
        .prepare("SELECT * FROM customers WHERE customer_id = ?")
        .get(reservation.customer_id) as { cancellation_penalty_count: number };
      const noshowPenaltyLimit = getSystemSettingInt("cancellation_penalty_limit", 3);
      const noshowNewCount = Math.min(noshowCustomer.cancellation_penalty_count + 1, noshowPenaltyLimit);
      db.prepare("UPDATE customers SET cancellation_penalty_count = ? WHERE customer_id = ?").run(
        noshowNewCount, reservation.customer_id
      );

      return NextResponse.json({ ok: true });
    }

    case "cancel_preview": {
      if (reservation.status !== 0) {
        return NextResponse.json({ error: "Only confirmed reservations can be cancelled." }, { status: 400 });
      }

      const previewTier1Hours = getSystemSettingInt("cancellation_tier1_hours", 72);
      const previewTier1Rate = getSystemSettingInt("cancellation_tier1_rate", 0);
      const previewTier2Hours = getSystemSettingInt("cancellation_tier2_hours", 24);
      const previewTier2Rate = getSystemSettingInt("cancellation_tier2_rate", 50);
      const previewTier3Rate = getSystemSettingInt("cancellation_tier3_rate", 100);

      const previewReservationTime = new Date(reservation.start_datetime.replace(" ", "T"));
      const previewCurrentTime = new Date();
      const previewHours = (previewReservationTime.getTime() - previewCurrentTime.getTime()) / (1000 * 60 * 60);

      let previewFeeRate: number;
      if (previewHours >= previewTier1Hours) {
        previewFeeRate = previewTier1Rate;
      } else if (previewHours >= previewTier2Hours) {
        previewFeeRate = previewTier2Rate;
      } else {
        previewFeeRate = previewTier3Rate;
      }

      const previewMenuDetails = db.prepare(
        "SELECT SUM(price_at_booking) as total FROM reservation_menu_details WHERE reservation_id = ?"
      ).get(reservationId) as { total: number };
      const previewTotalPrice = previewMenuDetails.total || 0;
      const previewFee = Math.floor(previewTotalPrice * previewFeeRate / 100);

      return NextResponse.json({
        cancellation_fee_rate: previewFeeRate,
        cancellation_fee: previewFee,
        total_price: previewTotalPrice,
        hours_before: Math.floor(previewHours),
      });
    }

    default:
      return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }
}
