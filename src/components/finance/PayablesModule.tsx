import React, { useEffect, useState } from "react";
import { collection, onSnapshot, addDoc, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { AlertCircle, CheckCircle, Clock, DollarSign, Edit, Plus, Search, Trash2, X, XCircle } from "lucide-react";

interface Supplier { id?: string; name: string; }
interface Payable {
  id?: string;
  supplierId: string;
  supplierName: string;
  description: string;
  amount: number;
  dueDate: string;
  paymentMethod: "boleto" | "pix" | "transferencia" | "cartao" | "dinheiro" | "cheque";
  status: "pending" | "paid" | "cancelled";
  paidAt?: string;
  notes?: string;
}

const emptyForm: Omit<Payable, "id"> = {
  supplierId: "",
  supplierName: "",
  description: "",
  amount: 0,
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

export default function PayablesModule() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<Payable[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "paid" | "overdue">("all");
  const [editing, setEditing] = useState<Payable | null>(null);
  const [form, setForm] = useState<Omit<Payable, "id">>(emptyForm);

  useEffect(() => {
    const u1 = onSnapshot(collection(db, "suppliers"), (snap) => {
      const list: Supplier[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Supplier));
      setSuppliers(list);
    });
    const u2 = onSnapshot(collection(db, "payables"), (snap) => {
      const list: Payable[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Payable));
      list.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      setItems(list);
    });
    return () => { u1(); u2(); };
  }, []);

  const today = new Date().toISOString().split("T")[0];
  const isOverdue = (p: Payable) => p.status === "pending" && p.dueDate < today;
  const isDueSoon = (p: Payable) => {
    if (p.status !== "pending") return false;
    const diff = Math.ceil((new Date(p.dueDate).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
    return diff >= 0 && diff <= 7;
  };

  const totals = {
    pending: items.filter((i) => i.status === "pending").reduce((s, i) => s + i.amount, 0),
    overdue: items.filter((i) => isOverdue(i)).reduce((s, i) => s + i.amount, 0),
    paid: items.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount, 0),
  };

  const handleSave = async () => {
    if (!form.description.trim()) return alert("Descrição é obrigatória");
    if (!form.supplierId) return alert("Selecione um fornecedor");
    if (form.amount <= 0) return alert("Valor deve ser maior que zero");
    const supplier = suppliers.find((s) => s.id === form.supplierId);
    const payload = { ...form, supplierName: supplier?.name || form.supplierName };
    if (editing?.id) {
      await updateDoc(doc(db, "payables", editing.id), payload);
    } else {
      await addDoc(collection(db, "payables"), payload);
    }
    setEditing(null);
    setForm(emptyForm);
  };

  const markPaid = async (p: Payable) => {
    await updateDoc(doc(db, "payables", p.id!), { status: "paid", paidAt: new Date().toISOString() });
  };
  const markPending = async (p: Payable) => {
    await updateDoc(doc(db, "payables", p.id!), { status: "pending", paidAt: null });
  };
  const handleDelete = async (id: string) => {
    if (confirm("Excluir este boleto?")) await deleteDoc(doc(db, "payables", id));
  };

  const filtered = items.filter((i) => {
    if (search && !i.description.toLowerCase().includes(search.toLowerCase()) && !i.supplierName.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "pending") return i.status === "pending";
    if (filter === "paid") return i.status === "paid";
    if (filter === "overdue") return isOverdue(i);
    return true;
  });

  const statusBadge = (p: Payable) => {
    if (p.status === "paid") return <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded"><CheckCircle className="w-3 h-3" /> Pago</span>;
    if (p.status === "cancelled") return <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded"><XCircle className="w-3 h-3" /> Cancelado</span>;
    if (isOverdue(p)) return <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded"><AlertCircle className="w-3 h-3" /> Vencido</span>;
    if (isDueSoon(p)) return <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded"><Clock className="w-3 h-3" /> Vence em breve</span>;
    return <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">Pendente</span>;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-slate-900 rounded-xl border p-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500"><Clock className="w-3.5 h-3.5" /> Pendente</div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">R$ {totals.pending.toFixed(2)}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border p-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase text-rose-600"><AlertCircle className="w-3.5 h-3.5" /> Vencido</div>
          <div className="text-2xl font-black text-rose-600 mt-1">R$ {totals.overdue.toFixed(2)}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border p-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase text-emerald-600"><CheckCircle className="w-3.5 h-3.5" /> Pago</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">R$ {totals.paid.toFixed(2)}</div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border p-4">
        <h3 className="font-bold mb-3 flex items-center gap-2"><DollarSign className="w-4 h-4" /> {editing ? "Editar Boleto" : "Novo Boleto a Pagar"}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} className="p-2 border rounded text-sm bg-white dark:bg-slate-800 md:col-span-1">
            <option value="">Fornecedor *</option>
            {suppliers.map((s) => <option key={s.id} value={s.id!}>{s.name}</option>)}
          </select>
          <input placeholder="Descrição *" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="p-2 border rounded text-sm bg-white dark:bg-slate-800 md:col-span-2" />
          <input type="number" step="0.01" placeholder="Valor *" value={form.amount} onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} className="p-2 border rounded text-sm bg-white dark:bg-slate-800" />
          <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="p-2 border rounded text-sm bg-white dark:bg-slate-800" />
          <select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value as any })} className="p-2 border rounded text-sm bg-white dark:bg-slate-800">
            {METHODS.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
          </select>
          <textarea placeholder="Notas" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="p-2 border rounded text-sm bg-white dark:bg-slate-800 md:col-span-3" rows={2} />
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={handleSave} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700">Salvar</button>
          {editing && (
            <button onClick={() => { setEditing(null); setForm(emptyForm); }} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg text-sm font-bold">Cancelar</button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por descrição ou fornecedor..." className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg bg-white dark:bg-slate-800" />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value as any)} className="px-3 py-2 text-sm border rounded-lg bg-white dark:bg-slate-800">
          <option value="all">Todos</option>
          <option value="pending">Pendentes</option>
          <option value="paid">Pagos</option>
          <option value="overdue">Vencidos</option>
        </select>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="p-3">Fornecedor</th><th className="p-3">Descrição</th><th className="p-3">Valor</th><th className="p-3">Vencimento</th><th className="p-3">Método</th><th className="p-3">Status</th><th className="p-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="p-3 font-bold text-slate-900 dark:text-white">{p.supplierName}</td>
                <td className="p-3 text-slate-600 dark:text-slate-300">{p.description}</td>
                <td className="p-3 font-bold">R$ {p.amount.toFixed(2)}</td>
                <td className="p-3 font-mono text-xs">{p.dueDate}</td>
                <td className="p-3 text-xs uppercase">{METHODS.find((m) => m.v === p.paymentMethod)?.l || p.paymentMethod}</td>
                <td className="p-3">{statusBadge(p)}</td>
                <td className="p-3">
                  {p.status === "pending" ? (
                    <button onClick={() => markPaid(p)} title="Marcar como Pago" className="p-1 text-emerald-600 hover:text-emerald-700"><CheckCircle className="w-4 h-4" /></button>
                  ) : (
                    <button onClick={() => markPending(p)} title="Marcar como Pendente" className="p-1 text-amber-600 hover:text-amber-700"><Clock className="w-4 h-4" /></button>
                  )}
                  <button onClick={() => { setEditing(p); setForm(p); }} className="p-1 text-blue-600 hover:text-blue-700"><Edit className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(p.id!)} className="p-1 text-rose-600 hover:text-rose-700"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="p-8 text-center text-slate-400">Nenhum boleto encontrado</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
