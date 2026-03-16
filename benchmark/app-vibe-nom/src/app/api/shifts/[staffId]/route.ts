import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { seedIfEmpty } from "@/lib/seed";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ staffId: string }> }
) {
  seedIfEmpty();
  const db = getDb();
  const { staffId } = await params;

  const shifts = db
    .prepare("SELECT * FROM staff_shifts WHERE staff_id = ? ORDER BY day_of_week")
    .all(parseInt(staffId));

  return NextResponse.json(shifts);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ staffId: string }> }
) {
  seedIfEmpty();
  const db = getDb();
  const { staffId: staffIdStr } = await params;
  const staffId = parseInt(staffIdStr);
  const shifts = (await req.json()) as {
    day_of_week: number;
    start_time: string;
    end_time: string;
    is_working: number;
  }[];

  // Validate
  for (const s of shifts) {
    if (s.is_working === 1 && s.start_time >= s.end_time) {
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      return NextResponse.json(
        { error: `The end time for ${dayNames[s.day_of_week]} must be after the start time.` },
        { status: 400 }
      );
    }
  }

  // Replace all shifts
  db.prepare("DELETE FROM staff_shifts WHERE staff_id = ?").run(staffId);
  const insert = db.prepare(
    "INSERT INTO staff_shifts (staff_id, day_of_week, start_time, end_time, is_working) VALUES (?, ?, ?, ?, ?)"
  );
  for (const s of shifts) {
    insert.run(staffId, s.day_of_week, s.start_time, s.end_time, s.is_working);
  }

  return NextResponse.json({ ok: true });
}
