import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { analyzeInvoices } from "../../../lib/gemini";
import { readDB, writeDB } from "../../../lib/db";

export const runtime = "nodejs";

export async function POST() {
  try {
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    const files = fs.existsSync(uploadsDir)
      ? fs
          .readdirSync(uploadsDir)
          .filter((f) => {
            const name = f.toLowerCase();
            return name.endsWith(".pdf") || name.endsWith(".csv");
          })
          .map((f) => `/uploads/${f}`)
      : [];

    if (files.length === 0) {
      console.warn("[Analyze API] Nenhum PDF encontrado. Executando análise em modo DEMO.");
    }

    const pdfCount = files.filter((f) => f.toLowerCase().endsWith(".pdf")).length;
    const csvCount = files.filter((f) => f.toLowerCase().endsWith(".csv")).length;
    console.log(`[Analyze API] Iniciando análise. PDFs=${pdfCount}, CSVs=${csvCount}, total=${files.length}`);
    const { invoices, products, mode } = await analyzeInvoices(files);
    console.log(`[Analyze API] Resultado obtido: mode=${mode}, invoices=${invoices.length}, products=${products.length}`);

    const db = readDB();
    if (invoices.length === 0 && products.length === 0) {
      // limpeza automática somente quando o resultado vier vazio
      db.invoices = [];
      db.products = [];
      db.suppliers = [];
      writeDB(db);
      console.log(`[Analyze API] Resultado vazio: banco limpo.`);
    } else {
      // substituir completamente pelo novo resultado
      db.invoices = [...invoices];
      db.products = [...products];
      db.suppliers = [];
      invoices.forEach((inv) => {
        const exists = db.suppliers.find((s) => s.cnpj === inv.cnpj);
        if (!exists) {
          db.suppliers.push({
            id: crypto.randomUUID(),
            nome: inv.fornecedor,
            cnpj: inv.cnpj,
            endereco: "",
            telefone: "",
            email: "",
          });
        }
      });
      writeDB(db);
      console.log(`[Analyze API] Banco atualizado com ${invoices.length} faturas e ${products.length} produtos.`);
    }
    console.log(`[Analyze API] Persistência concluída.`);

    return NextResponse.json({ ok: true, mode, invoicesCount: invoices.length, productsCount: products.length });
  } catch (e: any) {
    console.error("Erro na análise:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Erro desconhecido" }, { status: 500 });
  }
}