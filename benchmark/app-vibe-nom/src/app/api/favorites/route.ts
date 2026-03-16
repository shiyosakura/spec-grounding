import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { seedIfEmpty } from "@/lib/seed";

export async function GET(req: NextRequest) {
  seedIfEmpty();
  const db = getDb();
  const customerId = req.nextUrl.searchParams.get("customer_id");

  if (!customerId) {
    return NextResponse.json([]);
  }

  const favorites = db
    .prepare("SELECT * FROM favorites WHERE customer_id = ?")
    .all(parseInt(customerId)) as {
    customer_id: number;
    target_type: number;
    target_id: number;
  }[];

  const result = favorites.map((f) => {
    let targetName = "";
    if (f.target_type === 0) {
      const staff = db
        .prepare("SELECT staff_name FROM staff WHERE staff_id = ?")
        .get(f.target_id) as { staff_name: string } | undefined;
      targetName = staff?.staff_name || "Unknown";
    } else {
      const menu = db
        .prepare("SELECT menu_name FROM menus WHERE menu_id = ?")
        .get(f.target_id) as { menu_name: string } | undefined;
      targetName = menu?.menu_name || "Unknown";
    }
    return { ...f, target_name: targetName };
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  seedIfEmpty();
  const db = getDb();
  const body = await req.json();
  const { customer_id, target_type, target_id } = body;

  const existing = db
    .prepare(
      "SELECT * FROM favorites WHERE customer_id = ? AND target_type = ? AND target_id = ?"
    )
    .get(customer_id, target_type, target_id);

  if (existing) {
    db.prepare(
      "DELETE FROM favorites WHERE customer_id = ? AND target_type = ? AND target_id = ?"
    ).run(customer_id, target_type, target_id);
    return NextResponse.json({ action: "removed" });
  }

  db.prepare(
    "INSERT INTO favorites (customer_id, target_type, target_id) VALUES (?, ?, ?)"
  ).run(customer_id, target_type, target_id);
  return NextResponse.json({ action: "added" });
}
