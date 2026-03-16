import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;
    const specialPrice = db.prepare(
      `SELECT sp.*,
        c.customer_name, c.customer_code,
        p.product_name, p.standard_unit_price
       FROM special_prices sp
       JOIN customers c ON sp.customer_id = c.id
       JOIN products p ON sp.product_id = p.id
       WHERE sp.id = ?`
    ).get(Number(id));

    if (!specialPrice) {
      return NextResponse.json(
        { success: false, error: "Special price not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: specialPrice });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;
    const specialPriceId = Number(id);
    const body = await request.json();
    const { special_unit_price } = body;

    const price = Number(special_unit_price);
    if (isNaN(price) || price < 0 || price > 9999999) {
      return NextResponse.json(
        { success: false, error: "Please enter a special unit price between ¥0 and ¥9,999,999." },
        { status: 400 }
      );
    }

    db.prepare(
      `UPDATE special_prices SET special_unit_price = ? WHERE id = ?`
    ).run(price, specialPriceId);

    return NextResponse.json({ success: true, data: { id: specialPriceId } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;
    const specialPriceId = Number(id);

    const existing = db.prepare("SELECT id FROM special_prices WHERE id = ?").get(specialPriceId);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Special price not found." },
        { status: 404 }
      );
    }

    db.prepare("DELETE FROM special_prices WHERE id = ?").run(specialPriceId);

    return NextResponse.json({ success: true, data: { id: specialPriceId } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
