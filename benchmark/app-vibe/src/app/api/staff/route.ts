import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { seedIfEmpty } from "@/lib/seed";

export async function GET() {
  seedIfEmpty();
  const db = getDb();

  const staffList = db.prepare("SELECT * FROM staff ORDER BY staff_id").all() as {
    staff_id: number;
    staff_name: string;
    profile: string;
    is_active: number;
  }[];

  const result = staffList.map((s) => {
    const menuCount = db
      .prepare("SELECT COUNT(*) as c FROM staff_menu_assignments WHERE staff_id = ?")
      .get(s.staff_id) as { c: number };

    const shifts = db
      .prepare("SELECT day_of_week, is_working FROM staff_shifts WHERE staff_id = ? ORDER BY day_of_week")
      .all(s.staff_id) as { day_of_week: number; is_working: number }[];

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const workingDays = shifts
      .filter((sh) => sh.is_working === 1)
      .map((sh) => dayNames[sh.day_of_week]);

    return {
      ...s,
      menu_count: menuCount.c,
      shift_summary: workingDays.join(", "),
    };
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  seedIfEmpty();
  const db = getDb();
  const body = await req.json();
  const { staff_name, profile } = body;

  if (!staff_name?.trim()) {
    return NextResponse.json({ error: "Please enter a staff name." }, { status: 400 });
  }

  const result = db
    .prepare("INSERT INTO staff (staff_name, profile, is_active) VALUES (?, ?, 1)")
    .run(staff_name, profile || "");

  // Create default shifts (Mon-Sat working, Sun off)
  const insertShift = db.prepare(
    "INSERT INTO staff_shifts (staff_id, day_of_week, start_time, end_time, is_working) VALUES (?, ?, ?, ?, ?)"
  );
  for (let dow = 0; dow <= 6; dow++) {
    insertShift.run(result.lastInsertRowid, dow, "09:00", "19:00", dow === 0 ? 0 : 1);
  }

  return NextResponse.json({ staff_id: result.lastInsertRowid }, { status: 201 });
}
