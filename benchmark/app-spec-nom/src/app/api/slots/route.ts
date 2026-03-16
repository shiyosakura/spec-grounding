import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

interface Reservation {
  start_datetime: string;
  total_duration: number;
}

interface Shift {
  start_time: string;
  end_time: string;
  is_working: number;
}

interface StaffRow {
  staff_id: number;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const staffId = Number(searchParams.get('staff_id') || '0');
    const date = searchParams.get('date');
    const menuIdsParam = searchParams.get('menu_ids');

    if (!date || !menuIdsParam) {
      return NextResponse.json({ error: 'date and menu_ids are required' }, { status: 400 });
    }

    const menuIds = menuIdsParam.split(',').map(Number);

    // Get system settings
    const settings = db.prepare('SELECT * FROM system_settings WHERE id = 1').get() as {
      time_slot_interval: number;
      booking_window_days: number;
    };

    // Validate date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(date);
    selectedDate.setHours(0, 0, 0, 0);
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + settings.booking_window_days);

    if (selectedDate < today) {
      return NextResponse.json({ error: 'Cannot book in the past' }, { status: 400 });
    }
    if (selectedDate > maxDate) {
      return NextResponse.json({ error: 'The selected date is beyond the booking window.' }, { status: 400 });
    }

    // Calculate total duration from menus
    const menuPlaceholders = menuIds.map(() => '?').join(',');
    const menus = db.prepare(
      `SELECT menu_id, duration FROM menus WHERE menu_id IN (${menuPlaceholders})`
    ).all(...menuIds) as Array<{ menu_id: number; duration: number }>;

    const totalDuration = menus.reduce((sum, m) => sum + m.duration, 0);
    if (totalDuration === 0) {
      return NextResponse.json({ slots: [] });
    }

    const dayOfWeek = selectedDate.getDay();

    const calculateSlotsForStaff = (sid: number): Array<{ start_time: string; staff_id: number }> => {
      // Check if staff can handle all menus
      const assignments = db.prepare(
        `SELECT menu_id FROM staff_menu_assignments WHERE staff_id = ? AND menu_id IN (${menuPlaceholders})`
      ).all(sid, ...menuIds) as Array<{ menu_id: number }>;

      if (assignments.length !== menuIds.length) {
        return [];
      }

      // Get shift for this day
      const shift = db.prepare(
        'SELECT start_time, end_time, is_working FROM staff_shifts WHERE staff_id = ? AND day_of_week = ?'
      ).get(sid, dayOfWeek) as Shift | undefined;

      if (!shift || shift.is_working === 0) {
        return [];
      }

      const shiftStart = timeToMinutes(shift.start_time);
      const shiftEnd = timeToMinutes(shift.end_time);

      // Get existing reservations for this staff on this date
      const existingReservations = db.prepare(
        "SELECT start_datetime, total_duration FROM reservations WHERE staff_id = ? AND date(start_datetime) = ? AND status IN (0, 2)"
      ).all(sid, date) as Reservation[];

      const occupiedRanges = existingReservations.map(r => {
        const startTime = r.start_datetime.split(' ')[1] || r.start_datetime.split('T')[1];
        const startMinutes = timeToMinutes(startTime.substring(0, 5));
        return { start: startMinutes, end: startMinutes + r.total_duration };
      });

      const interval = settings.time_slot_interval;
      const slots: Array<{ start_time: string; staff_id: number }> = [];

      for (let slotStart = shiftStart; slotStart + totalDuration <= shiftEnd; slotStart += interval) {
        const slotEnd = slotStart + totalDuration;

        const hasConflict = occupiedRanges.some(range =>
          slotStart < range.end && slotEnd > range.start
        );

        if (!hasConflict) {
          slots.push({ start_time: minutesToTime(slotStart), staff_id: sid });
        }
      }

      return slots;
    };

    if (staffId >= 1) {
      // Specific staff
      const shift = db.prepare(
        'SELECT is_working FROM staff_shifts WHERE staff_id = ? AND day_of_week = ?'
      ).get(staffId, dayOfWeek) as { is_working: number } | undefined;

      if (!shift || shift.is_working === 0) {
        return NextResponse.json({ slots: [], message: 'The selected staff member is off on this day.' });
      }

      // Check menu support
      const assignments = db.prepare(
        `SELECT menu_id FROM staff_menu_assignments WHERE staff_id = ? AND menu_id IN (${menuPlaceholders})`
      ).all(staffId, ...menuIds) as Array<{ menu_id: number }>;

      if (assignments.length !== menuIds.length) {
        return NextResponse.json({ slots: [], message: 'The selected staff member does not support some of the selected menus.' });
      }

      const slots = calculateSlotsForStaff(staffId);
      return NextResponse.json({ slots });
    } else {
      // No preference - check all active staff
      const activeStaff = db.prepare(
        'SELECT staff_id FROM staff WHERE is_active = 1 ORDER BY staff_id ASC'
      ).all() as StaffRow[];

      const allSlots: Map<string, { start_time: string; staff_id: number }> = new Map();

      for (const s of activeStaff) {
        const slots = calculateSlotsForStaff(s.staff_id);
        for (const slot of slots) {
          // Only keep the first staff (smallest staff_id) for each time
          if (!allSlots.has(slot.start_time)) {
            allSlots.set(slot.start_time, slot);
          }
        }
      }

      const sortedSlots = Array.from(allSlots.values()).sort(
        (a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time)
      );

      return NextResponse.json({ slots: sortedSlots });
    }
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
