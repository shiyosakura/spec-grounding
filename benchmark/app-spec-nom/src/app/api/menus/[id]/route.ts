import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const menuId = Number(id);
    const db = getDb();
    const body = await request.json();
    const { menu_name, category_id, price, duration, description } = body;

    if (!menu_name) {
      return NextResponse.json({ error: 'Please enter a menu name.' }, { status: 400 });
    }
    if (!price || price < 1 || price > 99999) {
      return NextResponse.json({ error: 'Please enter a price between ¥1 and ¥99,999.' }, { status: 400 });
    }
    if (!duration || duration < 10 || duration > 480) {
      return NextResponse.json({ error: 'Please enter a duration between 10 and 480 minutes.' }, { status: 400 });
    }

    db.prepare(
      'UPDATE menus SET menu_name = ?, category_id = ?, price = ?, duration = ?, description = ? WHERE menu_id = ?'
    ).run(menu_name, category_id || 0, price, duration, description || '', menuId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const menuId = Number(id);
    const db = getDb();
    const body = await request.json();

    if ('is_public' in body) {
      db.prepare('UPDATE menus SET is_public = ? WHERE menu_id = ?').run(body.is_public, menuId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
