import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { seedIfEmpty } from "@/lib/seed";

export async function GET() {
  seedIfEmpty();
  const db = getDb();
  const categories = db
    .prepare("SELECT * FROM menu_categories ORDER BY display_order")
    .all();
  return NextResponse.json(categories);
}
