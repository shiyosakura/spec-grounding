import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customer_id');

    if (!customerId) {
      return NextResponse.json({ error: 'customer_id is required' }, { status: 400 });
    }

    const favorites = db.prepare(`
      SELECT f.customer_id, f.target_type, f.target_id,
        CASE
          WHEN f.target_type = 0 THEN (SELECT staff_name FROM staff WHERE staff_id = f.target_id)
          WHEN f.target_type = 1 THEN (SELECT menu_name FROM menus WHERE menu_id = f.target_id)
        END as target_name
      FROM favorites f
      WHERE f.customer_id = ?
    `).all(Number(customerId));

    return NextResponse.json(favorites);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { customer_id, target_type, target_id } = body;

    // Check if already exists
    const existing = db.prepare(
      'SELECT 1 FROM favorites WHERE customer_id = ? AND target_type = ? AND target_id = ?'
    ).get(customer_id, target_type, target_id);

    if (existing) {
      // Remove
      db.prepare(
        'DELETE FROM favorites WHERE customer_id = ? AND target_type = ? AND target_id = ?'
      ).run(customer_id, target_type, target_id);
      return NextResponse.json({ action: 'removed' });
    } else {
      // Add
      db.prepare(
        'INSERT INTO favorites (customer_id, target_type, target_id) VALUES (?, ?, ?)'
      ).run(customer_id, target_type, target_id);
      return NextResponse.json({ action: 'added' }, { status: 201 });
    }
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
