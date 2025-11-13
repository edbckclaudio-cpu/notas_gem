"use client";
import { useEffect, useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type Product = { id: string; invoice_id: string; nome: string; data_compra: string; valor_unitario: number };

export default function ProductCharts() {
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => {
    (async () => {
      const res = await fetch("/api/invoices");
      const data = await res.json();
      setProducts(data.products ?? []);
    })();
  }, []);

  const series = useMemo(() => {
    const byName: Record<string, { date: Date; valor: number }[]> = {};
    products.forEach((p) => {
      const date = new Date(p.data_compra);
      byName[p.nome] = byName[p.nome] || [];
      byName[p.nome].push({ date, valor: p.valor_unitario });
    });
    return Object.entries(byName);
  }, [products]);

  // Simulated SELIC line (e.g., fixed 10% baseline), mapped by day index
  function selicValue(dayIndex: number) {
    return 10 + Math.sin(dayIndex / 5) * 0.5; // small variation around 10
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {series.map(([name, pts]) => {
        const data = pts
          .sort((a, b) => a.date.getTime() - b.date.getTime())
          .map((p, idx) => ({ x: p.date.toISOString().slice(0, 10), valor: p.valor, selic: selicValue(idx) }));
        return (
          <div key={name} className="h-64">
            <h4 className="mb-2 font-medium">{name}</h4>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="x" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="valor" stroke="#2563eb" strokeWidth={2} name="Valor Unitário" />
                <Line type="monotone" dataKey="selic" stroke="#16a34a" strokeWidth={2} name="SELIC (simulada)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        );
      })}
      {series.length === 0 && <div className="text-sm text-zinc-500">Nenhum dado para gráficos.</div>}
    </div>
  );
}