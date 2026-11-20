import React, { useEffect, useMemo, useState } from "react";
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc
} from "firebase/firestore";
import { db } from "../../firebase";
import {
  BookOpen, FileText, Plus, Search, Layers, Ruler, Wrench, ExternalLink,
  CheckCircle2, Clock3, AlertTriangle, Trash2, X, Save, ShieldCheck
} from "lucide-react";

type Section = "documents" | "profiles" | "rules" | "hardware";
type ReviewStatus = "pending_review" | "verified" | "rejected";
type Row = { id: string; [key: string]: any };

const OFFICIAL_SOURCES = [
  {
    manufacturer: "Hydro",
    country: "Brasil",
    url: "https://www.hydro.com/br/br/aluminio/produtos/sistemas-de-construcao/sistemas-hydro-no-brasil2/materiais-tecnicos/",
    lines: "Única, Única Minimalist, Nova Gold, Gold IV, Gold Slim, Inova, Produtiva 25 e Master",
    note: "Portal oficial de materiais técnicos e boletins."
  },
  {
    manufacturer: "Belmetal",
    country: "Brasil",
    url: "https://belmetal.com.br/catalogos/",
    lines: "Atlanta, Imperial 2.5, Imperial 3.5, Superia, Grid Sky e Stilo Grad",
    note: "Página oficial de catálogos e portfólio de perfis."
  },
  {
    manufacturer: "Perfil Alumínio",
    country: "Brasil",
    url: "https://www.perfilaluminio.com.br/",
    lines: "Consultar linhas e documentos técnicos disponíveis",
    note: "Fonte institucional; confirmar o catálogo específico antes da importação."
  }
];

const STATUS_LABEL: Record<ReviewStatus, string> = {
  pending_review: "Pendente de validação",
  verified: "Verificado",
  rejected: "Rejeitado"
};

const STATUS_STYLE: Record<ReviewStatus, string> = {
  pending_review: "bg-amber-50 text-amber-700 border-amber-200",
  verified: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-rose-50 text-rose-700 border-rose-200"
};

