import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = getDb();

    const products = (
      db.prepare("SELECT COUNT(*) as cnt FROM products").get() as { cnt: number }
    ).cnt;

    const customers = (
      db.prepare("SELECT COUNT(*) as cnt FROM customers").get() as { cnt: number }
    ).cnt;

    const orders = (
      db.prepare("SELECT COUNT(*) as cnt FROM orders").get() as { cnt: number }
    ).cnt;

    const invoices = (
      db.prepare("SELECT COUNT(*) as cnt FROM invoices").get() as { cnt: number }
    ).cnt;

    return NextResponse.json({
      success: true,
      data: {
        products,
        customers,
        orders,
        invoices,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
