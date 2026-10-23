import React, { useEffect, useState } from "react";
import { collection, onSnapshot, addDoc, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { Plus, Trash2, Edit, Search, Building2 } from "lucide-react";

interface Supplier {
  id?: string;
  name: string;
  nif: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  createdAt?: string;
}

const emptyForm: Supplier = { name: "", nif: "", email: "", phone: "", address: "", notes: "" };

export default function SuppliersModule() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<Supplier>(emptyForm);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "suppliers"), (snap) => {
      const list: Supplier[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Supplier));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setSuppliers(list);
    }, (err) => console.warn("Suppliers listener:", err));
    return () => unsub();
  }, []);

  const handleSave = async () => {
    if (!form.name.trim()) return alert("Nome do fornecedor é obrigatório");
    const payload = { ...form, name: form.name.trim() };
    if (editing?.id) {
      await updateDoc(doc(db, "suppliers", editing.id), payload);
    } else {
      await addDoc(collection(db, "suppliers"), { ...payload, createdAt: new Date().toISOString() });
    }
    setEditing(null);
    setForm(emptyForm);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Excluir este fornecedor? Os boletos vinculados não serão apagados.")) {
      await deleteDoc(doc(db, "suppliers", id));
    }
  };

  const filtered = suppliers.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.nif && s.nif.includes(search))
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou CNPJ..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
          />
        </div>
        <button
          onClick={() => { setEditing(null); setForm(emptyForm); }}
          className="flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" /> Novo Fornecedor
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
        <h3 className="font-bold mb-3 flex items-center gap-2">
          <Building2 className="w-4 h-4" /> {editing ? "Editar Fornecedor" : "Cadastrar Fornecedor"}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input placeholder="Nome / Razão Social *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="p-2 border border-slate-200 dark:border-slate-700 rounded text-sm bg-white dark:bg-slate-800" />
          <input placeholder="CNPJ / CPF" value={form.nif} onChange={(e) => setForm({ ...form, nif: e.target.value })} className="p-2 border border-slate-200 dark:border-slate-700 rounded text-sm bg-white dark:bg-slate-800" />
          <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="p-2 border border-slate-200 dark:border-slate-700 rounded text-sm bg-white dark:bg-slate-800" />
          <input placeholder="Telefone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="p-2 border border-slate-200 dark:border-slate-700 rounded text-sm bg-white dark:bg-slate-800" />
          <input placeholder="Endereço" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="p-2 border border-slate-200 dark:border-slate-700 rounded text-sm bg-white dark:bg-slate-800 md:col-span-2" />
          <textarea placeholder="Notas" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="p-2 border border-slate-200 dark:border-slate-700 rounded text-sm bg-white dark:bg-slate-800 md:col-span-3" rows={2} />
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={handleSave} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700">Salvar</button>
          {editing && (
            <button onClick={() => { setEditing(null); setForm(emptyForm); }} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg text-sm font-bold">Cancelar</button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800 text-left text-xs uppercase text-slate-500">
            <tr><th className="p-3">Nome</th><th className="p-3">CNPJ/CPF</th><th className="p-3">Email</th><th className="p-3">Telefone</th><th className="p-3">Ações</th></tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="p-3 font-bold text-slate-900 dark:text-white">{s.name}</td>
                <td className="p-3 font-mono text-xs">{s.nif || "-"}</td>
                <td className="p-3 text-slate-600 dark:text-slate-300">{s.email || "-"}</td>
                <td className="p-3 text-slate-600 dark:text-slate-300">{s.phone || "-"}</td>
                <td className="p-3">
                  <button onClick={() => { setEditing(s); setForm(s); }} className="p-1 text-blue-600 hover:text-blue-700"><Edit className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(s.id!)} className="p-1 text-rose-600 hover:text-rose-700"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="p-8 text-center text-slate-400">Nenhum fornecedor cadastrado</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
