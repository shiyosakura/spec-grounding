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

  const assignments = db
    .prepare("SELECT * FROM staff_menu_assignments WHERE staff_id = ? ORDER BY menu_id")
    .all(parseInt(staffId));

  return NextResponse.json(assignments);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ staffId: string }> }
) {
  seedIfEmpty();
  const db = getDb();
  const { staffId: staffIdStr } = await params;
  const staffId = parseInt(staffIdStr);
  const menuIds = (await req.json()) as number[];

  db.prepare("DELETE FROM staff_menu_assignments WHERE staff_id = ?").run(staffId);

  const insert = db.prepare(
    "INSERT INTO staff_menu_assignments (staff_id, menu_id) VALUES (?, ?)"
  );
  for (const menuId of menuIds) {
    insert.run(staffId, menuId);
  }

  return NextResponse.json({ ok: true });
}
