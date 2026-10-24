import React, { useEffect, useState } from "react";
import { collection, onSnapshot, addDoc, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { Plus, Trash2, Edit, Search, Building2, Loader2, Download } from "lucide-react";
import { lookupCNPJ, cnpjToSupplier, cleanCNPJ } from "../../utils/cnpjLookup";

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
  const [cnpjSearch, setCnpjSearch] = useState("");
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<Supplier>(emptyForm);
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupSuccess, setLookupSuccess] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "suppliers"), (snap) => {
      const list: Supplier[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Supplier));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setSuppliers(list);
    }, (err) => console.warn("Suppliers listener:", err));
    return () => unsub();
  }, []);

  const handleLookupCNPJ = async () => {
    const clean = cleanCNPJ(cnpjSearch);
    if (clean.length !== 14) {
      setLookupError("Digite um CNPJ com 14 dígitos");
      return;
    }
    setLookingUp(true);
    setLookupError(null);
    setLookupSuccess(false);
    try {
      const data = await lookupCNPJ(clean);
      const supplier = cnpjToSupplier(data);
      setForm(supplier);
      setEditing(null);
      setLookupSuccess(true);
      setTimeout(() => setLookupSuccess(false), 4000);
    } catch (e: any) {
      setLookupError(e.message || "Erro ao buscar CNPJ");
    } finally {
      setLookingUp(false);
    }
  };

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
    setCnpjSearch("");
    setLookupSuccess(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Excluir este fornecedor? Os boletos vinculados não serão apagados.")) {
      await deleteDoc(doc(db, "suppliers", id));
    }
  };

  // Búsqueda por nombre O por CNPJ
  const filtered = suppliers.filter((s) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    const cleanQ = cleanCNPJ(q);
    return (
      s.name.toLowerCase().includes(q) ||
      (s.nif && s.nif.includes(q)) ||
      (cleanQ.length >= 3 && s.nif && cleanCNPJ(s.nif).includes(cleanQ))
    );
  });

  return (
    <div className="space-y-4">
      {/* BLOCO 1: BUSCAR CNPJ NA RECEITA */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-2xl border border-blue-200 dark:border-blue-900 p-5">
        <h3 className="font-black text-slate-900 dark:text-white flex items-center gap-2 mb-1">
          <Download className="w-5 h-5 text-blue-600" /> Buscar fornecedor por CNPJ
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          Consulta os dados completos na Receita Federal e preenche o formulário automaticamente.
        </p>
        <div className="flex gap-2 flex-wrap">
          <input
            value={cnpjSearch}
            onChange={(e) => setCnpjSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLookupCNPJ()}
            placeholder="00.000.000/0000-00"
            className="flex-1 min-w-[220px] px-3 py-2.5 text-sm border rounded-lg bg-white dark:bg-slate-900 font-mono"
          />
          <button
            onClick={handleLookupCNPJ}
            disabled={lookingUp}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
          >
            {lookingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {lookingUp ? "Buscando..." : "Buscar CNPJ"}
          </button>
        </div>
        {lookupError && (
          <div className="mt-3 text-xs text-rose-700 bg-rose-50 dark:bg-rose-950/30 rounded-lg p-2.5">
            ⚠️ {lookupError}
          </div>
        )}
        {lookupSuccess && (
          <div className="mt-3 text-xs text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-2.5">
            ✅ Dados carregados! Revise abaixo e clique em "Salvar fornecedor".
          </div>
        )}
      </div>

      {/* BLOCO 2: FORMULÁRIO */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border p-4">
        <h3 className="font-bold mb-3 flex items-center gap-2">
          <Building2 className="w-4 h-4" />
          {editing ? "Editar Fornecedor" : form.name ? `Novo Fornecedor: ${form.name}` : "Cadastrar Fornecedor"}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input placeholder="Nome / Razão Social *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="p-2 border rounded text-sm md:col-span-2" />
          <input placeholder="CNPJ / CPF" value={form.nif} onChange={(e) => setForm({ ...form, nif: e.target.value })} className="p-2 border rounded text-sm font-mono" />
          <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="p-2 border rounded text-sm" />
          <input placeholder="Telefone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="p-2 border rounded text-sm" />
          <input placeholder="Endereço" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="p-2 border rounded text-sm" />
          <textarea placeholder="Notas" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="p-2 border rounded text-sm md:col-span-3" rows={2} />
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={handleSave} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700">Salvar fornecedor</button>
          {editing && (
            <button onClick={() => { setEditing(null); setForm(emptyForm); }} className="px-4 py-2 bg-slate-200 rounded-lg text-sm font-bold">Cancelar</button>
          )}
        </div>
      </div>

      {/* BLOCO 3: BUSCA + LISTA */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar fornecedor por nome ou CNPJ..."
            className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg bg-white dark:bg-slate-800"
          />
        </div>
        <button onClick={() => { setEditing(null); setForm(emptyForm); }} className="flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold">
          <Plus className="w-4 h-4" /> Novo
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800 text-left text-xs uppercase text-slate-500">
            <tr><th className="p-3">Nome</th><th className="p-3">CNPJ/CPF</th><th className="p-3">Email</th><th className="p-3">Telefone</th><th className="p-3">Ações</th></tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="p-3 font-bold">{s.name}</td>
                <td className="p-3 font-mono text-xs">{s.nif || "-"}</td>
                <td className="p-3 text-slate-600">{s.email || "-"}</td>
                <td className="p-3 text-slate-600">{s.phone || "-"}</td>
                <td className="p-3">
                  <button onClick={() => { setEditing(s); setForm(s); }} className="p-1 text-blue-600"><Edit className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(s.id!)} className="p-1 text-rose-600"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="p-8 text-center text-slate-400">
                {search ? `Nenhum fornecedor encontrado para "${search}"` : "Nenhum fornecedor cadastrado"}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
