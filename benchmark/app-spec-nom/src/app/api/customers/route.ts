import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const phoneNumber = searchParams.get('phone_number');

    if (phoneNumber) {
      const customer = db.prepare(
        'SELECT customer_id, customer_name, phone_number, account_id, cancellation_penalty_count, registered_at FROM customers WHERE phone_number = ?'
      ).get(phoneNumber);

      if (!customer) {
        return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
      }
      return NextResponse.json(customer);
    }

    const customers = db.prepare(
      'SELECT customer_id, customer_name, phone_number, account_id, cancellation_penalty_count, registered_at FROM customers'
    ).all();
    return NextResponse.json(customers);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { customer_name, phone_number } = body;

    if (!customer_name || customer_name.trim() === '') {
      return NextResponse.json({ error: 'Please enter your name.' }, { status: 400 });
    }
    if (!phone_number || !/^\d+$/.test(phone_number)) {
      return NextResponse.json({ error: 'Please enter a valid phone number.' }, { status: 400 });
    }

    // Check for existing customer by phone number
    const existing = db.prepare(
      'SELECT customer_id, customer_name, phone_number, cancellation_penalty_count FROM customers WHERE phone_number = ?'
    ).get(phone_number) as { customer_id: number; customer_name: string; phone_number: string; cancellation_penalty_count: number } | undefined;

    if (existing) {
      // Update name if different
      if (existing.customer_name !== customer_name) {
        db.prepare('UPDATE customers SET customer_name = ? WHERE customer_id = ?')
          .run(customer_name, existing.customer_id);
      }
      return NextResponse.json({
        customer_id: existing.customer_id,
        customer_name: customer_name,
        phone_number: existing.phone_number,
        cancellation_penalty_count: existing.cancellation_penalty_count,
        is_existing: true,
      });
    }

    const result = db.prepare(
      "INSERT INTO customers (customer_name, phone_number, account_id, cancellation_penalty_count, registered_at) VALUES (?, ?, NULL, 0, datetime('now', 'localtime'))"
    ).run(customer_name, phone_number);

    return NextResponse.json({
      customer_id: result.lastInsertRowid,
      customer_name,
      phone_number,
      cancellation_penalty_count: 0,
      is_existing: false,
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
