"use client";
import { useEffect, useMemo, useState } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
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
  // Soma de vencimentos por dia (yyyy-MM-dd -> total)
  const sumByDay = useMemo(() => {
    const map = new Map<string, number>();
    invoices.forEach((i) => {
      const key = format(new Date(i.vencimento), "yyyy-MM-dd");
      map.set(key, (map.get(key) ?? 0) + (i.total || 0));
    });
    return map;
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
    // Se houver vencimento no dia, destaca levemente o fundo
    const key = format(date, "yyyy-MM-dd");
    if ((sumByDay.get(key) ?? 0) > 0) {
      style.backgroundColor = isToday ? style.backgroundColor : "#fffbe6"; // amarelo bem claro
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

  // Cabeçalho de cada dia no mês: mostra o número do dia e a soma do vencimento
  const DateHeader = ({ label, date }: { label: string; date: Date }) => {
    const key = format(date, "yyyy-MM-dd");
    const sum = sumByDay.get(key) ?? 0;
    return (
      <div className="rbc-datecell-center">
        <span className="day-label">{label}</span>
        {sum > 0 && <span className="sum-badge">{formatBRL(sum)}</span>}
        <span></span>
      </div>
    );
  };

  return (
    <div className="h-[380px] md:h-[440px] calendar-sum">
      <Calendar
        localizer={localizer}
        culture="pt-BR"
        events={[]}
        startAccessor="start"
        endAccessor="end"
        onSelectSlot={(slot: any) => onSelectDate?.(slot.start)}
        selectable
        eventPropGetter={eventPropGetter}
        dayPropGetter={dayPropGetter}
        messages={messages}
        formats={formats}
        components={{
          event: () => null, // não exibe blocos azuis de eventos
          month: { dateHeader: DateHeader },
        }}
        views={["month"]}
        popup={false}
      />
    </div>
  );
}