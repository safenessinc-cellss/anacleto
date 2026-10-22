import React, { useState, useEffect } from "react";
import { addDoc, collection, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db, auth } from "../../firebase";
import { X, Trash2 } from "lucide-react";

interface Slot {
  id?: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  type: "internal" | "blocked" | "visit";
  notes?: string;
}

interface Props {
  open: boolean;
  initial?: Slot | null;
  defaultDate?: string;
  onClose: () => void;
}

const emptySlot = (defaultDate?: string): Slot => ({
  title: "",
  date: defaultDate || new Date().toISOString().split("T")[0],
  startTime: "09:00",
  endTime: "10:00",
  type: "internal",
  notes: "",
});

export default function AgendaSlotModal({ open, initial, defaultDate, onClose }: Props) {
  const [slot, setSlot] = useState<Slot>(emptySlot(defaultDate));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setSlot(initial ? { ...initial } : emptySlot(defaultDate));
  }, [open, initial, defaultDate]);

  if (!open) return null;

  const handleSave = async () => {
    if (!slot.title.trim()) { alert("Informe um título"); return; }
    if (slot.startTime >= slot.endTime) { alert("Hora final deve ser maior que a inicial"); return; }
    setSaving(true);
    try {
      const payload = {
        title: slot.title.trim(),
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        type: slot.type,
        notes: slot.notes?.trim() || "",
        createdBy: auth.currentUser?.email || "desconhecido",
        updatedAt: new Date().toISOString(),
      };
      if (slot.id) {
        await updateDoc(doc(db, "agenda_slots", slot.id), payload);
      } else {
        await addDoc(collection(db, "agenda_slots"), { ...payload, createdAt: new Date().toISOString() });
      }
      onClose();
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!slot.id) return;
    if (!confirm("Excluir este bloco?")) return;
    setSaving(true);
    try {
      await deleteDoc(doc(db, "agenda_slots", slot.id));
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-black text-lg text-slate-900 dark:text-white">
            {slot.id ? "Editar bloco" : "Novo bloco na agenda"}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Título</label>
            <input value={slot.title} onChange={(e) => setSlot({ ...slot, title: e.target.value })} placeholder="Ex: Reunião com fornecedor" className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Data</label>
              <input type="date" value={slot.date} onChange={(e) => setSlot({ ...slot, date: e.target.value })} className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Tipo</label>
              <select value={slot.type} onChange={(e) => setSlot({ ...slot, type: e.target.value as any })} className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                <option value="internal">Cita interna</option>
                <option value="blocked">Hora bloqueada</option>
                <option value="visit">Visita técnica</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Início</label>
              <input type="time" value={slot.startTime} onChange={(e) => setSlot({ ...slot, startTime: e.target.value })} className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Fim</label>
              <input type="time" value={slot.endTime} onChange={(e) => setSlot({ ...slot, endTime: e.target.value })} className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Notas</label>
            <textarea value={slot.notes} onChange={(e) => setSlot({ ...slot, notes: e.target.value })} rows={2} className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800" />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 p-4 border-t border-slate-200 dark:border-slate-800">
          {slot.id ? (
            <button onClick={handleDelete} disabled={saving} className="flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-50">
              <Trash2 className="w-3.5 h-3.5" /> Excluir
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} disabled={saving} className="px-4 py-2 text-xs font-bold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
