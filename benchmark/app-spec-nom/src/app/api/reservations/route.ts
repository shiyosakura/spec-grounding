import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

interface MenuRow {
  menu_id: number;
  price: number;
  duration: number;
  menu_name: string;
}

interface ReservationRow {
  reservation_id: number;
  customer_id: number;
  staff_id: number;
  is_nominated: number;
  nomination_fee: number;
  start_datetime: string;
  total_duration: number;
  status: number;
  created_at: string;
  updated_at: string;
}

interface ReservationMenuRow {
  menu_id: number;
  price_at_booking: number;
  duration_at_booking: number;
  menu_name: string;
}

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customer_id');
    const date = searchParams.get('date');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const staffId = searchParams.get('staff_id');

    let query = `
      SELECT r.reservation_id, r.customer_id, r.staff_id, r.is_nominated, r.nomination_fee,
             r.start_datetime, r.total_duration, r.status, r.created_at, r.updated_at,
             s.staff_name, c.customer_name, c.phone_number
      FROM reservations r
      LEFT JOIN staff s ON r.staff_id = s.staff_id
      LEFT JOIN customers c ON r.customer_id = c.customer_id
    `;

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (customerId) {
      conditions.push('r.customer_id = ?');
      params.push(Number(customerId));
    }
    if (date) {
      conditions.push("date(r.start_datetime) = ?");
      params.push(date);
    }
    if (dateFrom) {
      conditions.push("date(r.start_datetime) >= ?");
      params.push(dateFrom);
    }
    if (dateTo) {
      conditions.push("date(r.start_datetime) <= ?");
      params.push(dateTo);
    }
    if (staffId && staffId !== '0') {
      conditions.push('r.staff_id = ?');
      params.push(Number(staffId));
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY r.start_datetime ASC';

    const reservations = db.prepare(query).all(...params) as Array<ReservationRow & {
      staff_name: string;
      customer_name: string;
      phone_number: string;
    }>;

    // Get menu details for each reservation
    const menuStmt = db.prepare(`
      SELECT rm.menu_id, rm.price_at_booking, rm.duration_at_booking, m.menu_name
      FROM reservation_menus rm
      LEFT JOIN menus m ON rm.menu_id = m.menu_id
      WHERE rm.reservation_id = ?
    `);

    const result = reservations.map(r => ({
      ...r,
      menus: menuStmt.all(r.reservation_id) as ReservationMenuRow[],
    }));

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const {
      customer_id,
      staff_id,
      is_nominated,
      start_datetime,
      menu_ids,
      modification_source_reservation_id,
    } = body;

    if (!customer_id || !staff_id || !start_datetime || !menu_ids || menu_ids.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get system settings
    const settings = db.prepare('SELECT * FROM system_settings WHERE id = 1').get() as {
      cancellation_penalty_limit: number;
      nomination_fee: number;
    };

    // Check penalty count
    const customer = db.prepare(
      'SELECT cancellation_penalty_count FROM customers WHERE customer_id = ?'
    ).get(customer_id) as { cancellation_penalty_count: number } | undefined;

    if (customer && customer.cancellation_penalty_count >= settings.cancellation_penalty_limit) {
      return NextResponse.json({
        error: 'You have reached the maximum number of cancellations and cannot make new reservations. Please contact us by phone.'
      }, { status: 403 });
    }

    // Get menu info for price/duration snapshots
    const menuPlaceholders = menu_ids.map(() => '?').join(',');
    const menus = db.prepare(
      `SELECT menu_id, price, duration, menu_name FROM menus WHERE menu_id IN (${menuPlaceholders})`
    ).all(...menu_ids) as MenuRow[];

    const totalDuration = menus.reduce((sum: number, m: MenuRow) => sum + m.duration, 0);

    // Duplicate check - look for conflicting reservations
    const conflictingReservations = db.prepare(`
      SELECT reservation_id FROM reservations
      WHERE staff_id = ? AND status IN (0, 2)
      AND (
        (start_datetime < datetime(?, '+' || ? || ' minutes'))
        AND (datetime(start_datetime, '+' || total_duration || ' minutes') > ?)
      )
    `).all(staff_id, start_datetime, totalDuration, start_datetime);

    if (conflictingReservations.length > 0) {
      return NextResponse.json({
        error: 'The selected time slot conflicts with another reservation. Please refresh the available slots.'
      }, { status: 409 });
    }

    // Determine nomination fee
    const nominatedFlag = is_nominated ? 1 : 0;
    const nominationFee = nominatedFlag === 1 ? settings.nomination_fee : 0;

    // Create reservation
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const result = db.prepare(`
      INSERT INTO reservations (customer_id, staff_id, is_nominated, nomination_fee, start_datetime, total_duration, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(customer_id, staff_id, nominatedFlag, nominationFee, start_datetime, totalDuration, now, now);

    const reservationId = result.lastInsertRowid as number;

    // Create reservation menu details
    const insertMenu = db.prepare(
      'INSERT INTO reservation_menus (reservation_id, menu_id, price_at_booking, duration_at_booking) VALUES (?, ?, ?, ?)'
    );
    for (const menu of menus) {
      insertMenu.run(reservationId, menu.menu_id, menu.price, menu.duration);
    }

    // Handle modification: cancel the source reservation
    if (modification_source_reservation_id && modification_source_reservation_id > 0) {
      db.prepare(
        "UPDATE reservations SET status = 1, updated_at = ? WHERE reservation_id = ?"
      ).run(now, modification_source_reservation_id);
    }

    return NextResponse.json({
      reservation_id: reservationId,
      customer_id,
      staff_id,
      is_nominated: nominatedFlag,
      nomination_fee: nominationFee,
      start_datetime,
      total_duration: totalDuration,
      status: 0,
      menus: menus.map(m => ({
        menu_id: m.menu_id,
        menu_name: m.menu_name,
        price_at_booking: m.price,
        duration_at_booking: m.duration,
      })),
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
