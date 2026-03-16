import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const staffId = Number(id);
    const db = getDb();
    const body = await request.json();
    const { staff_name, profile, is_active, shifts, menu_ids } = body;

    if (!staff_name || staff_name.trim() === '') {
      return NextResponse.json({ error: 'Please enter a staff name.' }, { status: 400 });
    }

    // Update staff info
    db.prepare(
      'UPDATE staff SET staff_name = ?, profile = ?, is_active = ? WHERE staff_id = ?'
    ).run(staff_name, profile || '', is_active ?? 1, staffId);

    // Update shifts if provided
    if (shifts && Array.isArray(shifts)) {
      db.prepare('DELETE FROM staff_shifts WHERE staff_id = ?').run(staffId);
      const insertShift = db.prepare(
        'INSERT INTO staff_shifts (staff_id, day_of_week, start_time, end_time, is_working) VALUES (?, ?, ?, ?, ?)'
      );
      for (const shift of shifts) {
        insertShift.run(staffId, shift.day_of_week, shift.start_time, shift.end_time, shift.is_working);
      }
    }

    // Update menu assignments if provided
    if (menu_ids && Array.isArray(menu_ids)) {
      db.prepare('DELETE FROM staff_menu_assignments WHERE staff_id = ?').run(staffId);
      const insertAssignment = db.prepare(
        'INSERT INTO staff_menu_assignments (staff_id, menu_id) VALUES (?, ?)'
      );
      for (const menuId of menu_ids) {
        insertAssignment.run(staffId, menuId);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
