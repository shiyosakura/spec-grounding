import { NextRequest, NextResponse } from "next/server";
import { getDb, getSystemSettingInt } from "@/lib/db";
import { seedIfEmpty } from "@/lib/seed";

interface Slot {
  start_time: string;
  staff_id: number;
}

export async function GET(req: NextRequest) {
  seedIfEmpty();
  const db = getDb();
  const { searchParams } = req.nextUrl;
  const staffId = parseInt(searchParams.get("staff_id") || "0");
  const date = searchParams.get("date") || "";
  const menuIdsStr = searchParams.get("menu_ids") || "";

  if (!date || !menuIdsStr) {
    return NextResponse.json({ error: "Missing date or menu_ids" }, { status: 400 });
  }

  const menuIds = menuIdsStr.split(",").map(Number);

  // Check booking window
  const bookingWindowDays = getSystemSettingInt("booking_window_days", 30);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selectedDate = new Date(date + "T00:00:00");
  const diffDays = Math.ceil((selectedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return NextResponse.json({ error: "Cannot book in the past." }, { status: 400 });
  }
  if (diffDays > bookingWindowDays) {
    return NextResponse.json(
      { error: "The selected date is beyond the booking window." },
      { status: 400 }
    );
  }

  // Calculate total duration needed
  const menus = menuIds.map((id) => {
    return db.prepare("SELECT duration FROM menus WHERE menu_id = ?").get(id) as {
      duration: number;
    } | undefined;
  });
  const totalDuration = menus.reduce((sum, m) => sum + (m?.duration || 0), 0);
  if (totalDuration === 0) {
    return NextResponse.json({ error: "Invalid menu selection." }, { status: 400 });
  }

  const timeSlotInterval = getSystemSettingInt("time_slot_interval", 30);

  if (staffId > 0) {
    // Nominated staff
    const slots = calculateStaffAvailability(db, staffId, date, totalDuration, timeSlotInterval, menuIds);
    if (slots === null) {
      return NextResponse.json(
        { error: "The selected staff member does not support some of the selected menus." },
        { status: 400 }
      );
    }
    return NextResponse.json(slots);
  } else {
    // No preference - find all eligible staff
    const allStaff = db
      .prepare("SELECT staff_id FROM staff WHERE is_active = 1 ORDER BY staff_id")
      .all() as { staff_id: number }[];

    const consolidatedSlots = new Map<string, number>(); // start_time -> staff_id

    for (const s of allStaff) {
      const slots = calculateStaffAvailability(db, s.staff_id, date, totalDuration, timeSlotInterval, menuIds);
      if (slots === null) continue; // Staff can't handle all menus

      for (const slot of slots) {
        if (!consolidatedSlots.has(slot.start_time)) {
          consolidatedSlots.set(slot.start_time, slot.staff_id);
        }
        // Smallest staff_id wins (already sorted by staff_id)
      }
    }

    const result: Slot[] = Array.from(consolidatedSlots.entries())
      .map(([start_time, sid]) => ({ start_time, staff_id: sid }))
      .sort((a, b) => a.start_time.localeCompare(b.start_time));

    return NextResponse.json(result);
  }
}

function calculateStaffAvailability(
  db: ReturnType<typeof getDb>,
  staffId: number,
  date: string,
  totalDuration: number,
  interval: number,
  menuIds: number[]
): Slot[] | null {
  // Check staff can handle all menus
  const assignments = db
    .prepare("SELECT menu_id FROM staff_menu_assignments WHERE staff_id = ?")
    .all(staffId) as { menu_id: number }[];
  const assignedMenuIds = new Set(assignments.map((a) => a.menu_id));

  for (const menuId of menuIds) {
    if (!assignedMenuIds.has(menuId)) return null;
  }

  // Get shift for this day
  const dateObj = new Date(date + "T00:00:00");
  const dow = dateObj.getDay();

  const shift = db
    .prepare("SELECT * FROM staff_shifts WHERE staff_id = ? AND day_of_week = ?")
    .get(staffId, dow) as {
    start_time: string;
    end_time: string;
    is_working: number;
  } | undefined;

  if (!shift || shift.is_working === 0) return [];

  // Get existing reservations for this staff on this date
  const reservations = db
    .prepare(
      `SELECT start_datetime, total_duration FROM reservations
       WHERE staff_id = ? AND date(start_datetime) = ? AND status IN (0, 2)`
    )
    .all(staffId, date) as { start_datetime: string; total_duration: number }[];

  // Generate time slots
  const shiftStart = timeToMinutes(shift.start_time);
  const shiftEnd = timeToMinutes(shift.end_time);

  const slots: Slot[] = [];

  for (let t = shiftStart; t + totalDuration <= shiftEnd; t += interval) {
    const slotStart = t;
    const slotEnd = t + totalDuration;

    // Check overlap with existing reservations
    let conflict = false;
    for (const r of reservations) {
      const rStart = dateTimeToMinutes(r.start_datetime);
      const rEnd = rStart + r.total_duration;
      if (slotStart < rEnd && slotEnd > rStart) {
        conflict = true;
        break;
      }
    }

    if (!conflict) {
      slots.push({ start_time: minutesToTime(t), staff_id: staffId });
    }
  }

  return slots;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function dateTimeToMinutes(dt: string): number {
  // "2026-03-14 09:00" or "2026-03-14T09:00:00"
  const timePart = dt.includes("T") ? dt.split("T")[1] : dt.split(" ")[1];
  return timeToMinutes(timePart.slice(0, 5));
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${h.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;
}
