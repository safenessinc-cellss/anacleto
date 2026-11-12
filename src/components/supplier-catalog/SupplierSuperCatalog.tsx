import React, { useEffect, useMemo, useRef, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, writeBatch } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import Papa from "papaparse";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { auth, db } from "../../firebase";
import PdfPageThumbnails from "../common/PdfPageThumbnails";
import { PackageSearch, Plus, Search, Trash2, Upload, FileText, Check, X, Sparkles } from "lucide-react";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type SupplierProduct = {
  id: string; supplier: string; code?: string; name: string; category: string;
  material?: string; unit?: string; price?: number; lengthMm?: number; color?: string;
  thumbnailSvg?: string; sourceFile?: string; sourcePage?: number;
};
type PreviewItem = {
  supplier: string; code: string; name: string; category: string; material: string;
  unit: string; price: number; lengthMm: number | null; color: string; page: number | null;
};
const categories = ["Perfil de alumínio", "Vidro", "Ferragem", "Acessório", "Janela", "Porta", "Box de banheiro", "Serviço", "Outro"];
const blank = { supplier: "", code: "", name: "", category: categories[0], material: "", unit: "un", price: "0", lengthMm: "", color: "" };
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const classify = (s: string) => {
  const v = norm(s);
  if (/vidro|temperad|laminad|espelho/.test(v)) return "Vidro";
  if (/roldana|fecho|fechadura|dobrad|puxador|parafuso|borracha|ferragem/.test(v)) return "Ferragem";
  if (/perfil|barra|alumin|trilho/.test(v)) return "Perfil de alumínio";
  if (/box|banheiro|ducha/.test(v)) return "Box de banheiro";
  if (/janela/.test(v)) return "Janela";
  if (/porta/.test(v)) return "Porta";
  if (/servico|mao de obra|instalacao/.test(v)) return "Serviço";
  return "Outro";
};
const parsePrice = (value: unknown) => {
  const raw = String(value ?? "").replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(?:,|$))/g, "").replace(",", ".");
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};
const thumbnail = (category: string, code: string) => {
  const label = (code || category.slice(0, 3)).replace(/[<>&"']/g, "").slice(0, 12);
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="64" viewBox="0 0 96 64"><rect width="96" height="64" rx="9" fill="#eaf1f8"/><path d="M13 15h70v34H13z" fill="none" stroke="#64748b" stroke-width="3"/><path d="M20 22h56v20H20z" fill="#bfdbfe" stroke="#2563eb" stroke-width="2"/><text x="48" y="59" text-anchor="middle" font-size="7" fill="#334155">' + label + '</text></svg>';
  return svg;
};
const previewFromRow = (row: Record<string, any>, supplier: string): PreviewItem | null => {
  const name = String(row.name || row.nome || row.produto || row.description || row.descricao || row.item || "").trim();
  if (!name) return null;
  return {
    supplier: String(row.supplier || row.fornecedor || row.marca || supplier).trim(),
    code: String(row.code || row.codigo || row.sku || row.referencia || row.ref || "").trim(),
    name,
    category: String(row.category || row.categoria || row.tipo || classify(name + " " + String(row.material || ""))).trim(),
    material: String(row.material || row.sistema || row.acabamento || "").trim(),
    unit: String(row.unit || row.unidade || "un").trim() || "un",
    price: parsePrice(row.price ?? row.preco ?? row.valor ?? row.custo),
    lengthMm: Number(row.lengthMm || row.comprimento || row.comprimentomm) || null,
    color: String(row.color || row.cor || "").trim(),
    page: Number(row.page) || null
  };
};

export default function SupplierSuperCatalog({ onNavigateQuotes }: { onNavigateQuotes: () => void }) {
  const [rows, setRows] = useState<SupplierProduct[]>([]);
  const [authReady, setAuthReady] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todas");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ ...blank });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [previewRows, setPreviewRows] = useState<PreviewItem[]>([]);
  const [previewSource, setPreviewSource] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [bulkCategory, setBulkCategory] = useState("");
  const [priceAdjustment, setPriceAdjustment] = useState("0");
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState("");
  const [pdfPageCount, setPdfPageCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => setAuthReady(!!user));
    return () => unsubscribe();
  }, []);
  useEffect(() => {
    if (!authReady) return;
    return onSnapshot(query(collection(db, "supplier_catalog"), orderBy("name", "asc")), snap => {
      setRows(snap.docs.map(d => ({ id: d.id, ...d.data() } as SupplierProduct)));
    }, e => setError(e.message || "Erro ao carregar catálogo. Verifique as regras do Firestore."));
  }, [authReady]);
  useEffect(() => () => { if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl); }, [pdfPreviewUrl]);

  const filtered = useMemo(() => rows.filter(p =>
    (category === "Todas" || p.category === category) &&
    [p.name, p.code, p.supplier, p.category, p.material, p.color].some(v => norm(String(v || "")).includes(norm(search)))
  ), [rows, search, category]);

  const save = async () => {
    if (!form.supplier.trim() || !form.name.trim()) { setError("Informe fornecedor e nome do produto."); return; }
    setSaving(true); setError("");
    try {
      await addDoc(collection(db, "supplier_catalog"), {
        supplier: form.supplier.trim(), code: form.code.trim(), name: form.name.trim(),
        category: form.category === "Outro" ? classify(form.name + " " + form.material) : form.category,
        material: form.material.trim(), unit: form.unit.trim() || "un", price: parsePrice(form.price),
        lengthMm: form.lengthMm ? Number(form.lengthMm) : null, color: form.color.trim(),
        thumbnailSvg: thumbnail(form.category, form.code), createdAt: new Date().toISOString()
      });
      setForm({ ...blank }); setFormOpen(false); setNotice("Produto guardado no catálogo."); 
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao guardar produto."); }
    finally { setSaving(false); }
  };

  const setPreviewField = (index: number, field: keyof PreviewItem, value: string | number | null) => {
    setPreviewRows(current => current.map((row, i) => i === index ? { ...row, [field]: value } : row));
  };

  const importCsv = (file: File) => {
    Papa.parse<Record<string, string>>(file, {
      header: true, skipEmptyLines: true,
      transformHeader: h => norm(h).replace(/[^a-z0-9]/g, ""),
      complete: result => {
        const mapped = result.data.map(row => previewFromRow(row, supplierName || file.name.replace(/\.[^.]+$/, ""))).filter(Boolean) as PreviewItem[];
        if (!mapped.length) { setError("Nenhuma linha de catálogo válida foi encontrada no CSV."); return; }
        setPreviewRows(mapped); setPreviewSource(file.name); setNotice(mapped.length + " itens preparados. Revise antes de confirmar.");
      },
      error: e => setError(e.message)
    });
  };

  const importPdf = async (file: File) => {
    const user = auth.currentUser;
    if (!user) throw new Error("Entre na plataforma para importar o catálogo do fornecedor.");
    const objectUrl = URL.createObjectURL(file);
    setPdfPreviewUrl(objectUrl);
    setImportBusy(true);
    setError("");
    setNotice("Lendo páginas e extraindo o texto do PDF...");
    const loadingTask = getDocument({ data: await file.arrayBuffer() });
    try {
      const pdf = await loadingTask.promise;
      setPdfPageCount(pdf.numPages);
      const pageTexts: string[] = [];
      const pageLimit = Math.min(pdf.numPages, 120);
      for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        const text = content.items.map(item => "str" in item ? item.str : "").filter(Boolean).join(" ");
        if (text.trim()) pageTexts.push("[PÁGINA " + pageNumber + "]\n" + text);
      }
      const extractedText = pageTexts.join("\n").slice(0, 220000);
      if (extractedText.length < 10) throw new Error("Este PDF parece ser digitalizado sem camada de texto. Será necessário OCR antes da importação.");
      setNotice("Enviando texto extraído para estruturar os itens com IA...");
      const token = await user.getIdToken();
      const response = await fetch("/api/ai/catalog-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ text: extractedText, supplier: supplierName || file.name.replace(/\.[^.]+$/, ""), fileName: file.name, pageCount: pdf.numPages })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível estruturar o catálogo.");
      const mapped = (Array.isArray(result.items) ? result.items : []).map((item: any) => previewFromRow(item, supplierName || file.name.replace(/\.[^.]+$/, ""))).filter(Boolean) as PreviewItem[];
      if (!mapped.length) throw new Error(result.warning || "Nenhum item foi reconhecido. Tente outro PDF ou CSV.");
      setPreviewRows(mapped); setPreviewSource(file.name);
      setNotice((result.fallback ? "Extração local de contingência. " : "Extração assistida por IA. ") + mapped.length + " itens encontrados em " + pdf.numPages + " páginas. Revise antes de salvar.");
    } finally {
      await loadingTask.destroy();
      setImportBusy(false);
    }
  };

  const handleImportFile = async (file?: File) => {
    if (!file) return;
    setError(""); setNotice(""); setPreviewRows([]);
    const detectedSupplier = supplierName.trim() || file.name.replace(/\.[^.]+$/, "");
    setSupplierName(detectedSupplier);
    try {
      if (file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf") await importPdf(file);
      else if (file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv") importCsv(file);
      else throw new Error("Formato não suportado. Importe PDF ou CSV.");
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao importar arquivo."); setImportBusy(false); }
  };

  const applyBulkCategory = () => {
    if (!bulkCategory) return;
    setPreviewRows(current => current.map(row => ({ ...row, category: bulkCategory })));
  };
  const applyPriceAdjustment = () => {
    const percent = Number(priceAdjustment);
    if (!Number.isFinite(percent) || percent < -100 || percent > 500) { setError("Ajuste de preço deve ficar entre -100% e 500%."); return; }
    setPreviewRows(current => current.map(row => ({ ...row, price: Math.max(0, Number((row.price * (1 + percent / 100)).toFixed(2))) })));
  };
  const confirmImport = async () => {
    if (!previewRows.length) return;
    setSaving(true); setError("");
    try {
      const rowsToSave = previewRows.filter(row => row.name.trim() && row.supplier.trim());
      for (let start = 0; start < rowsToSave.length; start += 400) {
        const batch = writeBatch(db);
        rowsToSave.slice(start, start + 400).forEach(row => {
          const ref = doc(collection(db, "supplier_catalog"));
          batch.set(ref, {
            supplier: row.supplier.trim(), code: row.code.trim(), name: row.name.trim(),
            category: categories.includes(row.category) ? row.category : classify(row.name + " " + row.material),
            material: row.material.trim(), unit: row.unit.trim() || "un", price: parsePrice(row.price),
            lengthMm: row.lengthMm || null, color: row.color.trim(),
            thumbnailSvg: thumbnail(row.category, row.code),
            sourceFile: previewSource, sourcePage: row.page || null,
            importMethod: previewSource.toLowerCase().endsWith(".pdf") ? "pdf-text-ai" : "csv",
            importedAt: new Date().toISOString(), createdAt: new Date().toISOString()
          });
        });
        await batch.commit();
      }
      setNotice(rowsToSave.length + " itens importados e salvos no catálogo de fornecedores.");
      setPreviewRows([]); setPreviewSource(""); setPdfPreviewUrl(""); setPdfPageCount(0);
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao salvar os itens."); }
    finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Eliminar produto do catálogo?")) return;
    try { await deleteDoc(doc(db, "supplier_catalog", id)); }
    catch (e) { setError(e instanceof Error ? e.message : "Erro ao eliminar."); }
  };

  return <section className="space-y-6 text-slate-900 dark:text-slate-100">
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-wider text-blue-600">ANACLETO ESQUADRIAS · COMPRAS</p><h1 className="mt-1 text-3xl font-black">Catálogo de Fornecedores</h1><p className="mt-2 text-sm text-slate-500">Importe PDF e CSV, revise os dados extraídos e salve itens pesquisáveis para os orçamentos.</p></div>
      <div className="flex flex-wrap gap-2">
        <input value={supplierName} onChange={e => setSupplierName(e.target.value)} placeholder="Nome do fornecedor" className="min-w-44 rounded-xl border bg-white px-3 py-2.5 text-sm dark:bg-slate-900"/>
        <button disabled={importBusy} onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold disabled:opacity-50"><Upload className="h-4 w-4"/> Importar PDF / CSV</button>
        <button onClick={() => setFormOpen(!formOpen)} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white"><Plus className="h-4 w-4"/> Novo item</button>
        <input ref={fileRef} hidden type="file" accept=".pdf,.csv,application/pdf,text/csv" onChange={e => { void handleImportFile(e.target.files?.[0]); e.currentTarget.value = ""; }}/>
      </div>
    </header>
    <div className="grid gap-3 sm:grid-cols-3">{[{label:"Produtos",value:rows.length},{label:"Fornecedores",value:new Set(rows.map(p=>p.supplier)).size},{label:"Categorias",value:new Set(rows.map(p=>p.category)).size}].map(x=><div key={x.label} className="rounded-2xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><p className="text-xs text-slate-500">{x.label} no catálogo</p><p className="mt-1 text-2xl font-black">{x.value}</p></div>)}</div>
    {error && <p role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    {importBusy && <p className="flex items-center gap-2 text-sm text-blue-700"><Sparkles className="h-4 w-4 animate-pulse"/> Processando catálogo...</p>}
    {pdfPreviewUrl && <div className="rounded-2xl border bg-white p-4 dark:bg-slate-900"><div className="flex items-center gap-2 font-bold"><FileText className="h-4 w-4"/> Pré-visualização do PDF · {pdfPageCount} páginas</div><PdfPageThumbnails url={pdfPreviewUrl} pageLimit={3}/></div>}
    {previewRows.length > 0 && <div className="space-y-3 rounded-2xl border border-blue-200 bg-white p-4 dark:border-blue-900 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-bold">Revisão antes de importar · {previewRows.length} itens</h2><p className="text-xs text-slate-500">{previewSource}</p></div><div className="flex gap-2"><button onClick={() => {setPreviewRows([]);setPreviewSource("");}} className="rounded-lg border px-3 py-2 text-xs font-bold"><X className="mr-1 inline h-3 w-3"/> Cancelar</button><button disabled={saving} onClick={() => void confirmImport()} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Check className="mr-1 inline h-3 w-3"/> {saving?"Salvando...":"Confirmar importação"}</button></div></div>
      <div className="flex flex-wrap items-end gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
        <label className="text-xs font-semibold">Categoria para todos<select value={bulkCategory} onChange={e=>setBulkCategory(e.target.value)} className="mt-1 block rounded-lg border p-2 text-sm text-slate-900"><option value="">Manter categorias</option>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
        <button onClick={applyBulkCategory} className="rounded-lg border px-3 py-2 text-xs font-bold">Aplicar categoria</button>
        <label className="text-xs font-semibold">Ajuste de preço em lote (%)<input type="number" value={priceAdjustment} onChange={e=>setPriceAdjustment(e.target.value)} className="mt-1 block w-28 rounded-lg border p-2 text-sm text-slate-900"/></label>
        <button onClick={applyPriceAdjustment} className="rounded-lg border px-3 py-2 text-xs font-bold">Aplicar ajuste</button>
      </div>
      <div className="max-h-[520px] overflow-auto rounded-xl border"><table className="w-full min-w-[950px] text-left text-xs"><thead className="sticky top-0 bg-slate-100 dark:bg-slate-800"><tr>{["Miniatura","Código","Descrição","Categoria","Unidade","Preço unitário (R$)","Fornecedor","Página"].map(h=><th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>{previewRows.map((row,index)=><tr key={index} className="border-t dark:border-slate-800"><td className="p-2"><img alt="" className="h-10 w-14 rounded border bg-white" src={"data:image/svg+xml;charset=utf-8,"+encodeURIComponent(thumbnail(row.category,row.code))}/></td><td className="p-2"><input value={row.code} onChange={e=>setPreviewField(index,"code",e.target.value)} className="w-24 rounded border p-1 text-slate-900"/></td><td className="p-2"><input value={row.name} onChange={e=>setPreviewField(index,"name",e.target.value)} className="w-64 rounded border p-1 text-slate-900"/></td><td className="p-2"><select value={row.category} onChange={e=>setPreviewField(index,"category",e.target.value)} className="rounded border p-1 text-slate-900">{categories.map(c=><option key={c}>{c}</option>)}</select></td><td className="p-2"><input value={row.unit} onChange={e=>setPreviewField(index,"unit",e.target.value)} className="w-16 rounded border p-1 text-slate-900"/></td><td className="p-2"><input type="number" min="0" step="0.01" value={row.price} onChange={e=>setPreviewField(index,"price",Number(e.target.value))} className="w-28 rounded border p-1 text-right text-slate-900"/></td><td className="p-2"><input value={row.supplier} onChange={e=>setPreviewField(index,"supplier",e.target.value)} className="w-36 rounded border p-1 text-slate-900"/></td><td className="p-2">{row.page || "—"}</td></tr>)}</tbody></table></div>
    </div>}
    {formOpen && <div className="rounded-2xl border border-blue-200 bg-white p-4 dark:bg-slate-900"><h2 className="mb-3 font-bold">Adicionar item do fornecedor</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[{key:"supplier",label:"Fornecedor *"},{key:"name",label:"Nome do produto *"},{key:"code",label:"Código / SKU"},{key:"material",label:"Material / sistema"},{key:"price",label:"Preço unitário (R$)"},{key:"lengthMm",label:"Comprimento da barra (mm)"},{key:"unit",label:"Unidade"},{key:"color",label:"Cor / acabamento"}].map(f=><label key={f.key} className="text-xs font-semibold text-slate-500">{f.label}<input type={["price","lengthMm"].includes(f.key)?"number":"text"} value={(form as Record<string,string>)[f.key]} onChange={e=>setForm({...form,[f.key]:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5 text-sm text-slate-900"/></label>)}<label className="text-xs font-semibold text-slate-500">Categoria<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5 text-sm text-slate-900">{categories.map(c=><option key={c}>{c}</option>)}</select></label></div><div className="mt-4 flex gap-2"><button disabled={saving} onClick={()=>void save()} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white">{saving?"Salvando...":"Salvar item"}</button><button onClick={()=>setFormOpen(false)} className="rounded-lg border px-4 py-2 text-sm font-bold">Cancelar</button></div></div>}
    <div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Pesquisar produto, código, fornecedor..." className="w-full rounded-xl border bg-white py-3 pl-10 pr-3 text-sm dark:border-slate-800 dark:bg-slate-900"/></div><select value={category} onChange={e=>setCategory(e.target.value)} className="rounded-xl border bg-white px-3 py-3 text-sm dark:border-slate-800 dark:bg-slate-900"><option>Todas</option>{categories.map(c=><option key={c}>{c}</option>)}</select></div>
    <div className="overflow-hidden rounded-2xl border bg-white dark:border-slate-800 dark:bg-slate-900"><div className="border-b p-4 dark:border-slate-800"><h2 className="font-bold">Itens dos fornecedores ({filtered.length})</h2></div>{filtered.length===0?<div className="p-10 text-center"><PackageSearch className="mx-auto h-10 w-10 text-slate-400"/><p className="mt-3 font-bold">Nenhum item encontrado</p><p className="mt-1 text-sm text-slate-500">Use “Importar catálogo PDF / CSV” ou adicione um produto.</p></div>:<div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800"><tr><th className="p-3">Miniatura</th><th className="p-3">Produto</th><th className="p-3">Fornecedor</th><th className="p-3">Categoria</th><th className="p-3">Material</th><th className="p-3">Unidade</th><th className="p-3">Preço</th><th className="p-3">Ações</th></tr></thead><tbody>{filtered.map(p=><tr key={p.id} className="border-t dark:border-slate-800"><td className="p-3"><img alt="" className="h-10 w-14 rounded border bg-white" src={"data:image/svg+xml;charset=utf-8,"+encodeURIComponent(p.thumbnailSvg||thumbnail(p.category,p.code||""))}/></td><td className="p-3 font-bold">{p.name}<p className="text-xs font-normal text-slate-500">{p.code||"Sem código"}{p.lengthMm?" · "+p.lengthMm+" mm":""}</p></td><td className="p-3">{p.supplier}</td><td className="p-3">{p.category}</td><td className="p-3">{[p.material,p.color].filter(Boolean).join(" · ")||"—"}</td><td className="p-3">{p.unit||"un"}</td><td className="p-3">{Number(p.price||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</td><td className="p-3"><button onClick={()=>void remove(p.id)} aria-label="Eliminar" className="text-rose-600"><Trash2 className="h-4 w-4"/></button></td></tr>)}</tbody></table></div>}</div>
    <button onClick={onNavigateQuotes} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white">Ir para Orçamentos →</button>
  </section>;
}
