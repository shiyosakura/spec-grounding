import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const reservationId = Number(id);
    const db = getDb();

    const reservation = db.prepare(`
      SELECT r.reservation_id, r.customer_id, r.staff_id, r.is_nominated, r.nomination_fee,
             r.start_datetime, r.total_duration, r.status, r.created_at, r.updated_at,
             s.staff_name, c.customer_name, c.phone_number
      FROM reservations r
      LEFT JOIN staff s ON r.staff_id = s.staff_id
      LEFT JOIN customers c ON r.customer_id = c.customer_id
      WHERE r.reservation_id = ?
    `).get(reservationId);

    if (!reservation) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    const menus = db.prepare(`
      SELECT rm.menu_id, rm.price_at_booking, rm.duration_at_booking, m.menu_name
      FROM reservation_menus rm
      LEFT JOIN menus m ON rm.menu_id = m.menu_id
      WHERE rm.reservation_id = ?
    `).all(reservationId);

    return NextResponse.json({ ...reservation, menus });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const reservationId = Number(id);
    const db = getDb();
    const body = await request.json();
    const { status } = body;

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const reservation = db.prepare(
      'SELECT reservation_id, customer_id, staff_id, status, start_datetime FROM reservations WHERE reservation_id = ?'
    ).get(reservationId) as {
      reservation_id: number;
      customer_id: number;
      staff_id: number;
      status: number;
      start_datetime: string;
    } | undefined;

    if (!reservation) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    const settings = db.prepare('SELECT * FROM system_settings WHERE id = 1').get() as {
      cancellation_penalty_limit: number;
      same_day_cancellation_hours: number;
    };

    // Status transitions
    if (status === 1) {
      // Cancel
      if (reservation.status !== 0) {
        return NextResponse.json({ error: 'Only confirmed reservations can be cancelled.' }, { status: 400 });
      }

      // Check penalty limit
      const customer = db.prepare(
        'SELECT cancellation_penalty_count FROM customers WHERE customer_id = ?'
      ).get(reservation.customer_id) as { cancellation_penalty_count: number } | undefined;

      if (customer && customer.cancellation_penalty_count >= settings.cancellation_penalty_limit) {
        return NextResponse.json({
          error: 'You have reached the maximum number of cancellations and cannot cancel. Please contact us by phone.'
        }, { status: 403 });
      }

      db.prepare('UPDATE reservations SET status = 1, updated_at = ? WHERE reservation_id = ?')
        .run(now, reservationId);

      // Check for same-day cancellation penalty
      const reservationTime = new Date(reservation.start_datetime.replace(' ', 'T'));
      const penaltyThreshold = new Date(reservationTime.getTime() - settings.same_day_cancellation_hours * 60 * 60 * 1000);
      const currentTime = new Date();

      if (currentTime >= penaltyThreshold) {
        db.prepare(
          'UPDATE customers SET cancellation_penalty_count = MIN(cancellation_penalty_count + 1, ?) WHERE customer_id = ?'
        ).run(settings.cancellation_penalty_limit, reservation.customer_id);
      }

    } else if (status === 2) {
      // Check-in
      if (reservation.status !== 0) {
        return NextResponse.json({ error: 'Only confirmed reservations can be checked in.' }, { status: 400 });
      }
      db.prepare('UPDATE reservations SET status = 2, updated_at = ? WHERE reservation_id = ?')
        .run(now, reservationId);

    } else if (status === 3) {
      // Complete
      if (reservation.status !== 2) {
        return NextResponse.json({ error: 'Only checked-in reservations can be marked as completed.' }, { status: 400 });
      }
      db.prepare('UPDATE reservations SET status = 3, updated_at = ? WHERE reservation_id = ?')
        .run(now, reservationId);

    } else if (status === 4) {
      // No-show
      if (reservation.status !== 0) {
        return NextResponse.json({ error: 'Only confirmed reservations can be marked as no-show.' }, { status: 400 });
      }
      db.prepare('UPDATE reservations SET status = 4, updated_at = ? WHERE reservation_id = ?')
        .run(now, reservationId);
      // Increment penalty
      db.prepare(
        'UPDATE customers SET cancellation_penalty_count = MIN(cancellation_penalty_count + 1, ?) WHERE customer_id = ?'
      ).run(settings.cancellation_penalty_limit, reservation.customer_id);

    } else {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    return NextResponse.json({ success: true, reservation_id: reservationId, status });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
