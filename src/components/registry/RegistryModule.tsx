import React, { useEffect, useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../firebase";
import { Check, FileUp, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import Papa from "papaparse";

export type RegistryKind = "items" | "products" | "services" | "payment_methods" | "measurement" | "contracts" | "cut_plan" | "profile_optimization" | "materials";

type RecordRow = { id: string; name: string; code?: string; category?: string; unit?: string; price?: number; status?: string; notes?: string; createdAt?: string; updatedAt?: string };
const config: Record<RegistryKind, { title: string; subtitle: string; collection: string; codeLabel: string; categories: string[]; unitLabel: string }> = {
  items: { title: "Cadastro de Itens", subtitle: "Cadastro geral de componentes e insumos.", collection: "registry_items", codeLabel: "Código / SKU", categories: ["Perfil", "Vidro", "Ferragem", "Acessório", "Outro"], unitLabel: "Unidade" },
  products: { title: "Produtos", subtitle: "Produtos e modelos comerciais disponíveis para orçamento.", collection: "registry_products", codeLabel: "Código do produto", categories: ["Janela", "Porta", "Box de banheiro", "Fachada", "Outro"], unitLabel: "Unidade" },
  services: { title: "Serviços", subtitle: "Serviços e mão de obra que podem compor um orçamento.", collection: "registry_services", codeLabel: "Código do serviço", categories: ["Instalação", "Medição", "Manutenção", "Fabricação", "Outro"], unitLabel: "Unidade" },
  payment_methods: { title: "Formas de Pagamento", subtitle: "Condições de pagamento oferecidas aos clientes.", collection: "payment_methods", codeLabel: "Código", categories: ["PIX", "Dinheiro", "Cartão", "Transferência", "Boleto", "Outro"], unitLabel: "Condição" },
  measurement: { title: "Ficha de Medição", subtitle: "Registre medições feitas no local antes de liberar o orçamento para fabricação.", collection: "measurement_sheets", codeLabel: "Nº da ficha", categories: ["Janela", "Porta", "Box de banheiro", "Outro"], unitLabel: "mm" },
  contracts: { title: "Contratos", subtitle: "Controle de contratos relacionados a orçamentos aprovados.", collection: "contracts", codeLabel: "Nº do contrato", categories: ["Aguardando assinatura", "Assinado", "Encerrado"], unitLabel: "Unidade" },
  cut_plan: { title: "Plano de Corte", subtitle: "Registre planos de corte. Comprimentos só devem ser liberados após validar o sistema e as fórmulas do perfil.", collection: "cut_plans", codeLabel: "Nº do plano", categories: ["A validar", "Validado", "Liberado para produção"], unitLabel: "mm" },
  profile_optimization: { title: "Aproveitamento de Perfis", subtitle: "Cadastre análises de barras e sobras. Não substitui a otimização técnica validada.", collection: "profile_optimization", codeLabel: "Nº da análise", categories: ["Em análise", "Otimizado", "Revisar"], unitLabel: "mm" },
  materials: { title: "Lista de Materiais", subtitle: "Materiais associados a um orçamento ou ordem de produção.", collection: "material_lists", codeLabel: "Código / SKU", categories: ["Perfil", "Vidro", "Ferragem", "Acessório", "Consumível", "Outro"], unitLabel: "Unidade" },
};

export default function RegistryModule({ kind }: { kind: RegistryKind }) {
  const meta = config[kind];
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [authReady, setAuthReady] = useState(false);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const empty = { name: "", code: "", category: meta.categories[0], unit: meta.unitLabel, price: "0", status: "Em elaboração", notes: "" };
  const [form, setForm] = useState(empty);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setAuthReady(!!user));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady) return;
    const unsub = onSnapshot(query(collection(db, meta.collection), orderBy("name", "asc")), (snap) => {
      setRows(snap.docs.map((item) => ({ id: item.id, ...item.data() } as RecordRow)));
      setError("");
    }, (err) => setError(err.message || "Não foi possível carregar os registos. Verifique as permissões do Firestore."));
    return () => unsub();
  }, [authReady, meta.collection]);

  const filtered = useMemo(() => rows.filter((row) => [row.name, row.code, row.category, row.status].some((value) => String(value || "").toLowerCase().includes(search.toLowerCase()))), [rows, search]);
  const reset = () => { setEditing(null); setForm({ ...empty }); setError(""); };

  const save = async () => {
    if (!form.name.trim()) { setError("O nome/descrição é obrigatório."); return; }
    setSaving(true); setError("");
    const payload = { name: form.name.trim(), code: form.code.trim(), category: form.category, unit: form.unit.trim() || meta.unitLabel, price: Number(form.price) || 0, status: form.status, notes: form.notes.trim(), updatedAt: new Date().toISOString() };
    try {
      if (editing) await updateDoc(doc(db, meta.collection, editing), payload);
      else await addDoc(collection(db, meta.collection), { ...payload, createdAt: new Date().toISOString() });
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível guardar. Verifique as regras de acesso do Firestore.");
    } finally { setSaving(false); }
  };

  const importServicesCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setSaving(true);
    setError("");
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const normalize = (value: unknown) => String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "");
        const imported = results.data.map((raw) => {
          const row: Record<string, string> = {};
          Object.entries(raw).forEach(([key, value]) => { row[normalize(key)] = String(value ?? "").trim(); });
          const priceText = (row.preco || row.valor || row.price || "0").replace(/R\\$\\s?/gi, "").replace(/\\./g, "").replace(",", ".");
          return {
            name: row.nome || row.descricao || row.servico || row.name || row.description || "",
            code: row.codigo || row.cod || row.code || row.sku || "",
            category: row.categoria || row.tipo || row.category || meta.categories[0],
            unit: row.unidade || row.unit || meta.unitLabel,
            price: Math.max(0, Number.parseFloat(priceText) || 0),
            status: row.estado || row.status || "Ativo",
            notes: row.observacoes || row.observacao || row.notas || row.notes || "",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        }).filter((item) => item.name);
        if (results.errors.length > 0 && imported.length === 0) {
          setError("Não foi possível ler o CSV. Confira o separador e os cabeçalhos.");
          setSaving(false);
          return;
        }
        if (imported.length === 0) {
          setError("Nenhum serviço válido encontrado. O arquivo precisa ter uma coluna Nome, Serviço ou Descrição.");
          setSaving(false);
          return;
        }
        try {
          for (const item of imported) await addDoc(collection(db, meta.collection), item);
          setError("");
          window.alert(`${imported.length} serviço(s) importado(s) com sucesso.`);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Falha ao importar serviços. Verifique as permissões do Firestore.");
        } finally {
          setSaving(false);
        }
      },
      error: () => {
        setError("Não foi possível abrir o arquivo CSV.");
        setSaving(false);
      },
    });
  };

  const remove = async (id: string) => {
    if (!window.confirm("Tem a certeza de que pretende eliminar este registo?")) return;
    try { await deleteDoc(doc(db, meta.collection, id)); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível eliminar o registo."); }
  };

  return <section className="space-y-6 text-slate-900 dark:text-slate-100">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-[.18em] text-blue-600">ANACLETO ESQUADRIAS</p><h2 className="mt-1 text-2xl font-black">{meta.title}</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{meta.subtitle}</p></div>
      <div className="flex flex-wrap gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Pesquisar..." className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900"/></div>{kind === "services" && <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700"><FileUp className="h-4 w-4"/>{saving ? "Importando..." : "Importar lista CSV"}<input type="file" accept=".csv,text/csv" onChange={importServicesCSV} disabled={saving} className="hidden"/></label>}<button onClick={reset} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white"><Plus className="h-4 w-4"/> Novo</button></div>
    </header>
    {error && <div role="alert" className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
    {!authReady && <p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">Aguardando autenticação para carregar os dados.</p>}
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between"><h3 className="font-bold">{editing ? "Editar registo" : "Novo registo"}</h3>{editing && <button onClick={reset} className="text-slate-500"><X className="h-4 w-4"/></button>}</div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-xs font-semibold text-slate-500">{meta.codeLabel}<input value={form.code} onChange={e=>setForm({...form,code:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"/></label>
        <label className="text-xs font-semibold text-slate-500 sm:col-span-2">Nome / descrição *<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"/></label>
        <label className="text-xs font-semibold text-slate-500">Categoria / tipo<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white">{meta.categories.map(c=><option key={c}>{c}</option>)}</select></label>
        <label className="text-xs font-semibold text-slate-500">{meta.unitLabel}<input value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"/></label>
        <label className="text-xs font-semibold text-slate-500">Preço / valor (R$)<input type="number" min="0" step="0.01" value={form.price} onChange={e=>setForm({...form,price:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"/></label>
        <label className="text-xs font-semibold text-slate-500">Estado<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"><option>Em elaboração</option><option>Ativo</option><option>Aguardando validação</option><option>Aprovado</option><option>Concluído</option><option>Bloqueado</option></select></label>
        <label className="text-xs font-semibold text-slate-500 sm:col-span-2 lg:col-span-3">Notas<textarea rows={2} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"/></label>
      </div>
      <div className="mt-3 flex gap-2"><button disabled={saving} onClick={save} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Check className="h-4 w-4"/>{saving ? "Guardando..." : "Guardar registo"}</button><button onClick={reset} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-slate-700">Limpar</button></div>
    </div>
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800"><h3 className="font-bold">Registos guardados</h3><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">{filtered.length} registo(s)</span></div>
      {filtered.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">Nenhum registo encontrado. Adicione o primeiro usando o formulário acima.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800"><tr><th className="p-3">{meta.codeLabel}</th><th className="p-3">Nome / descrição</th><th className="p-3">Categoria</th><th className="p-3">Unidade</th><th className="p-3">Valor</th><th className="p-3">Estado</th><th className="p-3">Ações</th></tr></thead><tbody>{filtered.map(row=><tr key={row.id} className="border-t border-slate-100 dark:border-slate-800"><td className="p-3 font-mono text-xs">{row.code || "—"}</td><td className="p-3 font-semibold">{row.name}<p className="max-w-xs truncate text-xs font-normal text-slate-500">{row.notes}</p></td><td className="p-3">{row.category || "—"}</td><td className="p-3">{row.unit || "—"}</td><td className="p-3">{Number(row.price || 0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</td><td className="p-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">{row.status || "—"}</span></td><td className="p-3"><div className="flex gap-2"><button aria-label="Editar" onClick={()=>{setEditing(row.id);setForm({name:row.name||"",code:row.code||"",category:row.category||meta.categories[0],unit:row.unit||meta.unitLabel,price:String(row.price||0),status:row.status||"Em elaboração",notes:row.notes||""});}} className="text-blue-600"><Pencil className="h-4 w-4"/></button><button aria-label="Eliminar" onClick={()=>void remove(row.id)} className="text-rose-600"><Trash2 className="h-4 w-4"/></button></div></td></tr>)}</tbody></table></div>}
    </div>
  </section>;
}
