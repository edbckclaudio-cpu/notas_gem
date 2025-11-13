import fs from "fs";
import path from "path";
import { createRequire } from "module";
import type { Invoice, Product } from "./types";
import { parse as parseCSV } from "csv-parse/sync";
import { looksTwoSpaceDelimited, parseTwoSpace } from "./csvTwoSpace";

export async function analyzeInvoices(fileUrls: string[]): Promise<{
  invoices: Invoice[];
  products: Product[];
  mode: "demo" | "local";
}> {
  const analyzeMode = (process.env.ANALYZE_MODE || "auto").toLowerCase();
  if (analyzeMode === "demo") {
    console.log("[Analyze Local] Modo DEMO desabilitado. Prosseguindo com extração local.");
  }
  if (fileUrls.length === 0) {
    console.log("[Analyze Local] Nenhum arquivo enviado; retornando vazio em modo LOCAL");
    return { invoices: [], products: [], mode: "local" };
  }

  // Análise local: ler PDFs e extrair informações básicas via regex/heurísticas
  try {
    const invoices: Invoice[] = [];
    const products: Product[] = [];

    for (const url of fileUrls) {
      const relative = url.replace(/^\//, "");
      const pathOnDisk = path.join(process.cwd(), "public", relative);
      if (!fs.existsSync(pathOnDisk)) {
        console.warn("[Analyze Local] Arquivo não encontrado:", pathOnDisk);
        continue;
      }
      const lowerUrl = url.toLowerCase();
      const isCSV = lowerUrl.endsWith(".csv");

      if (isCSV) {
        // Leitura e parsing de CSV com autodetecção de delimitador e suporte a arquivos sem cabeçalho
        const raw = fs.readFileSync(pathOnDisk, "utf-8");

        const detectDelimiter = (s: string) => {
          const sample = s.split(/\r?\n/).slice(0, 5).join("\n");
          const counts = {
            ",": (sample.match(/,/g) || []).length,
            ";": (sample.match(/;/g) || []).length,
            "\t": (sample.match(/\t/g) || []).length,
          };
          let best: string = ",";
          let max = -1;
          for (const [d, c] of Object.entries(counts)) {
            if (c > max) {
              max = c;
              best = d;
            }
          }
          return best;
        };
        const useTwoSpaces = looksTwoSpaceDelimited(raw);
        const delimiter = useTwoSpaces ? "" : detectDelimiter(raw);

        const parseNumber = (s: string) => {
          if (!s) return 0;
          let cleaned = String(s).trim().replace(/\s+/g, "")
            .replace(/-$/, ""); // remover trailing '-'
          const hasComma = cleaned.includes(",");
          const hasDot = cleaned.includes(".");
          if (hasComma && hasDot) {
            // Padrão brasileiro: ponto como milhar e vírgula como decimal
            cleaned = cleaned.replace(/\./g, "").replace(/,/g, ".");
          } else if (hasComma && !hasDot) {
            // Apenas vírgula presente: tratar como decimal
            cleaned = cleaned.replace(/,/g, ".");
          } else if (!hasComma && hasDot) {
            // Apenas ponto presente: tratar como decimal
            const dotCount = (cleaned.match(/\./g) || []).length;
            if (dotCount > 1) {
              // remover pontos de milhar, manter apenas o último como decimal
              const parts = cleaned.split(".");
              const last = parts.pop();
              cleaned = parts.join("") + "." + last;
            }
          }
          cleaned = cleaned.replace(/[^\d\.-]/g, "");
          const n = Number(cleaned);
          return Number.isFinite(n) ? n : 0;
        };
        const parseDate = (s: string) => {
          if (!s) return new Date();
          const dmy = String(s).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
          if (dmy) return new Date(`${dmy[3]}-${dmy[2]}-${dmy[1]}`);
          const iso = new Date(s);
          return isNaN(iso.getTime()) ? new Date() : iso;
        };

        const cnpjRegex = /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b|\b\d{14}\b/;

        // Tentar com cabeçalho; se não houver, cair para linhas como arrays
        let rowsObj: any[] | null = null;
        try {
          if (useTwoSpaces) {
            rowsObj = parseTwoSpace(raw, true).rows as any[];
          } else {
            rowsObj = parseCSV(raw, {
              delimiter,
              columns: true,
              skip_empty_lines: true,
              relax_column_count: true,
              trim: true,
              quote: '"',
              escape: '"',
              relax_quotes: true,
              skip_records_with_error: true,
            }) as any[];
          }
        } catch {}

        if (rowsObj && rowsObj.length > 0) {
          // Caminho com cabeçalho: mapear pelos nomes informados
          const normalizeKey = (s: string) => s
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "");
          const buildNormRow = (row: Record<string, any>) => {
            const norm: Record<string, any> = {};
            Object.entries(row).forEach(([kk, vv]) => (norm[normalizeKey(kk)] = vv));
            return norm;
          };
          const get = (normRow: Record<string, any>, keys: string[]) => {
            for (const k of keys) {
              const v = normRow[k];
              if (v !== undefined && String(v).trim() !== "") return String(v).trim();
            }
            return "";
          };
          const parseDate2 = (s: string) => {
            if (!s) return new Date();
            const m = String(s).match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
            if (m) {
              const yy = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
              return new Date(`${yy}-${m[2]}-${m[1]}`);
            }
            return parseDate(s);
          };

          // Descobrir fornecedor e CNPJ globais caso não venham em todas as linhas
          const supplierKeys = [
            "emitente",
            "fornecedor",
            "empresa",
            "nome_emitente",
            "xnome",
            "razao_social",
            "razao_social_emitente",
            "nome",
            "nome_empresa",
            "fantasia",
            "nome_fantasia",
          ];
          const cnpjKeys = [
            "cnpj_emitente",
            "cnpj",
            "cnpj_fornecedor",
            "cnpj_destinatario",
            "cnpj_emit",
          ];
          const countStr = (map: Map<string, number>, val: string) => {
            const v = val?.trim();
            if (!v) return;
            map.set(v, (map.get(v) || 0) + 1);
          };
          const supplierCounts = new Map<string, number>();
          const cnpjCounts = new Map<string, number>();
          const supplierByCNPJCounts = new Map<string, Map<string, number>>();
          for (const row of rowsObj) {
            const r = buildNormRow(row);
            const s = get(r, supplierKeys);
            const c = get(r, cnpjKeys);
            if (s) countStr(supplierCounts, s);
            if (c) {
              const mm = c.match(cnpjRegex);
              if (mm) countStr(cnpjCounts, mm[0]);
              if (mm && s) {
                const key = mm[0];
                const inner = supplierByCNPJCounts.get(key) || new Map<string, number>();
                inner.set(s, (inner.get(s) || 0) + 1);
                supplierByCNPJCounts.set(key, inner);
              }
            }
          }
          let supplierGlobal = Array.from(supplierCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
          let cnpjGlobal = Array.from(cnpjCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
          const supplierByCNPJ: Record<string, string> = {};
          for (const [key, inner] of supplierByCNPJCounts.entries()) {
            supplierByCNPJ[key] = Array.from(inner.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
          }
          if (!supplierGlobal || !cnpjGlobal) {
            const lines = raw.split(/\r?\n/);
            for (let i = 0; i < lines.length; i++) {
              const m = lines[i].match(cnpjRegex);
              if (m) {
                cnpjGlobal = cnpjGlobal || m[0];
                // procurar nome nas linhas anteriores/próximas
                const window = [lines[i - 2], lines[i - 1], lines[i + 1], lines[i + 2]]
                  .filter(Boolean) as string[];
                const candidate = window.find((l) => /[A-Za-zÀ-ÿ]/.test(l) && l.length > 5);
                if (candidate) supplierGlobal = supplierGlobal || candidate.trim();
                if (supplierGlobal && cnpjGlobal) break;
              }
            }
          }

          const findNameNearCNPJ = (target: string) => {
            if (!target) return "";
            const lines = raw.split(/\r?\n/);
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].includes(target)) {
                const window = [lines[i - 2], lines[i - 1], lines[i + 1], lines[i + 2]].filter(Boolean) as string[];
                const candidate = window.find((l) => /[A-Za-zÀ-ÿ]/.test(l) && l.length > 5);
                if (candidate) return candidate.trim();
                break;
              }
            }
            return "";
          };

          type Key = string;
          const invByKey = new Map<Key, Invoice & { sum?: number }>();

          for (const row of rowsObj) {
            const r = buildNormRow(row);
            const nf = get(r, ["nf_e", "nf_e_", "nf_e__", "nfe", "numero_nfe"]);
            const serie = get(r, ["serie", "serie_", "serie__"]);
            const fornecedor = get(r, ["emitente", "fornecedor", "empresa", "nome_emitente", "razao_social", "nome_fantasia"]);
            const cnpjVal = get(r, ["cnpj_emitente", "cnpj", "cnpj_fornecedor", "cnpj_destinatario", "cnpj_emit"]);
            const cnpjMatch = cnpjVal.match(cnpjRegex) || String(cnpjVal).match(cnpjRegex);
            const cnpj = cnpjMatch ? cnpjMatch[0] : (cnpjGlobal || "");
            const venc = get(r, ["vencimento_duplicata", "vencimento", "data_vencimento"]);
            const emissao = get(r, ["emissao", "data_emissao", "emissao_nota"]);
            const totalNotaStr = get(r, ["valor_total_da_nota", "valor_total", "total"]);
            const codigo = get(r, ["codigo_produto", "codigo", "sku"]);
            const desc = get(r, ["descricao_do_produto", "descricao", "produto", "item"]);
            const qtdStr = get(r, ["quantidade", "qtd"]);
            const unidade = get(r, ["unidade", "un"]);
            // Incluir sinônimos normalizados do cabeçalho do CSV (ex.: "Vlr. Unitário" -> vlr_unitario)
            const unitStr = get(r, ["valor_unitario", "preco", "preco_unitario", "vlr_unitario"]);
            // Ex.: "Vlr. Total Produto" -> vlr_total_produto
            const lineStr = get(r, ["valor_total_item", "total_item", "valor_item", "vlr_total_produto"]);

            // Parcelas: vencimento1/valor1, vencimento2/valor2, vencimento3/valor3
            const v1 = get(r, ["vencimento1", "vencimento_1"]);
            const v2 = get(r, ["vencimento2", "vencimento_2"]);
            const v3 = get(r, ["vencimento3", "vencimento_3"]);
            const p1 = get(r, ["valor1", "valor_1"]);
            const p2 = get(r, ["valor2", "valor_2"]);
            const p3 = get(r, ["valor3", "valor_3"]);

            const parcelas = [
              { idx: 1, data: v1, valor: p1 },
              { idx: 2, data: v2, valor: p2 },
              { idx: 3, data: v3, valor: p3 },
            ].filter((x) => (x.data && x.data.trim() !== "") || (x.valor && x.valor.trim() !== ""));

            const vencDate = parseDate2(venc);
            const emissaoDate = parseDate2(emissao);
            const unit = parseNumber(unitStr);
            const line = parseNumber(lineStr);
            const qtd = parseNumber(qtdStr);
            const totalNota = parseNumber(totalNotaStr);

            // Se houver parcelas, criar uma fatura por parcela
            let primaryInvoiceId: string | null = null;
            if (parcelas.length > 0) {
              for (const parc of parcelas) {
                const d = parseDate2(parc.data);
                const val = parseNumber(parc.valor);
                const key = `${cnpj}|${fornecedor || supplierGlobal}|${nf}|${serie}|${d.toISOString().slice(0,10)}|parc${parc.idx}`;
                let inv = invByKey.get(key);
                if (!inv) {
                  inv = {
                    id: crypto.randomUUID(),
                    user_id: "local-user",
                    fornecedor: fornecedor || supplierByCNPJ[cnpj] || findNameNearCNPJ(cnpj) || supplierGlobal || "Fornecedor desconhecido",
                    cnpj,
                    vencimento: d.toISOString(),
                    total: val > 0 ? val : 0,
                    arquivo_url: url,
                    // Em parcelas, o valor informado já é o valor da parcela.
                    // Não somamos itens repetidos da mesma parcela.
                    sum: 0,
                    parcela: parc.idx,
                  };
                  invByKey.set(key, inv);
                  invoices.push(inv);
                } else {
                  // Mesma parcela (mesmo fornecedor/CNPJ/data/índice):
                  // não somar valores iguais. Se diferente, manter o maior.
                  if (val > 0) {
                    const same = Math.abs((inv.total || 0) - val) < 0.01;
                    if (!same) {
                      inv.total = Math.max(inv.total || 0, val);
                    }
                  }
                }
                if (!primaryInvoiceId) primaryInvoiceId = inv.id;
              }
            } else {
              // Sem parcelas informadas: manter comportamento anterior
              const key = `${cnpj}|${fornecedor || supplierByCNPJ[cnpj] || supplierGlobal}|${nf}|${serie}|${vencDate.toISOString().slice(0,10)}`;
              let inv = invByKey.get(key);
              if (!inv) {
                inv = {
                  id: crypto.randomUUID(),
                  user_id: "local-user",
                  fornecedor: fornecedor || supplierByCNPJ[cnpj] || findNameNearCNPJ(cnpj) || supplierGlobal || "Fornecedor desconhecido",
                  cnpj,
                  vencimento: vencDate.toISOString(),
                  total: 0,
                  arquivo_url: url,
                  sum: 0,
                  parcela: undefined,
                };
                invByKey.set(key, inv);
                invoices.push(inv);
              }
              inv.sum = (inv.sum || 0) + (line > 0 ? line : unit);
              inv.total = totalNota > 0 ? totalNota : inv.sum;
              primaryInvoiceId = inv.id;
            }

            // Registrar produto relacionado à primeira parcela (ou à fatura padrão)
            products.push({
              id: crypto.randomUUID(),
              invoice_id: primaryInvoiceId || invoices[invoices.length - 1]?.id || crypto.randomUUID(),
              nome: desc || codigo || "Item CSV",
              data_compra: emissaoDate.toISOString(),
              valor_unitario: unit > 0 ? unit : (line > 0 && qtd > 0 ? Number((line / qtd).toFixed(2)) : 0),
            });
          }
        } else {
          // Caminho sem cabeçalho: tratar cada linha como array e agrupar por fornecedor+cnpj+vencimento
          const rows = useTwoSpaces
            ? (parseTwoSpace(raw, false).rows as string[][])
            : (parseCSV(raw, {
                delimiter,
                columns: false,
                skip_empty_lines: true,
                relax_column_count: true,
                trim: true,
                quote: '"',
                escape: '"',
                relax_quotes: true,
                skip_records_with_error: true,
              }) as string[][]);

          type Key = string;
          const invByKey = new Map<Key, Invoice>();

          const findBestAlpha = (fields: string[]) => {
            const alpha = fields.filter((f) => /[A-Za-zÀ-ÿ]/.test(f)).map((f) => f.trim());
            return alpha.sort((a, b) => b.length - a.length)[0] || "Fornecedor desconhecido";
          };
          const findBestName = (fields: string[]) => {
            const alpha = fields.filter((f) => /[A-Za-zÀ-ÿ]/.test(f)).map((f) => f.trim());
            return alpha.sort((a, b) => b.length - a.length)[0] || "Item CSV";
          };
          const findCNPJ = (fields: string[]) => {
            for (const f of fields) {
              const m = String(f).match(cnpjRegex);
              if (m) return m[0];
            }
            return "";
          };
          const findDate = (fields: string[]) => {
            for (const f of fields) {
              const dmy = String(f).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
              if (dmy) return new Date(`${dmy[3]}-${dmy[2]}-${dmy[1]}`);
              const d = new Date(f);
              if (!isNaN(d.getTime())) return d;
            }
            return new Date();
          };
          const findUnitValueAndLineTotal = (fields: string[]) => {
            // assumir que os dois últimos numéricos são preço unitário e total da linha
            let unit = 0;
            let line = 0;
            const nums: number[] = [];
            for (let i = 0; i < fields.length; i++) {
              const n = parseNumber(fields[i]);
              if (n > 0) nums.push(n);
            }
            if (nums.length >= 2) {
              unit = nums[nums.length - 2];
              line = nums[nums.length - 1];
            } else if (nums.length === 1) {
              unit = nums[0];
              line = nums[0];
            }
            return { unit, line };
          };

          const extractByPositions = (fields: string[]) => {
            const idxCNPJ = fields.findIndex((f) => cnpjRegex.test(String(f)));
            const fornecedor = idxCNPJ > 0 ? String(fields[idxCNPJ - 1]).trim() : findBestAlpha(fields);
            const vencDate = idxCNPJ >= 0 && fields[idxCNPJ + 1] ? findDate([fields[idxCNPJ + 1]]) : findDate(fields);
            // descrição: tentar alguns índices típicos após CNPJ (código, descrição, quantidade, unidade, preço, total)
            const candidateDescIdxs = [idxCNPJ + 5, idxCNPJ + 4, idxCNPJ + 6, idxCNPJ + 3].filter((i) => i >= 0 && i < fields.length);
            let nome = "";
            for (const i of candidateDescIdxs) {
              const val = String(fields[i]).trim();
              if (/[A-Za-zÀ-ÿ]/.test(val)) { nome = val; break; }
            }
            if (!nome) nome = findBestName(fields);
            const { unit, line } = findUnitValueAndLineTotal(fields);
            return { fornecedor, vencDate, nome, unit, line };
          };

          for (const fields of rows) {
            const cnpj = findCNPJ(fields);
            const pos = extractByPositions(fields);
            const fornecedor = pos.fornecedor;
            const vencDate = pos.vencDate;
            const key = `${cnpj}|${fornecedor}|${vencDate.toISOString().slice(0, 10)}`;
            let inv = invByKey.get(key);
            if (!inv) {
              inv = {
                id: crypto.randomUUID(),
                user_id: "local-user",
                fornecedor,
                cnpj,
                vencimento: vencDate.toISOString(),
                total: 0,
                arquivo_url: url,
              };
              invByKey.set(key, inv);
              invoices.push(inv);
            }

            const nome = pos.nome;
            const valor = pos.unit; // valor_unitario deve ser preço unitário
            const lineTotal = pos.line; // somar no total da fatura para refletir custo real
            products.push({
              id: crypto.randomUUID(),
              invoice_id: inv.id,
              nome,
              data_compra: vencDate.toISOString(),
              valor_unitario: valor,
            });
            inv.total += lineTotal > 0 ? lineTotal : valor;
          }
        }
      } else {
        // Fluxo PDF atual usando pdf2json
        const require = createRequire(process.cwd() + "/");
        const PDFParser = require("pdf2json");
        const parser = new PDFParser();
        const data: any = await new Promise((resolve, reject) => {
          parser.on("pdfParser_dataReady", (d: any) => resolve(d));
          parser.on("pdfParser_dataError", (err: any) => reject(err?.parserError || err));
          parser.loadPDF(pathOnDisk);
        });
        const lines = [] as string[];
        for (const page of data?.Pages || []) {
          for (const t of page.Texts || []) {
            const chunk = (t.R?.[0]?.T ? decodeURIComponent(t.R[0].T) : "").trim();
            if (chunk) lines.push(chunk);
          }
        }
        const text = lines.join("\n");

        // Heurísticas simples para extrair campos
        const cnpjMatch = text.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/) || text.match(/\b\d{14}\b/);
        const dateMatch = text.match(/\b\d{2}\/\d{2}\/\d{4}\b/) || text.match(/\b\d{4}-\d{2}-\d{2}\b/);
        const totalMatch = text.match(/Total\s*[:\-]?\s*(\d+[\.,]?\d*)/i);

        const invId = crypto.randomUUID();
        const inv: Invoice = {
          id: invId,
          user_id: "local-user",
          fornecedor: "Fornecedor desconhecido",
          cnpj: cnpjMatch ? cnpjMatch[0] : "",
          vencimento: dateMatch ? new Date(dateMatch[0].replace(/(\d{2})\/(\d{2})\/(\d{4})/, "$3-$2-$1")).toISOString() : new Date().toISOString(),
          total: totalMatch ? Number(String(totalMatch[1]).replace(/\./g, "").replace(/,/, ".")) : 0,
          arquivo_url: url,
        };
        invoices.push(inv);

        // Produtos: tentar extrair de linhas que parecem conter nome e valor
        const productCandidates = lines.filter((l) => /[A-Za-zÀ-ÿ]/.test(l) && /\d/.test(l)).slice(0, 5);
        if (productCandidates.length === 0) {
          products.push({
            id: crypto.randomUUID(),
            invoice_id: invId,
            nome: "Item 1",
            data_compra: inv.vencimento,
            valor_unitario: 0,
          });
          products.push({
            id: crypto.randomUUID(),
            invoice_id: invId,
            nome: "Item 2",
            data_compra: inv.vencimento,
            valor_unitario: 0,
          });
        } else {
          for (const cand of productCandidates) {
            const name = cand.replace(/\s*\d+[\.,]?\d*\s*(kg|un|g|l)?/gi, "").trim().slice(0, 60) || "Item";
            const valueMatch = cand.match(/\b(\d+[\.,]?\d*)\b(?!.*\d)/);
            const value = valueMatch ? Number(String(valueMatch[1]).replace(/\./g, "").replace(/,/, ".")) : 0;
            products.push({
              id: crypto.randomUUID(),
              invoice_id: invId,
              nome: name || "Item",
              data_compra: inv.vencimento,
              valor_unitario: value,
            });
          }
        }
      }
    }
    console.log(`[Analyze Local] Extração concluída: invoices=${invoices.length}, products=${products.length}`);
    if (invoices.length === 0) {
      // Se não conseguimos extrair nada, recai para DEMO para não quebrar UX
      return buildDemo();
    }
    return { invoices, products, mode: "local" };
  } catch (e) {
    console.error("[Analyze Local] Falha na extração local", e);
    return { invoices: [], products: [], mode: "local" };
  }
}

