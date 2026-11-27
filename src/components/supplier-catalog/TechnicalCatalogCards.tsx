import React, { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, query } from "firebase/firestore";
import { db } from "../../firebase";
import { Boxes, Image as ImageIcon, Search } from "lucide-react";

type TechnicalRecord = { id: string; [key: string]: any };
type CatalogKind = "all" | "documents" | "profiles" | "hardware" | "rules" | "prices" | "supplier_products";
type CatalogCard = {
  id: string;
  kind: Exclude<CatalogKind, "all">;
  title: string;
  subtitle: string;
  manufacturer: string;
  line: string;
  code: string;
  image: string;
  sourceUrl: string;
  sourcePage?: number;
  status: string;
  details: Array<[string, string]>;
};

const tabs: Array<{ id: CatalogKind; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "documents", label: "Catálogos e documentos" },
  { id: "profiles", label: "Perfis" },
  { id: "hardware", label: "Acessórios" },
  { id: "rules", label: "Regras e tipologias" },
  { id: "prices", label: "Preços" },
  { id: "supplier_products", label: "Produtos importados" },
];
const text = (value: unknown) => value === undefined || value === null || value === "" ? "" : String(value);
const money = (value: unknown) => Number.isFinite(Number(value)) && Number(value) > 0
  ? Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
  : "Não informado";
const statusLabel = (value: unknown) => value === "verified" ? "Verificado" : value === "rejected" ? "Rejeitado" : "Pendente de validação";
const statusClass = (value: unknown) => value === "verified"
  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
  : value === "rejected" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-800";

