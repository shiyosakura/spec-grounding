import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    const categories = db.prepare(
      'SELECT category_id, category_name, display_order FROM menu_categories ORDER BY display_order ASC'
    ).all();
    return NextResponse.json(categories);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
