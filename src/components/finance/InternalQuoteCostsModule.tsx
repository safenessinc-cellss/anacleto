import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import { Calculator, Plus, Save, Trash2, LockKeyhole, AlertTriangle, Copy, RefreshCw } from "lucide-react";
import { auth, db } from "../../firebase";
import type { Quote } from "../../types";

type CostCategory = "aluminum" | "glass" | "hardware" | "consumables" | "labor" | "installation" | "freight" | "other";
type CostLine = {
  id: string;
  category: CostCategory;
  description: string;
  code?: string;
  supplier?: string;
  quantity: number;
  unit: string;
  unitCost: number;
  source?: "manual" | "quote_item" | "bom";
};
type CostSheet = {
  id: string;
  quoteId: string;
  quoteNumber: string;
  revisionKey: string;
  lines: CostLine[];
  pricingMode: "markup" | "margin";
  pricingRate: number;
  costTotal: number;
  suggestedSaleTotal: number;
  updatedAt?: any;
  updatedBy?: string;
};

const CATEGORY_LABELS: Record<CostCategory, string> = {
  aluminum: "Alumínio",
  glass: "Vidro",
  hardware: "Acessórios e ferragens",
  consumables: "Consumíveis",
  labor: "Mão de obra",
  installation: "Instalação",
  freight: "Frete e logística",
  other: "Outros custos"
};
const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number.isFinite(value) ? value : 0);
const newId = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : "cost_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
const revisionOf = (quote: Quote) => String(quote.approvedSnapshotId || quote.snapshotContentHash || quote.updatedAt || quote.createdAt || "draft").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 90);
const quoteDate = (value: any) => value?.toDate ? value.toDate().toLocaleString("pt-BR") : value ? new Date(value).toLocaleString("pt-BR") : "—";

