import React, { useEffect, useState } from "react";
import { collection, onSnapshot, addDoc, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { AlertCircle, CheckCircle, Clock, DollarSign, Edit, Plus, Search, Trash2, TrendingUp, X, XCircle } from "lucide-react";

interface Client { id?: string; name: string; }
interface Receivable {
  id?: string;
  clientId: string;
  clientName: string;
  description: string;
  amount: number;
  receivedAmount?: number;
  dueDate: string;
  paymentMethod: "boleto" | "pix" | "transferencia" | "cartao" | "dinheiro" | "cheque";
  status: "pending" | "partial" | "received" | "cancelled";
  receivedAt?: string;
  invoiceId?: string;
  notes?: string;
}

const emptyForm: Omit<Receivable, "id"> = {
  clientId: "",
  clientName: "",
  description: "",
  amount: 0,
  receivedAmount: 0,
  dueDate: new Date().toISOString().split("T")[0],
  paymentMethod: "boleto",
  status: "pending",
  notes: "",
};

const METHODS = [
  { v: "boleto", l: "Boleto" },
  { v: "pix", l: "PIX" },
  { v: "transferencia", l: "Transferência" },
  { v: "cartao", l: "Cartão" },
  { v: "dinheiro", l: "Dinheiro" },
  { v: "cheque", l: "Cheque" },
];

export default function ReceivablesModule() {
  const [clients, setClients] = useState<Client[]>([]);
  const [items, setItems] = useState<Receivable[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "partial" | "received" | "overdue">("all");
  const [editing, setEditing] = useState<Receivable | null>(null);
  const [form, setForm] = useState<Omit<Receivable, "id">>(emptyForm);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const u1 = onSnapshot(collection(db, "companies"), (snap) => {
      const list: Client[] = [];
      snap.forEach((d) => list.push({ id: d.id, name: d.data().name || d.data().companyName || "Sem nome" }));
      setClients(list);
    });
    const u2 = onSnapshot(collection(db, "receivables"), (snap) => {
      const list: Receivable[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Receivable));
      list.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      setItems(list);
    });
    return () => { u1(); u2(); };
  }, []);

  const today = new Date().toISOString().split("T")[0];
  const isOverdue = (r: Receivable) => (r.status === "pending" || r.status === "partial") && r.dueDate < today;
  const isDueSoon = (r: Receivable) => {
    if (r.status !== "pending" && r.status !== "partial") return false;
    const diff = Math.ceil((new Date(r.dueDate).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
    return diff >= 0 && diff <= 7;
  };

  const totals = {
    pending: items.filter((i) => i.status === "pending" || i.status === "partial").reduce((s, i) => s + (i.amount - (i.receivedAmount || 0)), 0),
    overdue: items.filter((i) => isOverdue(i)).reduce((s, i) => s + (i.amount - (i.receivedAmount || 0)), 0),
    received: items.filter((i) => i.status === "received").reduce((s, i) => s + i.amount, 0),
  };

  const handleSave = async () => {
    if (!form.description.trim()) return alert("Descrição é obrigatória");
    if (!form.clientName.trim()) return alert("Informe o cliente");
    if (form.amount <= 0) return alert("Valor deve ser maior que zero");
    const payload = { ...form };
    if (editing?.id) {
      await updateDoc(doc(db, "receivables", editing.id), payload);
    } else {
      await addDoc(collection(db, "receivables"), payload);
    }
    setEditing(null);
    setForm(emptyForm);
    setShowForm(false);
  };

  const markReceived = async (r: Receivable) => {
    await updateDoc(doc(db, "receivables", r.id!), {
      status: "received",
      receivedAmount: r.amount,
      receivedAt: new Date().toISOString(),
    });
  };
  const markPartial = async (r: Receivable) => {
    const val = prompt(`Valor recebido parcialmente (máx R$ ${r.amount}):`, String((r.receivedAmount || 0)));
    if (!val) return;
    const num = parseFloat(val);
    if (isNaN(num) || num <= 0) return alert("Valor inválido");
    if (num >= r.amount) return markReceived(r);
    await updateDoc(doc(db, "receivables", r.id!), {
      status: "partial",
      receivedAmount: num,
      receivedAt: new Date().toISOString(),
    });
  };
  const markPending = async (r: Receivable) => {
    await updateDoc(doc(db, "receivables", r.id!), { status: "pending", receivedAmount: 0, receivedAt: null });
  };
  const handleDelete = async (id: string) => {
    if (confirm("Excluir esta cobrança?")) await deleteDoc(doc(db, "receivables", id));
  };

  const filtered = items.filter((i) => {
    if (search && !i.description.toLowerCase().includes(search.toLowerCase()) && !i.clientName.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "pending") return i.status === "pending";
    if (filter === "partial") return i.status === "partial";
    if (filter === "received") return i.status === "received";
    if (filter === "overdue") return isOverdue(i);
    return true;
  });

  const statusBadge = (r: Receivable) => {
    if (r.status === "received") return <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded"><CheckCircle className="w-3 h-3" /> Recebido</span>;
    if (r.status === "cancelled") return <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded"><XCircle className="w-3 h-3" /> Cancelado</span>;
    if (isOverdue(r)) return <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded"><AlertCircle className="w-3 h-3" /> Vencido</span>;
    if (isDueSoon(r)) return <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded"><Clock className="w-3 h-3" /> Vence em breve</span>;
    if (r.status === "partial") return <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">Parcial (R$ {r.receivedAmount?.toFixed(2)})</span>;
    return <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">Pendente</span>;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-slate-900 rounded-xl border p-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500"><Clock className="w-3.5 h-3.5" /> A Receber</div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">R$ {totals.pending.toFixed(2)}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border p-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase text-rose-600"><AlertCircle className="w-3.5 h-3.5" /> Vencido</div>
          <div className="text-2xl font-black text-rose-600 mt-1">R$ {totals.overdue.toFixed(2)}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border p-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase text-emerald-600"><TrendingUp className="w-3.5 h-3.5" /> Recebido</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">R$ {totals.received.toFixed(2)}</div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por cliente ou descrição..." className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg bg-white dark:bg-slate-800" />
          </div>
          <select value={filter} onChange={(e) => setFilter(e.target.value as any)} className="px-3 py-2 text-sm border rounded-lg bg-white dark:bg-slate-800">
            <option value="all">Todos</option>
            <option value="pending">Pendentes</option>
            <option value="partial">Parciais</option>
            <option value="received">Recebidos</option>
            <option value="overdue">Vencidos</option>
          </select>
        </div>
        <button onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(!showForm); }} className="flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700">
          <Plus className="w-4 h-4" /> Nova Cobrança
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border p-4">
          <h3 className="font-bold mb-3 flex items-center gap-2"><DollarSign className="w-4 h-4" /> {editing ? "Editar Cobrança" : "Nova Cobrança"}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input placeholder="Cliente *" value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} className="p-2 border rounded text-sm bg-white dark:bg-slate-800" list="clients-list" />
            <datalist id="clients-list">{clients.map((c) => <option key={c.id} value={c.name} />)}</datalist>
            <input placeholder="Descrição *" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="p-2 border rounded text-sm bg-white dark:bg-slate-800 md:col-span-2" />
            <input type="number" step="0.01" placeholder="Valor *" value={form.amount} onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} className="p-2 border rounded text-sm bg-white dark:bg-slate-800" />
            <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="p-2 border rounded text-sm bg-white dark:bg-slate-800" />
            <select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value as any })} className="p-2 border rounded text-sm bg-white dark:bg-slate-800">
              {METHODS.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
            </select>
            <input placeholder="Nº da fatura (opcional)" value={form.invoiceId || ""} onChange={(e) => setForm({ ...form, invoiceId: e.target.value })} className="p-2 border rounded text-sm bg-white dark:bg-slate-800 md:col-span-2" />
            <textarea placeholder="Notas" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="p-2 border rounded text-sm bg-white dark:bg-slate-800 md:col-span-3" rows={2} />
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={handleSave} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700">Salvar</button>
            <button onClick={() => { setShowForm(false); setEditing(null); setForm(emptyForm); }} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg text-sm font-bold">Cancelar</button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="p-3">Cliente</th><th className="p-3">Descrição</th><th className="p-3">Valor</th><th className="p-3">Vencimento</th><th className="p-3">Método</th><th className="p-3">Status</th><th className="p-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="p-3 font-bold text-slate-900 dark:text-white">{r.clientName}</td>
                <td className="p-3 text-slate-600 dark:text-slate-300">{r.description}</td>
                <td className="p-3 font-bold">R$ {r.amount.toFixed(2)}</td>
                <td className="p-3 font-mono text-xs">{r.dueDate}</td>
                <td className="p-3 text-xs uppercase">{METHODS.find((m) => m.v === r.paymentMethod)?.l || r.paymentMethod}</td>
                <td className="p-3">{statusBadge(r)}</td>
                <td className="p-3">
                  {r.status !== "received" && (
                    <button onClick={() => markReceived(r)} title="Marcar como Recebido" className="p-1 text-emerald-600 hover:text-emerald-700"><CheckCircle className="w-4 h-4" /></button>
                  )}
                  {r.status !== "received" && (
                    <button onClick={() => markPartial(r)} title="Registrar recebimento parcial" className="p-1 text-blue-600 hover:text-blue-700"><DollarSign className="w-4 h-4" /></button>
                  )}
                  {r.status === "received" && (
                    <button onClick={() => markPending(r)} title="Marcar como Pendente" className="p-1 text-amber-600 hover:text-amber-700"><Clock className="w-4 h-4" /></button>
                  )}
                  <button onClick={() => { setEditing(r); setForm(r); setShowForm(true); }} className="p-1 text-blue-600 hover:text-blue-700"><Edit className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(r.id!)} className="p-1 text-rose-600 hover:text-rose-700"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="p-8 text-center text-slate-400">Nenhuma cobrança encontrada</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
