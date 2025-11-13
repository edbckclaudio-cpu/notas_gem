"use client";
import { useEffect, useState } from "react";
import { Input } from "./ui/input";
import Button from "./ui/button";

export default function EmailGate() {
  const [open, setOpen] = useState(true);
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = typeof window !== "undefined" ? localStorage.getItem("userEmail") : null;
      if (stored && stored.includes("@")) {
        setOpen(false);
      } else {
        setOpen(true);
      }
    } catch {
      setOpen(true);
    }
  }, []);

  // Permite reabrir o pop-up via evento global
  useEffect(() => {
    function handleOpen() {
      try {
        const stored = typeof window !== "undefined" ? localStorage.getItem("userEmail") : "";
        setEmail(stored || "");
      } catch {}
      setError(null);
      setOpen(true);
    }
    window.addEventListener("emailGate:open", handleOpen);
    return () => window.removeEventListener("emailGate:open", handleOpen);
  }, []);

  function isValidEmail(e: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  }

  async function save() {
    setError(null);
    if (!isValidEmail(email)) {
      setError("Informe um e-mail válido.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || "Falha ao salvar e-mail.");
        return;
      }
      localStorage.setItem("userEmail", email);
      setOpen(false);
    } catch (e: any) {
      setError(e?.message || "Erro inesperado.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop bloqueando interação */}
      <div className="absolute inset-0 bg-black/50" aria-hidden></div>
      {/* Painel central */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-lg bg-white shadow-xl border border-zinc-200">
          <div className="p-4 border-b border-zinc-200">
            <h3 className="text-lg font-semibold">Informe seu e-mail</h3>
            <p className="mt-1 text-sm text-zinc-600">Este passo é obrigatório para acessar o site.</p>
          </div>
          <div className="p-4 space-y-3">
            <Input
              type="email"
              placeholder="seuemail@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  save();
                }
              }}
            />
            {error && <div className="text-sm text-red-600">{error}</div>}
            <Button
              className="w-full"
              loading={saving}
              loadingText="Salvando…"
              onClick={save}
            >
              Continuar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}