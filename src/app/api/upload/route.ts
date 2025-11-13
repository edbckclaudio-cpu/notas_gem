import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const formData = await req.formData();
  const files = formData.getAll("files");
  if (!files || files.length === 0) {
    return NextResponse.json({ error: "Nenhum arquivo recebido" }, { status: 400 });
  }

  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const saved: string[] = [];
  for (const file of files) {
    if (!(file instanceof File)) continue;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
    const dest = path.join(uploadsDir, safeName);
    fs.writeFileSync(dest, buffer);
    saved.push(`/uploads/${safeName}`);
  }

  return NextResponse.json({ ok: true, urls: saved });
}