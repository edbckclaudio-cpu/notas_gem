import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { looksTwoSpaceDelimited, parseTwoSpace } from "../../../lib/csvTwoSpace";

export const runtime = "nodejs";
export const maxDuration = 60;

function detectDelimiter(s: string): string {
  const sample = s.split(/\r?\n/).slice(0, 5).join("\n");
  const counts: Record<string, number> = {
    ",": (sample.match(/,/g) || []).length,
    ";": (sample.match(/;/g) || []).length,
    "\t": (sample.match(/\t/g) || []).length,
  };
  let best = ",";
  let max = -1;
  for (const [d, c] of Object.entries(counts)) {
    if (c > max) {
      max = c;
      best = d;
    }
  }
  return best;
}

function safeSheetName(name: string): string {
  const base = name.replace(/[:\\/?*\[\]]/g, "_");
  return base.slice(0, 28) || "Sheet"; // Excel sheet name limit
}

function isFinancialHeader(name: string): boolean {
  const n = name.toLowerCase();
  return [
    "valor",
    "preco",
    "preço",
    "vlr",
    "total",
    "unitario",
    "unitário",
    "parcela",
    "valor_unitario",
    "valor_total",
    "preco_unitario",
  ].some((k) => n.includes(k));
}

function toBrazilDecimal(val: any): string {
  if (val === null || val === undefined) return "";
  const s = String(val).trim();
  if (s === "") return "";
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  // Replace dot by comma only when it's likely decimal (no comma present)
  if (hasDot && !hasComma) {
    return s.replace(/\./g, ",");
  }
  return s;
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let buf = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      const next = line[i + 1];
      if (next === '"') {
        buf += '"';
        i++;
        continue;
      }
      inQuote = !inQuote;
      continue;
    }
    if (!inQuote && ch === delimiter) {
      out.push(buf.trim());
      buf = "";
    } else {
      buf += ch;
    }
  }
  out.push(buf.trim());
  return out.map((s) => {
    let t = s;
    if (t.startsWith('"') && t.endsWith('"')) t = t.slice(1, -1).replace(/""/g, '"');
    return t;
  });
}

export async function POST() {
  try {
    const ExcelJSMod = await import("exceljs");
    const ExcelJS: any = (ExcelJSMod as any).default || ExcelJSMod;
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    const files = fs.existsSync(uploadsDir)
      ? fs
          .readdirSync(uploadsDir)
          .filter((f) => f.toLowerCase().endsWith(".csv"))
          .map((f) => ({
            name: f,
            abs: path.join(uploadsDir, f),
          }))
      : [];

    if (files.length === 0) {
      return NextResponse.json(
        { error: "Nenhum CSV encontrado em /public/uploads" },
        { status: 404 }
      );
    }

    const wb = new ExcelJS.Workbook();
    for (const file of files) {
      const raw = fs.readFileSync(file.abs, "utf-8");
      const useTwoSpaces = looksTwoSpaceDelimited(raw);
      const delimiter = useTwoSpaces ? "" : detectDelimiter(raw);

      // Parse preferencial com cabeçalho (sem csv-parse para evitar erros de citação)
      let rowsObj: any[] | null = null;
      if (useTwoSpaces) {
        const parsed = parseTwoSpace(raw, true);
        rowsObj = parsed.rows as any[];
      } else {
        const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length > 0) {
          const rows = lines.map((l) => splitCsvLine(l, ","));
          const headers = rows[0] || [];
          const body = rows.slice(1);
          // Validar se cabeçalho parece razoável (>=3 colunas)
          if (headers.length >= 3) {
            rowsObj = body.map((r) => {
              const obj: Record<string, string> = {};
              for (let i = 0; i < headers.length; i++) obj[headers[i]] = r[i] ?? "";
              return obj;
            });
          }
        }
      }

      const ws = wb.addWorksheet(safeSheetName(path.basename(file.name, ".csv")));

      if (rowsObj && rowsObj.length > 0) {
        const headers = Object.keys(rowsObj[0]);
        ws.addRow(headers);
        for (const row of rowsObj) {
          const out = headers.map((h) => {
            const v = row[h];
            return isFinancialHeader(h) ? toBrazilDecimal(v) : v;
          });
          ws.addRow(out);
        }
      } else {
        // Fallback: sem cabeçalho, tratar como arrays e detectar colunas financeiras
        const rows: any[] = useTwoSpaces
          ? (parseTwoSpace(raw, false).rows as any[])
          : (() => {
              const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
              return lines.map((l) => splitCsvLine(l, ","));
            })();
        const maxCols = rows.reduce((m, r) => Math.max(m, Array.isArray(r) ? r.length : 0), 0);
        const candidates: boolean[] = new Array(maxCols).fill(false);
        const sampleCount = Math.min(rows.length, 10);
        for (let c = 0; c < maxCols; c++) {
          let numericLike = 0;
          for (let i = 0; i < sampleCount; i++) {
            const cell = rows[i]?.[c];
            const s = String(cell ?? "").trim();
            if (/^\d+[.,]?\d*$/.test(s) || /^R\$\s*\d/.test(s)) numericLike++;
          }
          candidates[c] = numericLike >= Math.ceil(sampleCount / 2);
        }
        for (const r of rows) {
          const out = (Array.isArray(r) ? r : [r]).map((v: any, idx: number) =>
            candidates[idx] ? toBrazilDecimal(v) : v
          );
          ws.addRow(out);
        }
      }
    }

    const exportsDir = path.join(process.cwd(), "public", "exports");
    fs.mkdirSync(exportsDir, { recursive: true });
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
      now.getDate()
    ).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(
      now.getMinutes()
    ).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
    let fileName = `consolidado-${stamp}.xlsx`;
    let outAbs = path.join(exportsDir, fileName);
    await wb.xlsx.writeFile(outAbs);

    const relPath = `/exports/${fileName}`;
    const publicUrl = `/exports/${fileName}`; // served by Next static from public

    return NextResponse.json(
      {
        message: "Arquivo Excel gerado com sucesso",
        filesCount: files.length,
        absolutePath: outAbs,
        relativePath: relPath,
        url: publicUrl,
        sheets: files.map((f) => safeSheetName(path.basename(f.name, ".csv"))),
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("[Export XLS] Falha ao gerar Excel:", e?.message, e?.stack);
    return NextResponse.json(
      { error: e?.message || "Falha ao gerar o arquivo Excel" },
      { status: 500 }
    );
  }
}