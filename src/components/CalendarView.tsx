"use client";
import { useEffect, useMemo, useState } from "react";
import { Calendar, dateFnsLocalizer, Event as RBCEvent } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";

type Invoice = {
  id: string;
  fornecedor: string;
  cnpj: string;
  vencimento: string;
  total: number;
  parcela?: number;
};

const locales = {
  "pt-BR": ptBR,
};
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

export default function CalendarView({ onSelectDate }: { onSelectDate?: (date: Date) => void }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/invoices");
      const data = await res.json();
      setInvoices(data.invoices ?? []);
    })();
  }, []);

  const formatBRL = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
  const events: RBCEvent[] = useMemo(() => {
    return invoices.map((i) => {
      const parcelaInfo = typeof i.parcela === "number" && i.parcela > 0 ? `Parcela ${i.parcela} • ` : "";
      return {
        title: `${parcelaInfo}${i.fornecedor} • ${formatBRL(i.total)}`,
        start: new Date(i.vencimento),
        end: new Date(i.vencimento),
        allDay: true,
        resource: i,
      };
    });
  }, [invoices]);

  // Estilos dos eventos (mais legíveis e modernos)
  const eventPropGetter = () => ({
    style: {
      backgroundColor: "#2563eb", // azul Tailwind 600
      color: "#fff",
      border: "1px solid #1d4ed8",
      boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
    },
  });

  // Destaque para hoje e leve sombreamento de fim de semana
  const today = new Date();
  const dayPropGetter = (date: Date) => {
    const isToday = date.toDateString() === today.toDateString();
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const style: React.CSSProperties = {};
    if (isWeekend) {
      style.backgroundColor = "#fafafa"; // leve tom para sáb/dom
    }
    if (isToday) {
      style.backgroundColor = "#fff7ed"; // orange-50
      style.outline = "2px solid #f59e0b"; // orange-500
      style.boxShadow = "inset 0 0 0 1px #f59e0b";
    }
    return { style };
  };

  // Labels e mensagens em pt-BR
  const messages = {
    date: "Data",
    time: "Hora",
    event: "Evento",
    allDay: "Dia inteiro",
    week: "Semana",
    work_week: "Semana útil",
    day: "Dia",
    month: "Mês",
    previous: "Anterior",
    next: "Próximo",
    today: "Hoje",
    agenda: "Agenda",
    showMore: (total: number) => `+${total} mais`,
  } as const;

  // Formatos do cabeçalho e dias
  const formats = {
    monthHeaderFormat: (date: Date, culture: string, l: any) => l.format(date, "MMMM yyyy", culture),
    weekdayFormat: (date: Date, culture: string, l: any) => l.format(date, "EEEEE", culture),
    dayRangeHeaderFormat: ({ start, end }: { start: Date; end: Date }, culture: string, l: any) =>
      `${l.format(start, "dd/MM/yyyy", culture)} – ${l.format(end, "dd/MM/yyyy", culture)}`,
  };

  return (
    <div className="h-[380px] md:h-[440px]">
      <Calendar
        localizer={localizer}
        culture="pt-BR"
        events={events}
        startAccessor="start"
        endAccessor="end"
        onSelectSlot={(slot: any) => onSelectDate?.(slot.start)}
        selectable
        eventPropGetter={eventPropGetter}
        dayPropGetter={dayPropGetter}
        messages={messages}
        formats={formats}
        views={["month"]}
        popup
      />
    </div>
  );
}