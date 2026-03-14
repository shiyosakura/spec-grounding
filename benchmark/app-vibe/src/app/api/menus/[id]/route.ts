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
  const menuId = parseInt(id);
  const body = await req.json();
  const { menu_name, category_id, price, duration, description } = body;

  if (!menu_name?.trim()) {
    return NextResponse.json({ error: "Please enter a menu name." }, { status: 400 });
  }
  if (!price || price < 1 || price > 99999) {
    return NextResponse.json({ error: "Please enter a price between ¥1 and ¥99,999." }, { status: 400 });
  }
  if (!duration || duration < 10 || duration > 480) {
    return NextResponse.json({ error: "Please enter a duration between 10 and 480 minutes." }, { status: 400 });
  }

  db.prepare(
    "UPDATE menus SET menu_name=?, category_id=?, price=?, duration=?, description=? WHERE menu_id=?"
  ).run(menu_name, category_id, price, duration, description || "", menuId);

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  seedIfEmpty();
  const db = getDb();
  const { id } = await params;
  const menuId = parseInt(id);

  db.prepare(
    "UPDATE menus SET is_public = CASE WHEN is_public = 1 THEN 0 ELSE 1 END WHERE menu_id = ?"
  ).run(menuId);

  return NextResponse.json({ ok: true });
}
