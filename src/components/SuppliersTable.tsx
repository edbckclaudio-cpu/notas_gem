"use client";
import { useEffect, useState } from "react";

type Supplier = { id: string; nome: string; cnpj: string; endereco?: string; telefone?: string; email?: string };

export default function SuppliersTable() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  useEffect(() => {
    (async () => {
      const res = await fetch("/api/invoices");
      const data = await res.json();
      setSuppliers(data.suppliers ?? []);
    })();
  }, []);
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left">
            <th className="p-2">Nome</th>
            <th className="p-2">CNPJ</th>
            <th className="p-2">Endereço</th>
            <th className="p-2">Telefone</th>
            <th className="p-2">E-mail</th>
          </tr>
        </thead>
        <tbody>
          {suppliers.map((s) => (
            <tr key={s.id} className="border-t">
              <td className="p-2">{s.nome}</td>
              <td className="p-2">{s.cnpj}</td>
              <td className="p-2">{s.endereco ?? "-"}</td>
              <td className="p-2">{s.telefone ?? "-"}</td>
              <td className="p-2">{s.email ?? "-"}</td>
            </tr>
          ))}
          {suppliers.length === 0 && (
            <tr>
              <td colSpan={5} className="p-4 text-center text-zinc-500">Nenhum fornecedor cadastrado.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}