export default function InternalQuoteCostsModule() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [sheets, setSheets] = useState<CostSheet[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState("");
  const [lines, setLines] = useState<CostLine[]>([]);
  const [pricingMode, setPricingMode] = useState<"markup" | "margin">("markup");
  const [pricingRate, setPricingRate] = useState(30);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const stopQuotes = onSnapshot(query(collection(db, "quotes"), orderBy("createdAt", "desc")), snap => {
      setQuotes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Quote)));
      setLoading(false);
    }, err => { setError("Não foi possível carregar os orçamentos: " + err.message); setLoading(false); });
    const stopSheets = onSnapshot(query(collection(db, "internal_quote_costs"), orderBy("updatedAt", "desc")), snap => {
      setSheets(snap.docs.map(d => ({ id: d.id, ...d.data() } as CostSheet)));
    }, err => setError("Acesso à base de custos não autorizado ou indisponível: " + err.message));
    return () => { stopQuotes(); stopSheets(); };
  }, []);

  const selectedQuote = quotes.find(q => q.id === selectedQuoteId) || null;
  const revisionKey = selectedQuote ? revisionOf(selectedQuote) : "";
  const activeSheet = sheets.find(s => s.quoteId === selectedQuoteId && s.revisionKey === revisionKey) || null;
  const latestSheet = sheets.find(s => s.quoteId === selectedQuoteId) || null;
  const isStale = !!latestSheet && latestSheet.revisionKey !== revisionKey;

  useEffect(() => {
    if (!selectedQuote) { setLines([]); setNotice(""); return; }
    const sheet = sheets.find(s => s.quoteId === selectedQuote.id && s.revisionKey === revisionOf(selectedQuote));
    if (sheet) {
      setLines(Array.isArray(sheet.lines) ? sheet.lines : []);
      setPricingMode(sheet.pricingMode || "markup");
      setPricingRate(Number(sheet.pricingRate ?? 30));
      setNotice("");
    } else if (!sheets.some(s => s.quoteId === selectedQuote.id)) {
      setLines([]);
      setPricingMode("markup");
      setPricingRate(30);
      setNotice("Ainda não existe uma ficha interna de custos para este orçamento.");
    } else {
      setLines([]);
      setPricingMode("markup");
      setPricingRate(30);
      setNotice("A versão técnica/comercial mudou. Crie uma nova ficha de custos para esta revisão; a ficha anterior foi preservada.");
    }
  }, [selectedQuoteId, selectedQuote?.id, revisionKey, sheets]);

  const costTotal = useMemo(() => lines.reduce((sum, line) => sum + Math.max(0, Number(line.quantity) || 0) * Math.max(0, Number(line.unitCost) || 0), 0), [lines]);
  const validRate = pricingMode === "margin" ? Math.min(99.99, Math.max(0, pricingRate)) : Math.max(0, pricingRate);
  const suggestedSaleTotal = pricingMode === "margin" ? costTotal / (1 - validRate / 100) : costTotal * (1 + validRate / 100);
  const grossProfit = suggestedSaleTotal - costTotal;
  const effectiveMargin = suggestedSaleTotal > 0 ? grossProfit / suggestedSaleTotal * 100 : 0;

  const updateLine = (id: string, patch: Partial<CostLine>) => setLines(current => current.map(line => line.id === id ? { ...line, ...patch } : line));
  const addLine = () => setLines(current => [...current, { id: newId(), category: "other", description: "", quantity: 1, unit: "un", unitCost: 0, source: "manual" }]);
  const importQuoteLines = () => {
    if (!selectedQuote) return;
    const imported = (selectedQuote.items || []).map(item => ({
      id: newId(), category: "other" as CostCategory, description: item.description || "Item do orçamento",
      code: item.sku || "", quantity: Number(item.quantity || 1), unit: "un", unitCost: 0, source: "quote_item" as const
    }));
    setLines(current => [...current, ...imported]);
    setNotice("Linhas comerciais copiadas como rascunho. Informe os custos reais; preços de venda não foram tratados como custos.");
  };
  const saveSheet = async () => {
    if (!selectedQuote) return;
    if (!auth.currentUser) { setError("Sessão expirada. Entre novamente."); return; }
    if (lines.some(line => !line.description.trim() || !Number.isFinite(Number(line.quantity)) || Number(line.quantity) <= 0 || !Number.isFinite(Number(line.unitCost)) || Number(line.unitCost) < 0)) {
      setError("Revise as linhas: descrição obrigatória, quantidade positiva e custo unitário não negativo.");
      return;
    }
    if (pricingMode === "margin" && pricingRate >= 100) { setError("A margem precisa ser inferior a 100%."); return; }
    setSaving(true); setError("");
    try {
      const id = selectedQuote.id + "__" + revisionKey;
      const existing = sheets.find(s => s.id === id);
      await setDoc(doc(db, "internal_quote_costs", id), {
        quoteId: selectedQuote.id,
        quoteNumber: selectedQuote.number || selectedQuote.id,
        clientName: selectedQuote.clientName || "",
        revisionKey,
        approvedSnapshotId: selectedQuote.approvedSnapshotId || null,
        sourceQuoteUpdatedAt: selectedQuote.updatedAt || null,
        lines,
        pricingMode,
        pricingRate: validRate,
        costTotal: Number(costTotal.toFixed(2)),
        suggestedSaleTotal: Number(suggestedSaleTotal.toFixed(2)),
        grossProfit: Number(grossProfit.toFixed(2)),
        effectiveMargin: Number(effectiveMargin.toFixed(4)),
        status: selectedQuote.approvedSnapshotId ? "revision_cost_draft" : "draft",
        createdAt: existing ? existing.updatedAt || serverTimestamp() : serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser.uid,
        updatedByEmail: auth.currentUser.email || ""
      }, { merge: true });
      setNotice("Ficha interna salva. O preço sugerido não altera automaticamente o orçamento enviado ao cliente.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar a ficha interna.");
    } finally { setSaving(false); }
  };

  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2"><LockKeyhole className="text-amber-600" size={20}/><h2 className="text-xl font-bold text-slate-900 dark:text-white">Orçamentos Internos de Custos</h2></div>
        <p className="mt-1 text-sm text-slate-500">Área confidencial. Custos reais, fornecedores, consumo e formação do preço de venda. Não é exibida ao cliente.</p>
      </div>
      <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">Acesso restrito</span>
    </div>

    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Orçamento do cliente vinculado</label>
      <select value={selectedQuoteId} onChange={e => setSelectedQuoteId(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm dark:border-slate-700 dark:bg-slate-800">
        <option value="">Selecione um orçamento</option>
        {quotes.map(q => <option key={q.id} value={q.id}>{q.number || q.id} · {q.clientName || "Cliente"} · {q.status || "rascunho"}</option>)}
      </select>
      {selectedQuote && <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
        <span>Cliente: {selectedQuote.clientName}</span><span>Revisão: {revisionKey.slice(0, 22)}</span><span>Atualizado: {quoteDate(selectedQuote.updatedAt || selectedQuote.createdAt)}</span>
      </div>}
    </div>

    {selectedQuote && <>
      {isStale && <div className="flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle size={18} className="shrink-0"/>A ficha anterior pertence a outra revisão. Os dados antigos não serão sobrescritos; esta revisão precisa de nova apuração de custos.</div>}
      {notice && <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">{notice}</div>}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div><h3 className="font-bold text-slate-900 dark:text-white">Composição do custo real</h3><p className="text-xs text-slate-500">Registre os componentes efetivamente necessários para comprar e fabricar.</p></div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={importQuoteLines} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-700"><Copy size={14}/>Copiar linhas comerciais</button>
            <button type="button" onClick={addLine} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white"><Plus size={14}/>Adicionar custo</button>
          </div>
        </div>
        <div className="space-y-3">
          {lines.map(line => <div key={line.id} className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-800 md:grid-cols-12">
            <div className="md:col-span-2"><label className="mb-1 block text-[11px] text-slate-500">Categoria</label><select value={line.category} onChange={e => updateLine(line.id, { category: e.target.value as CostCategory })} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800">{Object.entries(CATEGORY_LABELS).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></div>
            <div className="md:col-span-3"><label className="mb-1 block text-[11px] text-slate-500">Descrição / componente</label><input value={line.description} onChange={e => updateLine(line.id, { description: e.target.value })} placeholder="Ex.: Perfil montante..." className="w-full rounded-lg border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"/></div>
            <div className="md:col-span-2"><label className="mb-1 block text-[11px] text-slate-500">Fornecedor / código</label><input value={line.supplier || ""} onChange={e => updateLine(line.id, { supplier: e.target.value })} placeholder="Fornecedor" className="mb-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"/><input value={line.code || ""} onChange={e => updateLine(line.id, { code: e.target.value })} placeholder="Código" className="w-full rounded-lg border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"/></div>
            <div className="md:col-span-1"><label className="mb-1 block text-[11px] text-slate-500">Qtd.</label><input type="number" min="0.001" step="0.001" value={line.quantity} onChange={e => updateLine(line.id, { quantity: Number(e.target.value) })} className="w-full rounded-lg border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"/></div>
            <div className="md:col-span-1"><label className="mb-1 block text-[11px] text-slate-500">Unid.</label><input value={line.unit} onChange={e => updateLine(line.id, { unit: e.target.value })} className="w-full rounded-lg border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"/></div>
            <div className="md:col-span-2"><label className="mb-1 block text-[11px] text-slate-500">Custo unitário (R$)</label><input type="number" min="0" step="0.01" value={line.unitCost} onChange={e => updateLine(line.id, { unitCost: Number(e.target.value) })} className="w-full rounded-lg border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"/><div className="mt-1 text-right text-[11px] font-semibold text-slate-600 dark:text-slate-300">{money(line.quantity * line.unitCost)}</div></div>
            <div className="md:col-span-1 flex items-end justify-end"><button type="button" onClick={() => setLines(current => current.filter(x => x.id !== line.id))} aria-label="Remover custo" className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"><Trash2 size={16}/></button></div>
          </div>)}
          {!lines.length && <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Nenhum custo lançado. Adicione componentes ou copie as linhas do orçamento para preencher os custos reais.</div>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 font-bold text-slate-900 dark:text-white">Formação do preço de venda</h3>
          <label className="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">Método de cálculo</label>
          <select value={pricingMode} onChange={e => setPricingMode(e.target.value as "markup" | "margin")} className="mb-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"><option value="markup">Incremento sobre o custo (markup)</option><option value="margin">Margem sobre o preço de venda</option></select>
          <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Percentual (%)</label>
          <input type="number" min="0" max={pricingMode === "margin" ? "99.99" : "1000"} step="0.1" value={pricingRate} onChange={e => setPricingRate(Number(e.target.value))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"/>
          <p className="mt-2 text-xs text-slate-500">{pricingMode === "markup" ? "Preço sugerido = custo total × (1 + incremento)." : "Preço sugerido = custo total ÷ (1 − margem desejada)."}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
          <h3 className="mb-3 flex items-center gap-2 font-bold text-slate-900 dark:text-white"><Calculator size={17}/>Resumo confidencial</h3>
          <div className="space-y-2 text-sm"><div className="flex justify-between"><span className="text-slate-500">Custo real total</span><strong>{money(costTotal)}</strong></div><div className="flex justify-between"><span className="text-slate-500">Preço de venda sugerido</span><strong className="text-blue-700 dark:text-blue-300">{money(suggestedSaleTotal)}</strong></div><div className="flex justify-between"><span className="text-slate-500">Resultado bruto estimado</span><strong>{money(grossProfit)}</strong></div><div className="flex justify-between"><span className="text-slate-500">Margem efetiva</span><strong>{effectiveMargin.toFixed(2).replace(".", ",")}%</strong></div></div>
          <p className="mt-3 text-[11px] text-slate-500">Impostos, despesas administrativas e regras tributárias precisam ser parametrizados pelo responsável contábil; não são presumidos nesta fórmula.</p>
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={saveSheet} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"><Save size={16}/>{saving ? "Salvando..." : "Salvar ficha interna"}</button></div>
    </>}

    {!selectedQuote && !loading && <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-slate-700">Selecione um orçamento para consultar ou registrar seus custos internos.</div>}
    {loading && <p className="text-sm text-slate-500">Carregando orçamentos...</p>}
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    <p className="flex items-center gap-2 text-xs text-slate-500"><LockKeyhole size={14}/>Os dados desta área ficam em uma coleção separada, protegida por regras de acesso financeiro. O documento comercial do cliente não recebe custos, fornecedores ou margens internas.</p>
  </div>;
}
