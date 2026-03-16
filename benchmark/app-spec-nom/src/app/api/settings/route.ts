import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    const settings = db.prepare('SELECT * FROM system_settings WHERE id = 1').get();
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