function Status({ value }: { value?: ReviewStatus }) {
  const status = value || "pending_review";
  const Icon = status === "verified" ? CheckCircle2 : status === "rejected" ? AlertTriangle : Clock3;
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[status]}`}><Icon size={13}/>{STATUS_LABEL[status]}</span>;
}

export default function TechnicalLibraryModule() {
  const [section, setSection] = useState<Section>("documents");
  const [documents, setDocuments] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Row[]>([]);
  const [rules, setRules] = useState<Row[]>([]);
  const [hardware, setHardware] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    const subscriptions = [
      onSnapshot(query(collection(db, "technical_documents"), orderBy("createdAt", "desc")), s => setDocuments(s.docs.map(d => ({ id: d.id, ...d.data() }))), e => setError(e.message)),
      onSnapshot(query(collection(db, "aluminum_profiles"), orderBy("createdAt", "desc")), s => setProfiles(s.docs.map(d => ({ id: d.id, ...d.data() }))), e => setError(e.message)),
      onSnapshot(query(collection(db, "cutting_rules"), orderBy("createdAt", "desc")), s => setRules(s.docs.map(d => ({ id: d.id, ...d.data() }))), e => setError(e.message)),
      onSnapshot(query(collection(db, "hardware_catalog"), orderBy("createdAt", "desc")), s => setHardware(s.docs.map(d => ({ id: d.id, ...d.data() }))), e => setError(e.message))
    ];
    return () => subscriptions.forEach(unsub => unsub());
  }, []);

  const config = {
    documents: { title: "Documentos técnicos", subtitle: "Catálogos, mapas de perfis, manuais e boletins oficiais.", collection: "technical_documents", rows: documents, fields: [["manufacturer", "Fabricante"], ["line", "Linha / sistema"], ["title", "Nome do documento"], ["version", "Versão / data"], ["sourceUrl", "URL oficial"], ["pageCount", "Quantidade de páginas"]] },
    profiles: { title: "Perfis de alumínio", subtitle: "Código, peso linear e referência documental de cada perfil.", collection: "aluminum_profiles", rows: profiles, fields: [["manufacturer", "Fabricante"], ["line", "Linha / sistema"], ["code", "Código do perfil"], ["description", "Descrição"], ["weightKgM", "Peso linear (kg/m)"], ["commercialLengthMm", "Comprimento comercial (mm)"], ["documentId", "ID do documento / referência"], ["page", "Página de origem"]] },
    rules: { title: "Regras de corte", subtitle: "Fórmulas específicas por sistema, tipologia e configuração.", collection: "cutting_rules", rows: rules, fields: [["manufacturer", "Fabricante"], ["line", "Linha / sistema"], ["typology", "Tipologia"], ["configuration", "Configuração"], ["profileCode", "Código do perfil"], ["formula", "Fórmula / expressão"], ["unit", "Unidade"], ["documentId", "Documento de origem"], ["page", "Página de origem"]] },
    hardware: { title: "Acessórios e ferragens", subtitle: "Componentes vinculados ao fabricante e à linha compatível.", collection: "hardware_catalog", rows: hardware, fields: [["manufacturer", "Fabricante"], ["line", "Linha compatível"], ["code", "Código"], ["description", "Descrição"], ["unit", "Unidade"], ["documentId", "Documento de origem"], ["page", "Página de origem"]] }
  } as const;

  const current = config[section];
  const filtered = useMemo(() => current.rows.filter(row => JSON.stringify(row).toLowerCase().includes(search.toLowerCase())), [current.rows, search]);

  const openNew = () => {
    setForm({});
    setError("");
    setShowForm(true);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload: Record<string, any> = {
        ...form,
        status: "pending_review" as ReviewStatus,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        sourceCountry: "Brasil"
      };
      if (section === "profiles" && form.weightKgM) payload.weightKgM = Number(form.weightKgM.replace(",", "."));
      if (section === "profiles" && form.commercialLengthMm) payload.commercialLengthMm = Number(form.commercialLengthMm);
      if (section === "documents" && form.pageCount) payload.pageCount = Number(form.pageCount);
      if (form.page) payload.page = Number(form.page);
      await addDoc(collection(db, current.collection), payload);
      setShowForm(false);
      setForm({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar o registro.");
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (row: Row, status: ReviewStatus) => {
    try {
      await updateDoc(doc(db, current.collection, row.id), { status, updatedAt: serverTimestamp(), reviewedAt: status === "verified" ? serverTimestamp() : null });
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao atualizar a validação."); }
  };

  const remove = async (row: Row) => {
    if (!window.confirm("Excluir este registro técnico? Esta ação não pode ser desfeita.")) return;
    try { await deleteDoc(doc(db, current.collection, row.id)); }
    catch (e) { setError(e instanceof Error ? e.message : "Falha ao excluir o registro."); }
  };

  const tabs: { id: Section; label: string; icon: React.ElementType; count: number }[] = [
    { id: "documents", label: "Documentos", icon: FileText, count: documents.length },
    { id: "profiles", label: "Perfis", icon: Layers, count: profiles.length },
    { id: "rules", label: "Regras de corte", icon: Ruler, count: rules.length },
    { id: "hardware", label: "Acessórios", icon: Wrench, count: hardware.length }
  ];

  return <div className="space-y-6">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-2 text-blue-700"><BookOpen size={19}/><span className="text-xs font-bold uppercase tracking-wider">Engenharia de esquadrias</span></div>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">Biblioteca Técnica</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">Base técnica rastreável para alimentar despiece, consumo de alumínio, ferragens e orçamentos.</p>
      </div>
      <button onClick={openNew} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"><Plus size={17}/>Novo registro</button>
    </header>

    <div className="grid gap-3 md:grid-cols-3">
      {OFFICIAL_SOURCES.map(source => <article key={source.manufacturer} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-2"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Fonte oficial · {source.country}</p><h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{source.manufacturer}</h3></div><ShieldCheck className="text-blue-600" size={20}/></div>
        <p className="mt-2 text-xs leading-5 text-slate-500">{source.note}</p>
        <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300"><b>Linhas:</b> {source.lines}</p>
        <a href={source.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:underline">Abrir catálogo oficial <ExternalLink size={14}/></a>
      </article>)}
    </div>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap gap-1 border-b border-slate-200 p-2 dark:border-slate-700">
        {tabs.map(tab => { const Icon = tab.icon; return <button key={tab.id} onClick={() => { setSection(tab.id); setSearch(""); setError(""); }} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${section === tab.id ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"}`}><Icon size={16}/>{tab.label}<span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800">{tab.count}</span></button>; })}
      </div>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="font-bold text-slate-900 dark:text-white">{current.title}</h2><p className="text-xs text-slate-500">{current.subtitle}</p></div>
        <label className="relative block w-full sm:max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por código, linha ou fabricante..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-800"/></label>
      </div>
      {error && <div className="mx-4 mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      {filtered.length === 0 ? <div className="px-6 py-14 text-center"><BookOpen className="mx-auto text-slate-300" size={34}/><p className="mt-3 font-semibold text-slate-700 dark:text-slate-200">Nenhum registro nesta seção</p><p className="mt-1 text-sm text-slate-500">Cadastre os dados extraídos de um documento oficial. Eles começarão como pendentes de validação.</p></div> :
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800"><tr><th className="px-4 py-3">Identificação</th><th className="px-4 py-3">Sistema / detalhe</th><th className="px-4 py-3">Origem</th><th className="px-4 py-3">Validação</th><th className="px-4 py-3 text-right">Ações</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{filtered.map(row => <tr key={row.id} className="align-top hover:bg-slate-50/70 dark:hover:bg-slate-800/40"><td className="px-4 py-3"><p className="font-semibold text-slate-900 dark:text-white">{row.code || row.title || row.typology || row.manufacturer || "Registro técnico"}</p><p className="mt-1 text-xs text-slate-500">{row.manufacturer || "Fabricante não informado"} · {row.line || "Linha não informada"}</p></td><td className="px-4 py-3 text-slate-600 dark:text-slate-300">{section === "profiles" ? <>{row.description || "Perfil"}<p className="mt-1 font-semibold">{row.weightKgM != null ? `${row.weightKgM} kg/m` : "Peso não informado"}</p></> : section === "rules" ? <>{row.configuration || "Configuração não informada"}<p className="mt-1 max-w-sm truncate font-mono text-xs">{row.formula}</p></> : section === "hardware" ? row.description || row.code : <>{row.title}<p className="mt-1 text-xs">{row.version || "Versão não informada"}</p></>}</td><td className="px-4 py-3 text-xs text-slate-500">{row.documentId ? `Doc. ${row.documentId}` : row.sourceUrl ? <a className="text-blue-700 hover:underline" href={row.sourceUrl} target="_blank" rel="noreferrer">Abrir fonte</a> : "Fonte não vinculada"}{row.page ? <p>Página {row.page}</p> : null}</td><td className="px-4 py-3"><Status value={row.status}/></td><td className="px-4 py-3"><div className="flex justify-end gap-1"><button title="Marcar como verificado" onClick={() => changeStatus(row, "verified")} className="rounded-lg p-2 text-emerald-700 hover:bg-emerald-50"><CheckCircle2 size={16}/></button><button title="Rejeitar" onClick={() => changeStatus(row, "rejected")} className="rounded-lg p-2 text-amber-700 hover:bg-amber-50"><AlertTriangle size={16}/></button><button title="Excluir" onClick={() => remove(row)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"><Trash2 size={16}/></button></div></td></tr>)}</tbody></table></div>}
    </section>

    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><AlertTriangle className="mt-0.5 shrink-0" size={18}/><div><b>Controle de qualidade dos dados</b><p className="mt-1 text-xs leading-5">Registros pendentes ou rejeitados não devem alimentar o cálculo automático. A validação precisa conferir o código, a unidade, o peso, a fórmula e a página do catálogo original. A Biblioteca não executa expressões de fórmula como código.</p></div></div>

    {showForm && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label="Novo registro técnico">
      <form onSubmit={save} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between"><div><h3 className="text-lg font-bold text-slate-900 dark:text-white">Novo registro · {current.title}</h3><p className="text-xs text-slate-500">O registro será salvo como pendente de validação.</p></div><button type="button" onClick={() => setShowForm(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18}/></button></div>
        <div className="grid gap-3 sm:grid-cols-2">{current.fields.map(([key, label]) => <label key={key} className={key === "formula" || key === "sourceUrl" || key === "description" ? "sm:col-span-2" : ""}><span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</span>{key === "formula" || key === "description" ? <textarea required={["formula"].includes(key)} value={form[key] || ""} onChange={e => setForm(v => ({ ...v, [key]: e.target.value }))} rows={3} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-800"/> : <input required={["manufacturer","line","code","title","sourceUrl","typology","profileCode"].includes(key)} type={key === "sourceUrl" ? "url" : "text"} value={form[key] || ""} onChange={e => setForm(v => ({ ...v, [key]: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-800"/>}</label>)}</div>
        <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Cancelar</button><button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Save size={15}/>{saving ? "Salvando..." : "Salvar pendente"}</button></div>
      </form>
    </div>}
  </div>;
}
