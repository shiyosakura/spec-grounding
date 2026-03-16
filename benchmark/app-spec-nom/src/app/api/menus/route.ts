import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const includeHidden = searchParams.get('include_hidden') === '1';
    const categoryId = searchParams.get('category_id');

    let query = `
      SELECT m.menu_id, m.menu_name, m.category_id, m.price, m.duration, m.description, m.is_public,
             mc.category_name
      FROM menus m
      LEFT JOIN menu_categories mc ON m.category_id = mc.category_id
    `;
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (!includeHidden) {
      conditions.push('m.is_public = 1');
    }
    if (categoryId && categoryId !== '0') {
      conditions.push('m.category_id = ?');
      params.push(Number(categoryId));
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY mc.display_order ASC, m.menu_id ASC';

    const menus = db.prepare(query).all(...params);
    return NextResponse.json(menus);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
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

    const result = db.prepare(
      'INSERT INTO menus (menu_name, category_id, price, duration, description, is_public) VALUES (?, ?, ?, ?, ?, 0)'
    ).run(menu_name, category_id || 0, price, duration, description || '');

    return NextResponse.json({ menu_id: result.lastInsertRowid }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
