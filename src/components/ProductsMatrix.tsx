"use client";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";

type Product = { id: string; invoice_id: string; nome: string; data_compra: string; valor_unitario: number };

export default function ProductsMatrix() {
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => {
    (async () => {
      const res = await fetch("/api/invoices");
      const data = await res.json();
      setProducts(data.products ?? []);
    })();
  }, []);

  const days = useMemo(() => Array.from({ length: 31 }, (_, i) => i + 1), []);
  const rows = useMemo(() => {
    const byName: Record<string, Product[]> = {};
    products.forEach((p) => {
      byName[p.nome] = byName[p.nome] || [];
      byName[p.nome].push(p);
    });
    return Object.entries(byName);
  }, [products]);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr>
            <th className="p-2 text-left">Produto</th>
            {days.map((d) => (
              <th key={d} className="p-2 text-center">{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, items]) => (
            <tr key={name} className="border-t">
              <td className="p-2 font-medium">{name}</td>
              {days.map((d) => {
                const sameDay = items.filter((i) => new Date(i.data_compra).getDate() === d);
                // Preferir item com valor_unitario > 0; se todos 0, usar o primeiro
                const item = sameDay.sort((a, b) => (b.valor_unitario || 0) - (a.valor_unitario || 0))[0];
                return (
                  <td key={d} className="p-2 text-center">
                    {item ? (
                      <span title={`Compra: ${format(new Date(item.data_compra), "dd/MM/yyyy")}`}>
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.valor_unitario)}
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={32} className="p-4 text-center text-zinc-500">Nenhum produto encontrado.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}