export default function TechnicalCatalogCards() {
  const [documents, setDocuments] = useState<TechnicalRecord[]>([]);
  const [profiles, setProfiles] = useState<TechnicalRecord[]>([]);
  const [hardware, setHardware] = useState<TechnicalRecord[]>([]);
  const [rules, setRules] = useState<TechnicalRecord[]>([]);
  const [prices, setPrices] = useState<TechnicalRecord[]>([]);
  const [supplierProducts, setSupplierProducts] = useState<TechnicalRecord[]>([]);
  const [kind, setKind] = useState<CatalogKind>("all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const subscriptions = [
      onSnapshot(query(collection(db, "technical_documents"), limit(300)), snap => setDocuments(snap.docs.map(d => ({ id: d.id, ...d.data() }))), e => setError(e.message)),
      onSnapshot(query(collection(db, "aluminum_profiles"), limit(300)), snap => setProfiles(snap.docs.map(d => ({ id: d.id, ...d.data() }))), e => setError(e.message)),
      onSnapshot(query(collection(db, "hardware_catalog"), limit(300)), snap => setHardware(snap.docs.map(d => ({ id: d.id, ...d.data() }))), e => setError(e.message)),
      onSnapshot(query(collection(db, "cutting_rules"), limit(300)), snap => setRules(snap.docs.map(d => ({ id: d.id, ...d.data() }))), e => setError(e.message)),
      onSnapshot(query(collection(db, "supplier_prices"), limit(300)), snap => setPrices(snap.docs.map(d => ({ id: d.id, ...d.data() }))), e => setError(e.message)),
      onSnapshot(query(collection(db, "supplier_catalog"), limit(300)), snap => setSupplierProducts(snap.docs.map(d => ({ id: d.id, ...d.data() }))), e => setError(e.message)),
    ];
    return () => subscriptions.forEach(unsubscribe => unsubscribe());
  }, []);

  const cards = useMemo<CatalogCard[]>(() => [
    ...documents.map((row): CatalogCard => ({
      id: "doc:" + row.id, kind: "documents" as const,
      title: text(row.title) || "Catálogo técnico",
      subtitle: text(row.version) || "Documento do fabricante",
      manufacturer: text(row.manufacturer) || "Fabricante não informado",
      line: text(row.line) || "Linha não informada",
      code: text(row.documentCode),
      image: text(row.coverUrl || row.thumbnailUrl || row.imageUrl || row.photoUrl),
      sourceUrl: text(row.sourceUrl), sourcePage: Number(row.page) || undefined,
      status: text(row.status) || "pending_review",
      details: [["Tipo", "Documento técnico"], ["Versão", text(row.version) || "Não informada"], ["Páginas", text(row.pageCount) || "Não informado"], ["Arquivo", text(row.originalFileName || row.title)], ["Método de importação", text(row.extractionMethod) || "Registro de fonte"], ["ID do documento", row.id]],
    })),
    ...profiles.map((row): CatalogCard => ({
      id: "profile:" + row.id, kind: "profiles" as const,
      title: text(row.description) || "Perfil de alumínio",
      subtitle: text(row.code) || "Código não informado",
      manufacturer: text(row.manufacturer) || "Fabricante não informado",
      line: text(row.line) || "Linha não informada",
      code: text(row.code),
      image: text(row.photoUrl || row.imageUrl || row.sourcePageImageUrl || row.thumbnailUrl || row.image),
      sourceUrl: text(row.sourceUrl), sourcePage: Number(row.page) || undefined,
      status: text(row.status) || "pending_review",
      details: [["Código", text(row.code) || "Não informado"], ["Peso linear", text(row.weightKgM) ? text(row.weightKgM) + " kg/m" : "Não informado"], ["Peso por barra", text(row.weightKgBar) ? text(row.weightKgBar) + " kg" : "Não informado"], ["Comprimento comercial", text(row.commercialLengthMm) ? text(row.commercialLengthMm) + " mm" : "Não informado"], ["Acabamento", text(row.finish) || "Não informado"], ["Documento de origem", text(row.documentId) || "Não vinculado"], ["Página", text(row.page) || "Não informada"]],
    })),
    ...hardware.map((row): CatalogCard => ({
      id: "hardware:" + row.id, kind: "hardware" as const,
      title: text(row.description) || "Acessório / ferragem",
      subtitle: text(row.code) || "Código não informado",
      manufacturer: text(row.manufacturer) || "Fabricante não informado",
      line: text(row.line) || "Compatibilidade não informada",
      code: text(row.code),
      image: text(row.photoUrl || row.imageUrl || row.thumbnailUrl || row.image),
      sourceUrl: text(row.sourceUrl), sourcePage: Number(row.page) || undefined,
      status: text(row.status) || "pending_review",
      details: [["Código", text(row.code) || "Não informado"], ["Tipologia", text(row.typology) || "Todas / não especificada"], ["Acabamento", text(row.finish) || "Não informado"], ["Unidade", text(row.unit) || "Não informada"], ["Quantidade por esquadria", text(row.quantity) || text(row.quantityFormula) || "Não definida"], ["Documento de origem", text(row.documentId) || "Não vinculado"], ["Página", text(row.page) || "Não informada"]],
    })),
    ...rules.map((row): CatalogCard => ({
      id: "rule:" + row.id, kind: "rules" as const,
      title: text(row.description) || text(row.profileCode) || "Regra técnica",
      subtitle: text(row.typology) || "Tipologia não informada",
      manufacturer: text(row.manufacturer) || "Fabricante não informado",
      line: text(row.line) || "Linha não informada",
      code: text(row.profileCode),
      image: text(row.photoUrl || row.imageUrl || row.thumbnailUrl),
      sourceUrl: text(row.sourceUrl), sourcePage: Number(row.page) || undefined,
      status: text(row.status) || "pending_review",
      details: [["Configuração", text(row.configuration) || "Não informada"], ["Código do componente", text(row.profileCode) || "Não informado"], ["Categoria", text(row.category) || "Não informada"], ["Fórmula de corte / consumo", text(row.formula) || "Não informada"], ["Quantidade por esquadria", text(row.quantityFormula) || text(row.cutCount) || "Não informada"], ["Kerf", text(row.kerfMm) ? text(row.kerfMm) + " mm" : "Não informado"], ["Vidro", [text(row.glassType), text(row.glassThicknessMm) ? text(row.glassThicknessMm) + " mm" : ""].filter(Boolean).join(" · ") || "Não aplicável"], ["Documento de origem", text(row.documentId) || "Não vinculado"], ["Página", text(row.page) || "Não informada"]],
    })),
    ...prices.map((row): CatalogCard => ({
      id: "price:" + row.id, kind: "prices" as const,
      title: text(row.description) || text(row.code) || "Cotação de fornecedor",
      subtitle: money(row.unitPrice) + " / " + (text(row.unit) || "unidade"),
      manufacturer: text(row.manufacturer || row.supplier) || "Fornecedor não informado",
      line: text(row.line) || "Linha não informada",
      code: text(row.code),
      image: text(row.photoUrl || row.imageUrl || row.thumbnailUrl),
      sourceUrl: text(row.sourceUrl), sourcePage: Number(row.page) || undefined,
      status: text(row.status || row.priceStatus) || "pending_review",
      details: [["Código", text(row.code) || "Não informado"], ["Unidade", text(row.unit) || "Não informada"], ["Preço unitário", money(row.unitPrice)], ["Frete confirmado", row.shippingCost == null ? "Não informado" : money(row.shippingCost)], ["Data da cotação", text(row.priceDate) || "Não informada"], ["Validade", text(row.validUntil) || "Não informada"], ["Referência", text(row.quoteReference) || "Não informada"]],
    })),
    ...supplierProducts.map((row): CatalogCard => ({
      id: "supplier-product:" + row.id, kind: "supplier_products" as const,
      title: text(row.name) || "Produto de fornecedor",
      subtitle: text(row.code || row.supplierCode) || "Código não informado",
      manufacturer: text(row.supplier || row.manufacturer) || "Fornecedor não informado",
      line: text(row.line || row.material) || "Linha / material não informado",
      code: text(row.code || row.supplierCode),
      image: text(row.photoUrl || row.imageUrl || row.thumbnailDataUrl),
      sourceUrl: text(row.sourceUrl), sourcePage: Number(row.sourcePage || row.page) || undefined,
      status: text(row.status) || "pending_review",
      details: [["Código", text(row.code || row.supplierCode) || "Não informado"], ["Categoria", text(row.category) || "Não informada"], ["Material", text(row.material) || "Não informado"], ["Unidade", text(row.unit) || "Não informada"], ["Comprimento", text(row.lengthMm) ? text(row.lengthMm) + " mm" : "Não informado"], ["Espessura", text(row.thicknessMm) ? text(row.thicknessMm) + " mm" : "Não informado"], ["Peso", text(row.weightKg) ? text(row.weightKg) + " kg" : "Não informado"], ["Acabamento / cor", text(row.color) || "Não informado"], ["Preço importado (pendente)", money(row.importedPrice ?? row.price)], ["Arquivo de origem", text(row.sourceFileName || row.sourceFileType) || "Não informado"], ["Página", text(row.sourcePage || row.page) || "Não informada"], ["Confiança da extração IA", text(row.aiConfidence) || "Não informada"], ["Observações IA", text(row.aiNotes) || "Nenhuma"]],
    })),
  ], [documents, profiles, hardware, rules, prices, supplierProducts]);

  const consolidatedCards = useMemo(() => {
    const result: CatalogCard[] = [];
    const productKinds: CatalogKind[] = ["profiles", "supplier_products"];
    const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, "");
    for (const card of cards) {
      if (!productKinds.includes(card.kind)) { result.push(card); continue; }
      const identity = normalize(card.manufacturer) + "::" + normalize(card.line) + "::" + normalize(card.code || card.title);
      const existing = result.find(item => productKinds.includes(item.kind) && normalize(item.manufacturer) + "::" + normalize(item.line) + "::" + normalize(item.code || item.title) === identity);
      if (!existing) { result.push(card); continue; }
      if (!existing.image && card.image) existing.image = card.image;
      if (!existing.sourceUrl && card.sourceUrl) existing.sourceUrl = card.sourceUrl;
      if (!existing.sourcePage && card.sourcePage) existing.sourcePage = card.sourcePage;
      if (card.status === "verified") existing.status = "verified";
      const labels = new Set(existing.details.map(([label]) => label));
      for (const detail of card.details) if (!labels.has(detail[0]) && detail[1] && detail[1] !== "Não informado") existing.details.push(detail);
    }
    return result;
  }, [cards]);

  const filtered = useMemo(() => consolidatedCards.filter(card =>
    (kind === "all" || card.kind === kind) &&
    [card.title, card.subtitle, card.manufacturer, card.line, card.code, ...card.details.flatMap(pair => pair)].join(" ").toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"))
  ), [consolidatedCards, kind, search]);

  const counts = useMemo(() => ({
    documents: documents.length, profiles: profiles.length, hardware: hardware.length, rules: rules.length, prices: prices.length, supplier_products: supplierProducts.length,
  }), [documents, profiles, hardware, rules, prices, supplierProducts]);

  return <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-wider text-blue-600">Biblioteca técnica conectada</p><h2 className="text-xl font-bold text-slate-900 dark:text-white">Catálogo visual de produtos e componentes</h2><p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">Consulta os mesmos registros da Biblioteca Técnica, sem copiar nem duplicar dados. Cada ficha mantém fabricante, linha, código, especificações, origem e estado de validação.</p></div>
      <div className="text-xs text-slate-500">{consolidatedCards.length} fichas consolidadas</div>
    </header>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar fabricante, linha, código ou especificação..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-800"/></div>
      <div className="flex gap-1 overflow-x-auto">{tabs.map(tab => <button key={tab.id} type="button" onClick={() => setKind(tab.id)} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold ${kind === tab.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>{tab.label}{tab.id !== "all" ? " (" + counts[tab.id] + ")" : ""}</button>)}</div>
    </div>
    {filtered.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500"><PackageSearchFallback/>Nenhum registro técnico corresponde à pesquisa. Registre ou importe o catálogo na Biblioteca Técnica.</div> :
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{filtered.map(card => <article key={card.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
        <div className="grid grid-cols-[104px_1fr] gap-3 p-3">
          <div className="flex h-28 items-center justify-center overflow-hidden rounded-lg bg-slate-50 dark:bg-slate-800">{card.image ? <img src={card.image} alt={card.title} className="h-full w-full object-contain"/> : <div className="flex flex-col items-center gap-1 text-slate-400"><ImageIcon size={25}/><span className="text-[10px]">Imagem não cadastrada</span></div>}</div>
          <div className="min-w-0"><span className="text-[10px] font-bold uppercase tracking-wide text-blue-600">{tabs.find(tab => tab.id === card.kind)?.label}</span><h3 className="mt-1 line-clamp-2 text-sm font-bold text-slate-900 dark:text-white">{card.title}</h3><p className="mt-1 text-xs text-slate-500">{card.subtitle}</p><p className="mt-2 text-xs font-semibold text-slate-700 dark:text-slate-300">{card.manufacturer}</p><p className="text-xs text-slate-500">{card.line}</p><span className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusClass(card.status)}`}>{statusLabel(card.status)}</span></div>
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-slate-100 px-3 py-3 dark:border-slate-800">{card.details.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-[10px] uppercase tracking-wide text-slate-400">{label}</dt><dd className="break-words text-xs text-slate-700 dark:text-slate-300">{value || "Não informado"}</dd></div>)}</dl>
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-3 py-2 dark:border-slate-800"><span className="text-[10px] text-slate-400">{card.code ? "Código: " + card.code : "Registro técnico " + card.id.split(":")[1].slice(0, 8)}{card.sourcePage ? " · pág. " + card.sourcePage : ""}</span>{card.sourceUrl ? <a href={card.sourceUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-blue-700 hover:underline">Abrir origem ↗</a> : <span className="text-[10px] text-slate-400">Origem sem link</span>}</div>
      </article>)}</div>}
  </section>;
}

function PackageSearchFallback() {
  return <span className="mx-auto mb-2 block"><Boxes className="mx-auto h-7 w-7 text-slate-300"/></span>;
}