// Fallback DEMO para quando a extração local não retorna resultados.
// Mantém a aplicação funcional e demonstrável mesmo sem arquivos válidos.
function buildDemo(): { invoices: Invoice[]; products: Product[]; mode: "demo" } {
  const today = new Date();
  const addDays = (d: number) => new Date(today.getTime() + d * 24 * 60 * 60 * 1000);

  const inv1: Invoice = {
    id: crypto.randomUUID(),
    user_id: "demo-user",
    fornecedor: "Demo Fornecedor LTDA",
    cnpj: "12.345.678/0001-90",
    vencimento: addDays(7).toISOString(),
    total: 1299.9,
    arquivo_url: "/uploads/demo-invoice-1.pdf",
  };
  const inv2: Invoice = {
    id: crypto.randomUUID(),
    user_id: "demo-user",
    fornecedor: "Tech Supplies SA",
    cnpj: "98.765.432/0001-10",
    vencimento: addDays(15).toISOString(),
    total: 249.5,
    arquivo_url: "/uploads/demo-invoice-2.pdf",
  };
  const inv3: Invoice = {
    id: crypto.randomUUID(),
    user_id: "demo-user",
    fornecedor: "Alimentos & Cia",
    cnpj: "11.222.333/0001-44",
    vencimento: addDays(30).toISOString(),
    total: 980.0,
    arquivo_url: "/uploads/demo-invoice-3.pdf",
  };

  const products: Product[] = [
    {
      id: crypto.randomUUID(),
      invoice_id: inv1.id,
      nome: "Notebook 14",
      data_compra: inv1.vencimento,
      valor_unitario: 1299.9,
    },
    {
      id: crypto.randomUUID(),
      invoice_id: inv2.id,
      nome: "Teclado Mecânico",
      data_compra: inv2.vencimento,
      valor_unitario: 249.5,
    },
    {
      id: crypto.randomUUID(),
      invoice_id: inv3.id,
      nome: "Cesta de Alimentos",
      data_compra: inv3.vencimento,
      valor_unitario: 480.0,
    },
    {
      id: crypto.randomUUID(),
      invoice_id: inv3.id,
      nome: "Bebidas",
      data_compra: inv3.vencimento,
      valor_unitario: 500.0,
    },
  ];

  return { invoices: [inv1, inv2, inv3], products, mode: "demo" };
}