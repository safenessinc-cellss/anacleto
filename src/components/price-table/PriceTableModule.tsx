import React, { useEffect, useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc, writeBatch } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../firebase";
import { AlertCircle, Check, FileUp, Pencil, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import Papa from "papaparse";

type PriceRow = { id: string; code?: string; sku?: string; name: string; category?: string; unit?: string; price: number; supplier?: string; priceSupplier?: string; brand?: string; dimensions?: string; validUntil?: string; notes?: string };
const blank = { code: "", name: "", category: "Perfil", unit: "m", price: "0", supplier: "", brand: "", dimensions: "", validUntil: "", notes: "" };
const norm = (value: unknown) => String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "");
const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value) || 0);

export default function PriceTableModule({ onNavigateQuotes }: { onNavigateQuotes?: () => void }) {
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [authReady, setAuthReady] = useState(false);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => onAuthStateChanged(auth, user => setAuthReady(!!user)), []);
  useEffect(() => {
    if (!authReady) return;
    return onSnapshot(query(collection(db, "price_table"), orderBy("name", "asc")), snap => setRows(snap.docs.map(item => ({ id: item.id, ...item.data() } as PriceRow))), err => setError(err.message || "Não foi possível carregar a tabela."));
  }, [authReady]);
  const filtered = useMemo(() => rows.filter(row => [row.code,row.sku,row.name,row.category,row.supplier,row.brand,row.dimensions].some(value => norm(value).includes(norm(search)))), [rows, search]);
  const reset = () => { setEditing(null); setForm({ ...blank }); };
  const save = async () => {
    const price = Number(String(form.price).replace(",", "."));
    if (!form.name.trim() || !Number.isFinite(price) || price < 0) { setError("Informe a descrição e um preço válido."); return; }
    setBusy(true); setError(""); setMessage("");
    const payload = { code: form.code.trim(), sku: form.code.trim(), name: form.name.trim(), description: form.name.trim(), category: form.category, unit: form.unit.trim() || "un", price, supplier: form.supplier.trim(), priceSupplier: form.supplier.trim(), brand: form.brand.trim(), dimensions: form.dimensions.trim(), validUntil: form.validUntil, notes: form.notes.trim(), active: true, updatedAt: new Date().toISOString() };
    try {
      if (editing) await updateDoc(doc(db, "price_table", editing), payload);
      else await addDoc(collection(db, "price_table"), { ...payload, createdAt: new Date().toISOString() });
      setMessage(editing ? "Preço atualizado." : "Componente adicionado."); reset();
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao salvar."); }
    finally { setBusy(false); }
  };
  const importCsv = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    setBusy(true); setError(""); setMessage("");
    Papa.parse<Record<string,string>>(file, { header: true, skipEmptyLines: true, complete: async result => {
      const imported = result.data.map(raw => {
        const row: Record<string,string> = {};
        Object.entries(raw).forEach(([key,value]) => { row[norm(key).replace(/[^a-z0-9]/g,"")] = String(value ?? "").trim(); });
        const rawPrice = (row.preco || row.valor || row.price || "0").replace(/R\\$\\s?/gi,"").replace(/\\./g,"").replace(",",".");
        const price = Number.parseFloat(rawPrice);
        const code = row.codigo || row.cod || row.sku || row.code || "";
        const name = row.nome || row.descricao || row.produto || row.name || row.description || "";
        const supplier = row.fornecedor || row.supplier || "";
        return { code, sku: code, name, description: name, category: row.categoria || row.tipo || row.category || "Componente", unit: row.unidade || row.unit || "un", price: Number.isFinite(price) && price >= 0 ? price : 0, supplier, priceSupplier: supplier, brand: row.marca || row.fabricante || row.brand || "", dimensions: row.medidas || row.dimensoes || row.dimensions || "", validUntil: row.validade || row.validadeate || row.validuntil || "", notes: row.observacoes || row.notes || "", active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      }).filter(item => item.name);
      if (!imported.length) { setError("Nenhuma linha válida. Use colunas Código, Nome, Categoria, Unidade, Preço e Fornecedor."); setBusy(false); return; }
      try { const batch = writeBatch(db); imported.forEach(item => batch.set(doc(collection(db,"price_table")), item)); await batch.commit(); setMessage(imported.length + " componente(s) importado(s)."); }
      catch (e) { setError(e instanceof Error ? e.message : "Falha ao importar."); }
      finally { setBusy(false); }
    }, error: () => { setError("Não foi possível ler o CSV."); setBusy(false); } });
  };
  const remove = async (id: string) => { if (!window.confirm("Excluir este preço? Orçamentos já salvos não serão alterados.")) return; try { await deleteDoc(doc(db,"price_table",id)); } catch (e) { setError(e instanceof Error ? e.message : "Falha ao excluir."); } };
  return <section className="space-y-6 text-slate-900 dark:text-slate-100">
    <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-blue-600">MATERIAIS E COMPONENTES</p><h2 className="mt-1 text-2xl font-black">Tabela Antecipada de Preços</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Cadastre ou importe preços de fornecedores. A IA consulta esta base e sugere componentes no orçamento.</p></div><div className="flex gap-2"><label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white"><FileUp className="h-4 w-4"/>Importar CSV<input type="file" accept=".csv,text/csv" onChange={importCsv} disabled={busy} className="hidden"/></label><button onClick={reset} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white"><Plus className="h-4 w-4"/>Novo preço</button></div></header>
    <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><p className="text-xs text-slate-500">Componentes cadastrados</p><p className="mt-1 text-2xl font-black">{rows.length}</p></div><div className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><p className="text-xs text-slate-500">Com preço informado</p><p className="mt-1 text-2xl font-black">{rows.filter(row=>Number(row.price)>0).length}</p></div><div className="rounded-xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30"><div className="flex items-center gap-2 text-blue-700 dark:text-blue-300"><Sparkles className="h-4 w-4"/><b className="text-xs">Integração com IA</b></div><p className="mt-1 text-sm text-blue-800 dark:text-blue-200">Correspondências incertas ficam pendentes de confirmação; nenhum valor é inventado.</p></div></div>
    {(error || message) && <div role="status" className={error ? "rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700" : "rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"}>{error || message}</div>}
    <div className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><h3 className="mb-3 font-bold">{editing ? "Editar preço" : "Cadastrar componente e preço"}</h3><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-xs font-semibold text-slate-500">Código / SKU<input value={form.code} onChange={e=>setForm({...form,code:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"/></label>
      <label className="text-xs font-semibold text-slate-500 lg:col-span-3">Descrição do componente *<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"/></label>
      <label className="text-xs font-semibold text-slate-500">Categoria<input value={form.category} onChange={e=>setForm({...form,category:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"/></label>
      <label className="text-xs font-semibold text-slate-500">Unidade<input value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"/></label>
      <label className="text-xs font-semibold text-slate-500">Preço unitário (R$)<input type="number" min="0" step="0.01" value={form.price} onChange={e=>setForm({...form,price:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"/></label>
      <label className="text-xs font-semibold text-slate-500">Fornecedor<input value={form.supplier} onChange={e=>setForm({...form,supplier:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"/></label>
      <label className="text-xs font-semibold text-slate-500">Marca / fabricante<input value={form.brand} onChange={e=>setForm({...form,brand:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"/></label>
      <label className="text-xs font-semibold text-slate-500">Medidas / especificação<input value={form.dimensions} onChange={e=>setForm({...form,dimensions:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"/></label>
      <label className="text-xs font-semibold text-slate-500">Preço válido até<input type="date" value={form.validUntil} onChange={e=>setForm({...form,validUntil:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"/></label>
      <label className="text-xs font-semibold text-slate-500 sm:col-span-2 lg:col-span-4">Observações<textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} rows={2} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"/></label>
    </div><button onClick={save} disabled={busy} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white"><Check className="h-4 w-4"/>Salvar preço</button></div>
    <div className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><h3 className="font-bold">Preços cadastrados ({filtered.length})</h3><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar código, componente, marca ou fornecedor..." className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-800 sm:w-80"/></div></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800"><tr>{["Código","Componente","Categoria","Fornecedor","Unidade","Preço","Validade","Ações"].map(label=><th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{filtered.map(row=><tr key={row.id} className="border-t border-slate-100 dark:border-slate-800"><td className="p-3 font-mono text-xs">{row.code || row.sku || "—"}</td><td className="p-3"><b>{row.name}</b><div className="text-xs text-slate-500">{[row.brand,row.dimensions].filter(Boolean).join(" · ")}</div></td><td className="p-3">{row.category || "—"}</td><td className="p-3">{row.supplier || row.priceSupplier || "—"}</td><td className="p-3">{row.unit || "un"}</td><td className="p-3 font-bold">{money(row.price)}</td><td className="p-3 text-xs">{row.validUntil || "—"}</td><td className="p-3"><button title="Editar" onClick={()=>{setEditing(row.id);setForm({code:row.code||row.sku||"",name:row.name,category:row.category||"Perfil",unit:row.unit||"m",price:String(row.price??0),supplier:row.supplier||row.priceSupplier||"",brand:row.brand||"",dimensions:row.dimensions||"",validUntil:row.validUntil||"",notes:row.notes||""});}} className="mr-2 text-blue-600"><Pencil className="h-4 w-4"/></button><button title="Excluir" onClick={()=>remove(row.id)} className="text-rose-600"><Trash2 className="h-4 w-4"/></button></td></tr>)}{filtered.length===0 && <tr><td colSpan={8} className="p-8 text-center text-slate-500"><AlertCircle className="mx-auto mb-2 h-5 w-5"/>Nenhum preço encontrado.</td></tr>}</tbody></table></div><p className="mt-3 text-xs text-slate-500">CSV: Código, Nome, Categoria, Unidade, Preço, Fornecedor, Marca, Medidas, Validade. Preços de orçamentos já salvos não são alterados.</p></div>
    {onNavigateQuotes && <button onClick={onNavigateQuotes} className="rounded-lg border border-blue-200 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50">Abrir Orçamentos</button>}
  </section>;
}
