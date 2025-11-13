import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { parse as parseCSV } from "csv-parse/sync";

const uploadsDir = path.join(process.cwd(), "public", "uploads");

function detectDelimiter(s: string) {
  const sample = s.split(/\r?\n/).slice(0, 5).join("\n");
  const counts: Record<string, number> = {
    ",": (sample.match(/,/g) || []).length,
    ";": (sample.match(/;/g) || []).length,
    "\t": (sample.match(/\t/g) || []).length,
  };
  let best = ",";
  let max = -1;
  for (const [d, c] of Object.entries(counts)) {
    if (c > max) { max = c; best = d; }
  }
  return best;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const all = searchParams.get("all");
  const name = searchParams.get("name");
  try {
    if (all === "1") {
      // Agregar todos os .csv do diretório uploads
      if (!fs.existsSync(uploadsDir)) return NextResponse.json({ files: [] });
      const names = fs.readdirSync(uploadsDir).filter((n) => n.toLowerCase().endsWith(".csv"));
      const files = names.map((n) => {
        const filePath = path.join(uploadsDir, n);
        const raw = fs.readFileSync(filePath, "utf-8");
        const delimiter = detectDelimiter(raw);
        const rows = parseCSV(raw, {
          delimiter,
          columns: false,
          skip_empty_lines: true,
          relax_column_count: true,
          trim: true,
          relax_quotes: true,
        }) as string[][];
        return { name: n, delimiter, rows };
      });
      return NextResponse.json({ files });
    }
    if (!name) return NextResponse.json({ error: "Nome do arquivo não informado" }, { status: 400 });
    const filePath = path.join(uploadsDir, name);
    if (!fs.existsSync(filePath)) return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
    const raw = fs.readFileSync(filePath, "utf-8");
    const delimiter = detectDelimiter(raw);
    const rows = parseCSV(raw, {
      delimiter,
      columns: false,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
      relax_quotes: true,
    }) as string[][];
    return NextResponse.json({ delimiter, rows });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Falha ao ler CSV" }, { status: 500 });
  }
}