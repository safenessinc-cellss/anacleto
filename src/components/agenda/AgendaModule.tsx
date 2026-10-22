import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import AgendaCalendar from "./AgendaCalendar";
import AgendaSlotModal from "./AgendaSlotModal";
import { Calendar, Clock, MapPin, Phone, Mail, CheckCircle, XCircle, Trash2, RefreshCw } from "lucide-react";

interface Visit {
  id: string;
  name: string;
  email?: string;
  phone: string;
  service: string;
  address: string;
  preferDate: string;
  preferTime: string;
  notes?: string;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  createdAt: string;
  calendarEventId?: string;
}

export default function AgendaModule() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [slotModalOpen, setSlotModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<any>(null);
  const [defaultSlotDate, setDefaultSlotDate] = useState<string | undefined>(undefined);
  const [filter, setFilter] = useState<"all" | "pending" | "confirmed" | "completed">("all");

  useEffect(() => {
    const q = query(collection(db, "visits"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const list: Visit[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Visit));
      setVisits(list);
      setLoading(false);
    }, (err) => {
      console.error("Visits listener error:", err);
      setLoading(false);
    });
    const unsubSlots = onSnapshot(query(collection(db, "agenda_slots"), orderBy("date", "asc")), (snap) => {
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setSlots(list);
    }, (err) => console.warn("Slots listener:", err));

    return () => { unsub(); unsubSlots(); };
  }, []);

  const updateStatus = async (id: string, status: Visit["status"]) => {
    await updateDoc(doc(db, "visits", id), { status });
  };

  const removeVisit = async (id: string) => {
    if (!confirm("Excluir esta visita?")) return;
    await deleteDoc(doc(db, "visits", id));
  };

  const filtered = filter === "all" ? visits : visits.filter((v) => v.status === filter);

  const statusLabel: Record<string, string> = {
    pending: "Pendente",
    confirmed: "Confirmada",
    cancelled: "Cancelada",
    completed: "Concluída",
  };

  const statusColor: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800 border-amber-300",
    confirmed: "bg-emerald-100 text-emerald-800 border-emerald-300",
    cancelled: "bg-rose-100 text-rose-800 border-rose-300",
    completed: "bg-slate-100 text-slate-800 border-slate-300",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">Agenda de Visitas Técnicas</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Solicitações recebidas pelo site comercial. Sincronizadas com Google Calendar.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500">Filtrar:</span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="px-3 py-2 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
          >
            <option value="all">Todas ({visits.length})</option>
            <option value="pending">Pendentes</option>
            <option value="confirmed">Confirmadas</option>
            <option value="completed">Concluídas</option>
          </select>
        </div>
      </div>

      <AgendaCalendar
        visits={visits}
        slots={slots}
        onSelectVisit={(v) => alert(`Visita: ${v.name}\nTeléfono: ${v.phone}\nServicio: ${v.service}\nFecha: ${v.preferDate} ${v.preferTime}`)}
        onSelectSlot={(s) => { setEditingSlot(s); setSlotModalOpen(true); }}
        onCreateSlot={(date) => { setEditingSlot(null); setDefaultSlotDate(date); setSlotModalOpen(true); }}
      />

      <AgendaSlotModal
        open={slotModalOpen}
        initial={editingSlot}
        defaultDate={defaultSlotDate}
        onClose={() => { setSlotModalOpen(false); setEditingSlot(null); setDefaultSlotDate(undefined); }}
      />

      {loading ? (
        <div className="p-8 text-center text-slate-500">Carregando agenda...</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
          <Calendar className="w-12 h-12 mx-auto text-slate-400 mb-3" />
          <h3 className="font-bold text-slate-700 dark:text-slate-200">Nenhuma visita {filter !== "all" ? `(${statusLabel[filter]})` : ""}</h3>
          <p className="text-sm text-slate-500 mt-1">As solicitações do site comercial aparecerão aqui.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((visit) => (
            <div key={visit.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-black text-lg text-slate-900 dark:text-white">{visit.name}</h3>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${statusColor[visit.status] || statusColor.pending}`}>
                      {statusLabel[visit.status] || visit.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{visit.service}</p>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /> {visit.preferDate}</div>
                    <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> {visit.preferTime}</div>
                    <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" /> {visit.phone}</div>
                    <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5" /> {visit.address}</div>
                    {visit.email && <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" /> {visit.email}</div>}
                  </div>
                  {visit.notes && (
                    <p className="mt-2 text-xs italic text-slate-500 bg-slate-50 dark:bg-slate-800 p-2 rounded">"{visit.notes}"</p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  {visit.status !== "confirmed" && (
                    <button onClick={() => updateStatus(visit.id, "confirmed")} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                      <CheckCircle className="w-3.5 h-3.5" /> Confirmar
                    </button>
                  )}
                  {visit.status !== "completed" && (
                    <button onClick={() => updateStatus(visit.id, "completed")} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200">
                      <RefreshCw className="w-3.5 h-3.5" /> Concluir
                    </button>
                  )}
                  {visit.status !== "cancelled" && (
                    <button onClick={() => updateStatus(visit.id, "cancelled")} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100">
                      <XCircle className="w-3.5 h-3.5" /> Cancelar
                    </button>
                  )}
                  <button onClick={() => removeVisit(visit.id)} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100">
                    <Trash2 className="w-3.5 h-3.5" /> Excluir
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
