import React, { useMemo, useState } from "react";

interface Visit {
  id: string;
  name: string;
  phone: string;
  service: string;
  address: string;
  preferDate: string; // YYYY-MM-DD
  preferTime: string; // HH:mm
  status: "pendente" | "confirmed" | "cancelado" | "concluído";
  notes?: string;
}

interface Slot {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  type: "internal" | "blocked" | "visit";
  notes?: string;
}

interface Props {
  visits: Visit[];
  slots: Slot[];
  onSelectVisit?: (visit: Visit) => void;
  onSelectSlot?: (slot: Slot) => void;
  onCreateSlot?: (date: string) => void;
}

const MONTHS_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const WEEKDAYS_PT = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

export default function AgendaCalendar({ visits, slots, onSelectVisit, onSelectSlot, onCreateSlot }: Props) {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());

  // Agrupar visitas por fecha YYYY-MM-DD
  const visitsByDate = useMemo(() => {
    const map: Record<string, Visit[]> = {};
    visits.forEach((v) => {
      if (!v.preferDate) return;
      if (!map[v.preferDate]) map[v.preferDate] = [];
      map[v.preferDate].push(v);
    });
    return map;
  }, [visits]);

  // Agrupar slots por fecha
  const slotsByDate = useMemo(() => {
    const map: Record<string, Slot[]> = {};
    slots.forEach((s) => {
      if (!s.date) return;
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    });
    return map;
  }, [slots]);

  // Construir la cuadrícula del mes
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startWeekday = firstDay.getDay(); // 0 = domingo
    const totalDays = lastDay.getDate();

    const days: { date: Date | null; key: string }[] = [];
    // Días vacíos al principio
    for (let i = 0; i < startWeekday; i++) {
      days.push({ date: null, key: `empty-start-${i}` });
    }
    // Días del mes
    for (let d = 1; d <= totalDays; d++) {
      const date = new Date(currentYear, currentMonth, d);
      const key = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push({ date, key });
    }
    // Rellenar hasta múltiplo de 7
    while (days.length % 7 !== 0) {
      days.push({ date: null, key: `empty-end-${days.length}` });
    }
    return days;
  }, [currentYear, currentMonth]);

  const goPrev = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(currentYear - 1); }
    else setCurrentMonth(currentMonth - 1);
  };
  const goNext = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(currentYear + 1); }
    else setCurrentMonth(currentMonth + 1);
  };
  const goToday = () => { setCurrentYear(today.getFullYear()); setCurrentMonth(today.getMonth()); };

  const statusColor: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800 border-amber-300",
    confirmed: "bg-emerald-100 text-emerald-800 border-emerald-300",
    cancelled: "bg-rose-100 text-rose-800 border-rose-300",
    completed: "bg-slate-100 text-slate-700 border-slate-300",
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
      {/* Header del calendario */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <button onClick={goPrev} className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-sm hover:bg-slate-200">‹</button>
          <h3 className="text-lg font-black text-slate-900 dark:text-white min-w-[180px] text-center">
            {MONTHS_PT[currentMonth]} {currentYear}
          </h3>
          <button onClick={goNext} className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-sm hover:bg-slate-200">›</button>
        </div>
        <button onClick={goToday} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100">
          Hoje
        </button>
      </div>

      {/* Cabecera días de la semana */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS_PT.map((d) => (
          <div key={d} className="text-center text-[10px] font-black uppercase text-slate-400 py-1">{d}</div>
        ))}
      </div>

      {/* Cuadrícula */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map(({ date, key }) => {
          if (!date) return <div key={key} className="min-h-[80px] rounded-lg bg-slate-50/50 dark:bg-slate-800/30" />;
          const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
          const dayVisits = visitsByDate[dateKey] || [];
          const daySlots = slotsByDate[dateKey] || [];
          const isToday =
            date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();

          return (
            <div
              key={key}
              className={`min-h-[80px] rounded-lg border p-1.5 transition ${
                isToday
                  ? "border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30"
                  : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              }`}
            >
              <div className={`text-xs font-bold mb-1 ${isToday ? "text-indigo-700 dark:text-indigo-300" : "text-slate-500"}`}>
                {date.getDate()}
              </div>
              <div className="space-y-0.5">
                {daySlots.slice(0, 2).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => onSelectSlot?.(s)}
                    className={`w-full text-left text-[10px] font-bold px-1.5 py-0.5 rounded border truncate ${
                      s.type === "blocked" ? "bg-slate-200 text-slate-700 border-slate-300" :
                      s.type === "visit" ? "bg-indigo-100 text-indigo-800 border-indigo-300" :
                      "bg-purple-100 text-purple-800 border-purple-300"
                    }`}
                    title={`${s.startTime}–${s.endTime} — ${s.title}`}
                  >
                    {s.startTime} {s.title}
                  </button>
                ))}
                {dayVisits.slice(0, 2).map((v) => (
                  <button
                    key={v.id}
                    onClick={() => onSelectVisit?.(v)}
                    className={`w-full text-left text-[10px] font-bold px-1.5 py-0.5 rounded border truncate ${statusColor[v.status] || statusColor.pending}`}
                    title={`${v.preferTime} — ${v.name} (${v.service})`}
                  >
                    {v.preferTime} {v.name.split(" ")[0]}
                  </button>
                ))}
                {(dayVisits.length + daySlots.length) > 4 && (
                  <div className="text-[10px] font-bold text-slate-400 pl-1">+{dayVisits.length + daySlots.length - 4} mais</div>
                )}
                {onCreateSlot && (
                  <button
                    onClick={() => onCreateSlot(dateKey)}
                    className="w-full text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 rounded px-1 py-0.5 text-left"
                  >
                    + Bloco
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 text-[10px] font-bold">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-300 border border-amber-400" /> Pendente</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-300 border border-emerald-400" /> Confirmada</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-rose-300 border border-rose-400" /> Cancelada</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-slate-300 border border-slate-400" /> Concluída</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-purple-300 border border-purple-400" /> Cita interna</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-slate-200 border border-slate-300" /> Hora bloqueada</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-indigo-300 border border-indigo-400" /> Visita técnica</span>
      </div>
    </div>
  );
}
