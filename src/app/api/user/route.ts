import { NextRequest, NextResponse } from "next/server";
import { upsertUser } from "../../../lib/db";

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "E-mail não informado" }, { status: 400 });
  const user = upsertUser(email);
  return NextResponse.json({ ok: true, user });
}