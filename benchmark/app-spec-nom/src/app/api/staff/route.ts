import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('include_inactive') === '1';

    let query = `
      SELECT s.staff_id, s.staff_name, s.profile, s.is_active,
        (SELECT COUNT(*) FROM staff_menu_assignments sma WHERE sma.staff_id = s.staff_id) as menu_count
      FROM staff s
    `;
    if (!includeInactive) {
      query += ' WHERE s.is_active = 1';
    }
    query += ' ORDER BY s.staff_id ASC';

    const staffList = db.prepare(query).all() as Array<{
      staff_id: number;
      staff_name: string;
      profile: string;
      is_active: number;
      menu_count: number;
    }>;

    // Get shifts for each staff
    const shiftStmt = db.prepare(
      'SELECT day_of_week, start_time, end_time, is_working FROM staff_shifts WHERE staff_id = ? ORDER BY day_of_week'
    );
    const assignmentStmt = db.prepare(
      'SELECT menu_id FROM staff_menu_assignments WHERE staff_id = ?'
    );

    const result = staffList.map((s) => ({
      ...s,
      shifts: shiftStmt.all(s.staff_id),
      menu_ids: (assignmentStmt.all(s.staff_id) as Array<{ menu_id: number }>).map((a) => a.menu_id),
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
    const { staff_name, profile } = body;

    if (!staff_name || staff_name.trim() === '') {
      return NextResponse.json({ error: 'Please enter a staff name.' }, { status: 400 });
    }

    const result = db.prepare(
      'INSERT INTO staff (staff_name, profile, is_active) VALUES (?, ?, 1)'
    ).run(staff_name, profile || '');

    const staffId = result.lastInsertRowid as number;

    // Initialize shifts (all days off by default)
    const insertShift = db.prepare(
      'INSERT INTO staff_shifts (staff_id, day_of_week, start_time, end_time, is_working) VALUES (?, ?, ?, ?, ?)'
    );
    for (let dow = 0; dow <= 6; dow++) {
      insertShift.run(staffId, dow, '09:00', '19:00', 0);
    }

    return NextResponse.json({ staff_id: staffId }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
