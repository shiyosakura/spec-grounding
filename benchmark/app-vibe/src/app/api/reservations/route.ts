import { NextRequest, NextResponse } from "next/server";
import { getDb, getSystemSettingInt } from "@/lib/db";
import { seedIfEmpty } from "@/lib/seed";

export async function GET(req: NextRequest) {
  seedIfEmpty();
  const db = getDb();
  const { searchParams } = req.nextUrl;
  const customerId = searchParams.get("customer_id");
  const date = searchParams.get("date");
  const dateEnd = searchParams.get("date_end");
  const staffId = searchParams.get("staff_id");

  let sql = `
    SELECT r.*, s.staff_name, c.customer_name, c.phone_number
    FROM reservations r
    JOIN staff s ON r.staff_id = s.staff_id
    JOIN customers c ON r.customer_id = c.customer_id
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (customerId) {
    sql += " AND r.customer_id = ?";
    params.push(parseInt(customerId));
  }
  if (date) {
    sql += " AND date(r.start_datetime) >= ?";
    params.push(date);
  }
  if (dateEnd) {
    sql += " AND date(r.start_datetime) <= ?";
    params.push(dateEnd);
  } else if (date && !dateEnd) {
    sql += " AND date(r.start_datetime) <= ?";
    params.push(date);
  }
  if (staffId && parseInt(staffId) > 0) {
    sql += " AND r.staff_id = ?";
    params.push(parseInt(staffId));
  }

  sql += " ORDER BY r.start_datetime";

  const reservations = db.prepare(sql).all(...params) as {
    reservation_id: number;
    [key: string]: unknown;
  }[];

  // Attach menu details
  const detailStmt = db.prepare(`
    SELECT rmd.*, m.menu_name
    FROM reservation_menu_details rmd
    JOIN menus m ON rmd.menu_id = m.menu_id
    WHERE rmd.reservation_id = ?
  `);

  const result = reservations.map((r) => ({
    ...r,
    menus: detailStmt.all(r.reservation_id),
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  seedIfEmpty();
  const db = getDb();
  const body = await req.json();
  const {
    customer_id,
    staff_id,
    is_nominated,
    start_datetime,
    menu_ids,
    modification_source_reservation_id,
  } = body;

  // Penalty check
  const customer = db
    .prepare("SELECT * FROM customers WHERE customer_id = ?")
    .get(customer_id) as { cancellation_penalty_count: number } | undefined;

  if (!customer) {
    return NextResponse.json({ error: "Customer not found." }, { status: 400 });
  }

  const penaltyLimit = getSystemSettingInt("cancellation_penalty_limit", 3);
  if (customer.cancellation_penalty_count >= penaltyLimit) {
    return NextResponse.json(
      {
        error:
          "You have reached the maximum number of cancellations and cannot make new reservations. Please contact us by phone.",
      },
      { status: 400 }
    );
  }

  // Calculate total duration
  const menuDetails = (menu_ids as number[]).map((menuId) => {
    return db.prepare("SELECT * FROM menus WHERE menu_id = ?").get(menuId) as {
      menu_id: number;
      price: number;
      duration: number;
    };
  });
  const totalDuration = menuDetails.reduce((sum, m) => sum + m.duration, 0);

  // Duplicate check
  const conflicts = db
    .prepare(
      `SELECT COUNT(*) as c FROM reservations
       WHERE staff_id = ? AND status = 0
       AND datetime(start_datetime) < datetime(?, '+' || ? || ' minutes')
       AND datetime(start_datetime, '+' || total_duration || ' minutes') > datetime(?)`
    )
    .get(staff_id, start_datetime, totalDuration, start_datetime) as { c: number };

  if (conflicts.c > 0) {
    return NextResponse.json(
      {
        error:
          "The selected time slot conflicts with another reservation. Please refresh the available slots.",
      },
      { status: 409 }
    );
  }

  // Create reservation
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  const result = db
    .prepare(
      `INSERT INTO reservations (customer_id, staff_id, is_nominated, start_datetime, total_duration, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?)`
    )
    .run(customer_id, staff_id, is_nominated, start_datetime, totalDuration, now, now);

  const reservationId = result.lastInsertRowid;

  // Create menu details
  const insertDetail = db.prepare(
    "INSERT INTO reservation_menu_details (reservation_id, menu_id, price_at_booking, duration_at_booking) VALUES (?, ?, ?, ?)"
  );
  for (const menu of menuDetails) {
    insertDetail.run(reservationId, menu.menu_id, menu.price, menu.duration);
  }

  // Handle modification source
  if (modification_source_reservation_id && modification_source_reservation_id > 0) {
    db.prepare(
      "UPDATE reservations SET status = 1, updated_at = ? WHERE reservation_id = ?"
    ).run(now, modification_source_reservation_id);
    // No penalty increment for modification cancellation
  }

  return NextResponse.json({ reservation_id: reservationId }, { status: 201 });
}
