import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const uploadsDir = path.join(process.cwd(), "public", "uploads");

export async function GET() {
  if (!fs.existsSync(uploadsDir)) return NextResponse.json({ files: [] });
  const entries = fs.readdirSync(uploadsDir);
  const files = entries
    .filter((f) => {
      const name = f.toLowerCase();
      return name.endsWith(".pdf") || name.endsWith(".csv");
    })
    .map((f) => ({ name: f, url: `/uploads/${f}` }));
  return NextResponse.json({ files });
}

export async function POST(req: NextRequest) {
  const { from, to } = await req.json();
  if (!from || !to) return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
  const src = path.join(uploadsDir, from);
  const dest = path.join(uploadsDir, to);
  if (!fs.existsSync(src)) return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  fs.renameSync(src, dest);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name");
  if (!name) return NextResponse.json({ error: "Nome não informado" }, { status: 400 });
  const target = path.join(uploadsDir, name);
  if (!fs.existsSync(target)) return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  fs.unlinkSync(target);
  return NextResponse.json({ ok: true });
}