import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { seedIfEmpty } from "@/lib/seed";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  seedIfEmpty();
  const db = getDb();
  const { id } = await params;
  const staffId = parseInt(id);
  const body = await req.json();
  const { staff_name, profile, is_active } = body;

  if (!staff_name?.trim()) {
    return NextResponse.json({ error: "Please enter a staff name." }, { status: 400 });
  }

  // Check for future confirmed reservations when deactivating
  if (is_active === 0) {
    const futureCount = db
      .prepare(
        "SELECT COUNT(*) as c FROM reservations WHERE staff_id = ? AND status = 0 AND start_datetime >= datetime('now')"
      )
      .get(staffId) as { c: number };

    if (futureCount.c > 0) {
      // Proceed but return warning
      db.prepare("UPDATE staff SET staff_name=?, profile=?, is_active=? WHERE staff_id=?").run(
        staff_name, profile || "", is_active, staffId
      );
      return NextResponse.json({
        ok: true,
        warning: `${futureCount.c} confirmed reservations exist for this staff member.`,
      });
    }
  }

  db.prepare("UPDATE staff SET staff_name=?, profile=?, is_active=? WHERE staff_id=?").run(
    staff_name, profile || "", is_active, staffId
  );

  return NextResponse.json({ ok: true });
}
