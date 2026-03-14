import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { seedIfEmpty } from "@/lib/seed";

export async function GET(req: NextRequest) {
  seedIfEmpty();
  const db = getDb();
  const { searchParams } = req.nextUrl;
  const publicOnly = searchParams.get("public_only") === "1";
  const categoryId = searchParams.get("category_id");

  let sql = `
    SELECT m.*, mc.category_name
    FROM menus m
    LEFT JOIN menu_categories mc ON m.category_id = mc.category_id
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (publicOnly) {
    sql += " AND m.is_public = 1";
  }
  if (categoryId && parseInt(categoryId) > 0) {
    sql += " AND m.category_id = ?";
    params.push(parseInt(categoryId));
  }
  sql += " ORDER BY mc.display_order, m.menu_id";

  const menus = db.prepare(sql).all(...params);
  return NextResponse.json(menus);
}

export async function POST(req: NextRequest) {
  seedIfEmpty();
  const db = getDb();
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

  const result = db
    .prepare(
      "INSERT INTO menus (menu_name, category_id, price, duration, description, is_public) VALUES (?, ?, ?, ?, ?, 0)"
    )
    .run(menu_name, category_id || 1, price, duration, description || "");

  return NextResponse.json({ menu_id: result.lastInsertRowid }, { status: 201 });
}
