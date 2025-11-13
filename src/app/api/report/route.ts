import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "E-mail não informado" }, { status: 400 });
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.FROM_EMAIL || "onboarding@resend.dev";
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "RESEND_API_KEY não configurada" }, { status: 500 });
  }
  const resend = new Resend(apiKey);
  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: "Relatório Consolidado",
      html: `
        <div style="font-family: Arial, sans-serif; font-size:14px; line-height:1.4;">
          <h2>Relatório Consolidado</h2>
          <p>Olá,</p>
          <p>Seu relatório consolidado será disponibilizado em breve neste dashboard.</p>
          <p>Este é um e-mail de confirmação de teste do ambiente.</p>
          <hr/>
          <p style="color:#6b7280">Enviado automaticamente pelo sistema de Controle de Notas e Produtos.</p>
        </div>
      `,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true, id: data?.id, sentTo: email });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Falha ao enviar e-mail" }, { status: 500 });
  }
}