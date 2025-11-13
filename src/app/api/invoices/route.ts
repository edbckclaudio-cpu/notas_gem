import { NextResponse } from "next/server";
import { readDB } from "../../../lib/db";

export async function GET() {
  const db = readDB();
  return NextResponse.json({ invoices: db.invoices, suppliers: db.suppliers, products: db.products });
}