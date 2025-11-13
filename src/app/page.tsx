"use client";
import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import Button from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Drawer } from "../components/ui/drawer";
import CalendarView from "../components/CalendarView";
import SuppliersTable from "../components/SuppliersTable";
import ProductsMatrix from "../components/ProductsMatrix";
import ProductCharts from "../components/ProductCharts";
import { toast } from "sonner";

export default function Dashboard() {
  const [email, setEmail] = useState<string>("");
  const [manageOpen, setManageOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [files, setFiles] = useState<{ name: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);
  const [busyFile, setBusyFile] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Array<{ id: string; fornecedor: string; cnpj: string; vencimento: string; total: number }>>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [csvOpen, setCsvOpen] = useState(false);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [csvAlign, setCsvAlign] = useState<("left"|"right")[]>([]);
  const [csvMoneyCols, setCsvMoneyCols] = useState<number[]>([]);

  // Formata valores monetários para duas casas decimais com vírgula
  function formatCsvMoney(raw: any): string {
    const s = String(raw ?? '').trim();
    if (!s) return '';
    // Tenta normalizar ponto/virgula como separador decimal
    // Remove quaisquer caracteres não numéricos exceto . , -
    const cleaned = s.replace(/[^0-9.,-]/g, '');
    // Se existir vírgula, assume que é separador decimal; caso contrário usa ponto
    let normalized: string;
    if (cleaned.includes(',')) {
      // Remove possíveis pontos de milhar e troca vírgula por ponto
      normalized = cleaned.replace(/\./g, '').replace(/,/g, '.');
    } else {
      normalized = cleaned;
    }
    const num = Number.parseFloat(normalized);
    if (Number.isNaN(num)) return s; // não é número, devolve original
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  async function refreshFiles() {
    const res = await fetch("/api/files");
    const data = await res.json();
    setFiles(data.files ?? []);
  }

  useEffect(() => {
    // Preenche o e-mail a partir do localStorage, se existir
    try {
      const stored = typeof window !== "undefined" ? localStorage.getItem("userEmail") : null;
      if (stored && stored.includes("@")) setEmail(stored);
    } catch {}

    refreshFiles();
    (async () => {
      const res = await fetch("/api/invoices");
      const data = await res.json();
      setInvoices(data.invoices ?? []);
    })();
  }, []);

  const suppliersForSelected = useMemo(() => {
    if (!selectedDate) return [] as Array<{ fornecedor: string; cnpj: string; total: number }>;
    const day = selectedDate.getDate();
    const month = selectedDate.getMonth();
    const year = selectedDate.getFullYear();
    const sameDay = invoices.filter((i) => {
      const d = new Date(i.vencimento);
      return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
    });
    const map = new Map<string, { fornecedor: string; cnpj: string; total: number }>();
    sameDay.forEach((i) => {
      const key = i.cnpj;
      const prev = map.get(key);
      if (prev) prev.total += i.total; else map.set(key, { fornecedor: i.fornecedor, cnpj: i.cnpj, total: i.total });
    });
    return Array.from(map.values());
  }, [selectedDate, invoices]);

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-6xl p-6">
        <header className="mb-6">
          <h1 className="text-2xl font-bold">📊 Controle de Notas e Produtos</h1>
          <p className="text-sm text-zinc-600">Cadastre seu e-mail para receber relatórios consolidados futuramente.</p>
          <div className="mt-3 flex gap-3 max-w-xl items-start">
            <Input
              type="email"
              placeholder="Digite seu e-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button
              variant="outline"
              loading={savingEmail}
              loadingText="Salvando…"
              onClick={async () => {
                if (!email) return toast.error("Informe um e-mail válido");
                setSavingEmail(true);
                try {
                  const res = await fetch("/api/user", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
                  if (res.ok) {
                    toast.success(`E-mail salvo: ${email}`);
                    try { localStorage.setItem("userEmail", email); } catch {}
                  } else {
                    toast.error("Falha ao salvar e-mail");
                  }
                } finally {
                  setSavingEmail(false);
                }
              }}
            >
              Salvar e-mail
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                try {
                  window.dispatchEvent(new Event("emailGate:open"));
                } catch {}
              }}
            >
              Alterar e-mail
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="whitespace-nowrap"
              title="Enviar relatório consolidado por e-mail"
              loading={sendingReport}
              loadingText="Enviando…"
              onClick={async () => {
                if (!email || !email.includes("@")) {
                  return toast.error("Informe um e-mail válido antes de enviar.");
                }
                setSendingReport(true);
                try {
                  const res = await fetch("/api/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
                  if (res.ok) toast.success(`Relatório enviado para: ${email || "(sem e-mail)"}`);
                  else toast.error("Falha ao enviar relatório");
                } finally {
                  setSendingReport(false);
                }
              }}
            >
              💌 Enviar Relatório Consolidado
            </Button>
          </div>
        </header>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload / Armazenamento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <input type="file" accept="application/pdf" multiple className="block w-full" id="file-input" />
                <div className="flex flex-col gap-3">
                  <Button
                    variant="success"
                    loading={uploading}
                    loadingText="Armazenando…"
                    onClick={async () => {
                      const input = document.getElementById("file-input") as HTMLInputElement | null;
                      if (!input || !input.files || input.files.length === 0) return;
                      const fd = new FormData();
                      Array.from(input.files).forEach((f) => fd.append("files", f));
                      setUploading(true);
                      const res = await fetch("/api/upload", { method: "POST", body: fd });
                      setUploading(false);
                      if (res.ok) { refreshFiles(); toast.success("Arquivo(s) armazenado(s) com sucesso"); }
                      else { toast.error("Falha ao armazenar arquivos"); }
                    }}
                    className="w-full whitespace-nowrap"
                  >
                    🟩 Armazenar
                  </Button>
                  <Button variant="warning" onClick={() => setManageOpen(true)} className="w-full whitespace-nowrap">🟨 Gerenciar</Button>
                  <Button
                    variant="outline"
                    loading={csvLoading}
                    loadingText="Abrindo CSV…"
                    onClick={async () => {
                      setCsvLoading(true);
                      try {
                        const res = await fetch(`/api/csv?all=1`);
                        const data = await res.json();
                        if (!res.ok || !data?.files) {
                          toast.error(data?.error || "Falha ao abrir CSV");
                          return;
                        }
                        const filesData: Array<{ name: string; rows: string[][] }> = data.files || [];
                        if (filesData.length === 0) {
                          toast.error("Nenhum arquivo CSV encontrado em uploads");
                          return;
                        }
                        // Montar uma tabela única com separadores por arquivo
                        const combined: string[][] = [];
                        for (const f of filesData) {
                          // linha separadora com nome do arquivo
                          combined.push([`Arquivo: ${f.name}`]);
                          for (const r of f.rows) combined.push(r);
                        }
                        setCsvRows(combined);
                        const colCount = Math.max(...combined.map((r: string[]) => r.length));
                        const align: ("left"|"right")[] = [];
                        for (let c = 0; c < colCount; c++) {
                          let numeric = 0, filled = 0;
                          for (const r of combined) {
                            const cell = r[c] ?? "";
                            if (cell.trim() !== "") filled++;
                            if (/^\s*-?\d+[\d\.,]*\s*$/.test(cell)) numeric++;
                          }
                          align[c] = filled > 0 && numeric / Math.max(filled,1) >= 0.6 ? "right" : "left";
                        }
                        setCsvAlign(align);
                        // Detectar colunas de dinheiro pelos cabeçalhos de todos arquivos
                        const normalizeHeader = (s: string) => s?.normalize?.('NFD')?.replace(/[\u0300-\u036f]/g, '')?.toLowerCase?.() || '';
                        const headerCandidates: string[] = [];
                        for (const f of filesData) {
                          const header = f.rows?.[0] || [];
                          for (const h of header) headerCandidates.push(String(h));
                        }
                        const moneyCols: number[] = [];
                        // mapear sobre a primeira header mais longa para índices
                        const longestHeader = filesData.map(f => f.rows?.[0] || []).sort((a,b)=>b.length-a.length)[0] || [];
                        longestHeader.forEach((h, idx) => {
                          const nh = normalizeHeader(String(h));
                          if (nh.includes('vlr. unitario') || nh.includes('vlr unitario')) moneyCols.push(idx);
                          if (nh.includes('vlr. total produto') || nh.includes('vlr total produto')) moneyCols.push(idx);
                        });
                        setCsvMoneyCols(moneyCols);
                        setCsvOpen(true);
                      } finally {
                        setCsvLoading(false);
                      }
                    }}
                    className="w-full whitespace-nowrap"
                  >
                    📄 Ver arquivo CSV
                  </Button>
                  <Button
                    variant="info"
                    loading={analyzing}
                    loadingText="Analisando…"
                    onClick={async () => {
                      setAnalyzing(true);
                      try {
                        const res = await fetch("/api/analyze", { method: "POST" });
                        const data = await res.json().catch(() => ({}));
                        setAnalyzing(false);
                        if (!res.ok) {
                          toast.error(data?.error || "Falha na análise");
                          return;
                        }
                        // Feedback amigável conforme modo
                        if (data?.mode === "demo") {
                          toast.warning("Análise real indisponível. Usando dados simulados.");
                        } else if (data?.mode === "local") {
                          toast.success("Análise local concluída.");
                        } else {
                          toast.success("Análise concluída com IA real.");
                        }
                        // Atualiza os dados no dashboard
                        const invRes = await fetch("/api/invoices");
                        const invData = await invRes.json();
                        setInvoices(invData.invoices ?? []);
                        // Recarrega a tela para refletir todos os componentes que
                        // carregam dados no mount (Calendário, Fornecedores, Matriz, Gráficos)
                        setTimeout(() => {
                          if (typeof window !== "undefined") {
                            window.location.reload();
                          }
                        }, 800);
                      } catch (e: any) {
                        setAnalyzing(false);
                        toast.error(e?.message || "Erro inesperado na análise");
                      }
                    }}
                    className="w-full whitespace-nowrap"
                  >
                    🟦 Analisar
                  </Button>
                </div>
                {analyzing && (
                  <p className="text-sm text-zinc-600">Analisando arquivos com Gemini…</p>
                )}
                {uploading && (
                  <p className="text-sm text-zinc-600">Enviando arquivos…</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>📅 Calendário de Vencimentos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-zinc-600">Datas com vencimento aparecem em amarelo (#FFD700).</p>
                <Button variant="outline" onClick={() => setCalendarOpen(true)}>Abrir detalhes do dia</Button>
              </div>
              <CalendarView onSelectDate={(date) => { setSelectedDate(date); setCalendarOpen(true); }} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>📋 Fornecedores</CardTitle>
            </CardHeader>
            <CardContent>
              <SuppliersTable />
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>📦 Matriz de Produtos</CardTitle>
            </CardHeader>
            <CardContent>
              <ProductsMatrix />
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>📈 Variação de Preços</CardTitle>
            </CardHeader>
            <CardContent>
              <ProductCharts />
            </CardContent>
          </Card>
        </section>

        
      </div>

      {/* Drawer Gerenciar */}
      <Drawer open={manageOpen} onClose={() => setManageOpen(false)} title="Gerenciar Arquivos">
        <div className="space-y-3">
          {files.length === 0 && (
            <div className="text-sm text-zinc-700">Nenhum arquivo armazenado.</div>
          )}
          {files.map((f) => (
            <div key={f.name} className="flex items-center justify-between text-sm">
              <a href={f.url} target="_blank" className="text-blue-600 hover:underline" rel="noreferrer">
                {f.name}
              </a>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="border-zinc-300"
                  loading={busyFile === `rename:${f.name}`}
                  loadingText="Renomeando…"
                  onClick={async () => {
                    const novo = prompt("Novo nome:", f.name) ?? f.name;
                    if (!novo || novo === f.name) return;
                    setBusyFile(`rename:${f.name}`);
                    try {
                      const res = await fetch("/api/files", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ from: f.name, to: novo })
                      });
                      if (res.ok) { refreshFiles(); toast.success("Arquivo renomeado"); } else { toast.error("Falha ao renomear"); }
                    } finally {
                      setBusyFile(null);
                    }
                  }}
                >
                  Renomear
                </Button>
                <Button
                  variant="outline"
                  className="border-red-300 text-red-700 hover:bg-red-50"
                  loading={busyFile === `delete:${f.name}`}
                  loadingText="Excluindo…"
                  onClick={async () => {
                    setBusyFile(`delete:${f.name}`);
                    try {
                      const res = await fetch(`/api/files?name=${encodeURIComponent(f.name)}`, { method: "DELETE" });
                      if (res.ok) { refreshFiles(); toast.success("Arquivo excluído"); } else { toast.error("Falha ao excluir"); }
                    } finally {
                      setBusyFile(null);
                    }
                  }}
                >
                  Excluir
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Drawer>

      {/* Drawer CSV Viewer */}
      <Drawer open={csvOpen} onClose={() => setCsvOpen(false)} title="Visualizar CSV">
        {csvRows.length === 0 && (
          <div className="text-sm text-zinc-700">Nenhum conteúdo de CSV carregado.</div>
        )}
        {csvRows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm table-fixed">
              <tbody>
                {csvRows.map((row, ri) => (
                  <tr key={ri} className="border-t">
                    {row.map((cell, ci) => {
                      const isMoney = csvMoneyCols.includes(ci);
                      const display = isMoney ? formatCsvMoney(cell) : (cell ?? '');
                      return (
                        <td
                          key={ci}
                          className={`p-2 ${csvAlign[ci] === "right" ? "text-right" : "text-left"}`}
                          style={{ width: `${Math.round(100 / Math.max(row.length,1))}%` }}
                        >
                          {display}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Drawer>

      {/* Drawer Calendário */}
      <Drawer open={calendarOpen} onClose={() => setCalendarOpen(false)} title="Notas que vencem nesta data">
        {!selectedDate && <div className="text-sm text-zinc-600">Selecione uma data no calendário.</div>}
        {selectedDate && (
          <div className="space-y-2 text-sm">
            {suppliersForSelected.length === 0 && (
              <div className="text-zinc-600">Nenhuma nota vencendo nesta data.</div>
            )}
            {suppliersForSelected.map((s) => (
              <div key={s.cnpj} className="flex justify-between">
                <span>{s.fornecedor}</span>
                <span>CNPJ: {s.cnpj}</span>
                <span>Total: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(s.total)}</span>
              </div>
            ))}
          </div>
        )}
      </Drawer>
    </div>
  );
}
