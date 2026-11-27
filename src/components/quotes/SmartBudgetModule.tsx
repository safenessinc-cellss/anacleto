import React, { useEffect, useMemo, useState } from "react";
import { addDoc, collection, doc, getDoc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { Sparkles, Trash2, Save, FileText, Loader2 } from "lucide-react";
import { auth, db } from "../../firebase";
import { useToast } from "../ToastContext";

type Item = { id: string; description: string; quantity: number; quantityPending?: boolean; unitPrice: number; sku?: string; catalogItemId?: string; supplier?: string; category?: string; priceSource?: "catalog" | "manual" | "pending" | string; notes?: string };
type Saved = { id: string; clientName: string; request?: string; language?: string; productType?: string; items: Item[]; subtotal?: number; laborPercent?: number; laborAmount?: number; total: number; status: string };

const PRODUCT_TYPE_GROUPS = [
  { label: "Janelas", options: ["Janela de correr", "Janela de abrir", "Janela basculante", "Janela maxim-ar", "Janela guilhotina", "Janela pivotante", "Janela fixa", "Janela camarão", "Janela integrada com persiana"] },
  { label: "Portas", options: ["Porta de correr", "Porta de abrir", "Porta pivotante", "Porta camarão", "Porta sanfonada", "Porta balcão", "Porta veneziana", "Porta com vidro"] },
  { label: "Banheiros", options: ["Box de banheiro frontal", "Box de banheiro de canto", "Box de banheiro articulado", "Box de banheiro até o teto", "Espelho com estrutura de alumínio"] },
  { label: "Fachadas e divisórias", options: ["Fachada de vidro", "Pele de vidro", "Fachada glazing", "Divisória de ambiente", "Fechamento de varanda", "Envidraçamento de sacada", "Vitrine comercial"] },
  { label: "Estruturas e áreas externas", options: ["Guarda-corpo", "Corrimão", "Cobertura de vidro", "Pergolado de alumínio", "Portão de alumínio", "Grade de alumínio", "Cerca de alumínio"] },
  { label: "Complementos", options: ["Tela mosquiteira", "Persiana integrada", "Brise", "Painel ripado de alumínio", " Veneziana fixa", "Estrutura especial sob medida"] },
] as const;

export default function SmartBudgetModule({ initialBudgetId, hideHistory = false }: { initialBudgetId?: string; hideHistory?: boolean }) {
  const { showToast } = useToast();
  const [client, setClient] = useState("");
  const [request, setRequest] = useState("");
  const [language, setLanguage] = useState("pt");
  const [productType, setProductType] = useState("Outro / sob medida");
  const [items, setItems] = useState<Item[]>([]);
  const [history, setHistory] = useState<Saved[]>([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [laborPercent, setLaborPercent] = useState(100);
  const [pendingQuestions, setPendingQuestions] = useState<string[]>([]);
  const [visitRequired, setVisitRequired] = useState(false);
  const [visitReason, setVisitReason] = useState("");

  useEffect(() => onSnapshot(query(collection(db, "smart_budgets"), orderBy("createdAt", "desc"), limit(200)), (snap) => setHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Saved))), (e) => setError("Não foi possível carregar o histórico: " + e.message)), []);
  useEffect(() => {
    if (!initialBudgetId) return;
    let active = true;
    void getDoc(doc(db, "smart_budgets", initialBudgetId)).then((snap) => {
      if (!active || !snap.exists()) return;
      const data = snap.data() as any;
      setClient(data.clientName || "");
      setRequest(data.request || "");
      setLanguage(data.language || "pt");
      setProductType(data.productType || "Outro / sob medida");
      setItems(Array.isArray(data.items) ? data.items : []);
      setPendingQuestions(Array.isArray(data.pendingQuestions) ? data.pendingQuestions.map((q: unknown) => String(q)) : []);
      setVisitRequired(data.visitRequired === true);
      setVisitReason(String(data.visitReason || ""));
      setLaborPercent(Number.isFinite(Number(data.laborPercent ?? data.labor?.percentage)) ? Number(data.laborPercent ?? data.labor?.percentage) : 100);
      setEditingId(snap.id);
      setError("");
    }).catch((e) => { if (active) setError("Não foi possível abrir o orçamento inteligente: " + e.message); });
    return () => { active = false; };
  }, [initialBudgetId]);

  const confirmedSubtotal = useMemo(() => items.reduce((sum, item) => sum + (item.priceSource === "catalog" ? Math.max(0, item.quantity) * Math.max(0, item.unitPrice) : 0), 0), [items]);
  const estimatedSubtotal = useMemo(() => items.reduce((sum, item) => sum + (item.priceSource === "manual" ? Math.max(0, item.quantity) * Math.max(0, item.unitPrice) : 0), 0), [items]);
  const subtotal = confirmedSubtotal;
  const pricingBase = confirmedSubtotal + estimatedSubtotal;
  const laborAmount = useMemo(() => pricingBase * Math.max(0, Math.min(300, laborPercent)) / 100, [pricingBase, laborPercent]);
  const total = pricingBase + laborAmount;
  const pendingPriceCount = items.filter((item) => item.priceSource !== "catalog").length;
  const unpricedCount = items.filter((item) => item.priceSource === "pending" || item.unitPrice <= 0).length;
  const pendingQuantityCount = items.filter((item) => item.quantityPending || !(item.quantity > 0)).length;
  const provisional = pendingPriceCount > 0 || pendingQuantityCount > 0 || pendingQuestions.length > 0 || visitRequired;
  const generate = async () => {
    if (busy) return;
    if (!request.trim()) { setError("Descreva o pedido do cliente."); return; }
    setBusy(true); setError("");
    try {
      const user = auth.currentUser;
      if (!user) throw Error("Entre na sua conta.");
      const requestId = crypto.randomUUID();
      const response = await fetch("/api/ai/budget-items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + await user.getIdToken(),
          "X-Request-ID": requestId,
        },
        body: JSON.stringify({ prompt: `Tipo de produto: ${productType}. ${request}`, productType, language }),
        signal: AbortSignal.timeout(55_000),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw Error(data?.error || "Falha ao gerar com IA.");
      if (!Array.isArray(data?.items) || !data.items.length) throw Error("A IA não retornou itens válidos.");
      const next = data.items.map((x: any) => ({ id: crypto.randomUUID(), description: String(x.description || ""), quantity: Number(x.qty) >= 0 ? Number(x.qty) : 0, quantityPending: !(Number(x.qty) > 0), unitPrice: x.priceSource === "catalog" && Number.isFinite(Number(x.price)) && Number(x.price) > 0 ? Number(x.price) : 0, sku: String(x.sku || ""), catalogItemId: String(x.catalogItemId || ""), supplier: String(x.supplier || ""), category: String(x.category || ""), priceSource: x.priceSource === "catalog" && Number(x.price) > 0 ? "catalog" : "pending", notes: String(x.notes || "") }));
      if (next.some((x: Item) => !x.description || !Number.isFinite(x.quantity) || x.quantity < 0)) throw Error("A IA retornou dados inválidos.");
      setItems(next);
      setPendingQuestions(Array.isArray(data.pendingQuestions) ? data.pendingQuestions.map((q: unknown) => String(q)).filter(Boolean).slice(0, 20) : []);
      setVisitRequired(data.visitRequired === true);
      setVisitReason(String(data.visitReason || ""));
      showToast("Rascunho gerado. Revise os itens, estimativas e perguntas pendentes.", "success");
    } catch (e) {
      const message = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")
        ? "A geração excedeu o tempo limite. O servidor não confirmou o resultado; tente novamente em instantes."
        : e instanceof Error ? e.message : "Erro ao gerar orçamento.";
      setError(message);
    } finally { setBusy(false); }
  };
  const save = async () => {
    if (!client.trim() || !items.length) { setError("Informe o cliente e mantenha ao menos um item."); return; }
    setSaving(true);
    try {
      const user = auth.currentUser;
      if (!user) throw Error("Sessão expirada.");
      const payload = { clientName: client.trim(), request, language, productType, items, subtotal, confirmedSubtotal, estimatedSubtotal, pendingQuestions, visitRequired, visitReason, laborPercent, laborAmount, labor: { description: "Mão de obra", percentage: laborPercent, basis: "materials", amount: laborAmount }, total, currency: "BRL", status: "draft", pricingStatus: provisional ? "provisional" : "confirmed", workflow: "smart_ai", updatedAt: serverTimestamp() };
      if (editingId) await updateDoc(doc(db, "smart_budgets", editingId), payload);
      else await addDoc(collection(db, "smart_budgets"), { ...payload, createdBy: user.uid, createdAt: serverTimestamp() });
      setEditingId(null); setItems([]); setRequest(""); setClient(""); setLaborPercent(100); setPendingQuestions([]); setVisitRequired(false); setVisitReason("");
      showToast(editingId ? "Orçamento inteligente atualizado." : "Orçamento inteligente salvo.", "success");
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao salvar."); }
    finally { setSaving(false); }
  };
  const patch = (id: string, value: Partial<Item>) => setItems((current) => current.map((item) => item.id === id ? { ...item, ...value } : item));

  return <main className="mx-auto max-w-6xl space-y-6">
    <header className="rounded-2xl border bg-white p-6 shadow-sm dark:bg-slate-900"><div className="flex items-center gap-3"><Sparkles className="h-7 w-7 text-violet-700"/><div><h1 className="text-xl font-bold">Orçamento Inteligente</h1><p className="text-sm text-slate-500">Descreva o pedido; revise os componentes e os preços sugeridos antes de enviar.</p></div></div></header>
    <section className="space-y-4 rounded-2xl border bg-white p-5 dark:bg-slate-900"><div className="flex items-center justify-between"><h2 className="font-bold">Solicitação do cliente</h2>{editingId && <span className="text-xs font-semibold text-blue-700">Editando orçamento salvo</span>}</div><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Cliente<input value={client} onChange={(e)=>setClient(e.target.value)} className="mt-1 w-full rounded-lg border p-2 dark:bg-slate-950" placeholder="Nome do cliente"/></label><label className="text-sm">Idioma<select value={language} onChange={(e)=>setLanguage(e.target.value)} className="mt-1 w-full rounded-lg border p-2 dark:bg-slate-950"><option value="pt">Português</option><option value="es">Español</option><option value="en">English</option></select></label></div><label className="block text-sm">Tipo de produto a fabricar<select value={productType} onChange={(e)=>setProductType(e.target.value)} className="mt-1 w-full rounded-lg border p-2 dark:bg-slate-950"><option>Outro / sob medida</option>{PRODUCT_TYPE_GROUPS.map((group)=><optgroup key={group.label} label={group.label}>{group.options.map((option)=><option key={option}>{option}</option>)}</optgroup>)}</select><span className="mt-1 block text-xs text-slate-500">Escolha a tipologia principal. Para pedidos com vários produtos, detalhe cada um na descrição.</span></label><label className="block text-sm">Detalhes do pedido<textarea rows={6} value={request} onChange={(e)=>setRequest(e.target.value)} className="mt-1 w-full rounded-lg border p-3 dark:bg-slate-950" placeholder="Descreva medidas, materiais, acabamento, quantidades e serviços solicitados."/></label><button onClick={generate} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-violet-700 px-4 py-2.5 font-bold text-white disabled:opacity-50">{busy?<Loader2 className="h-4 w-4 animate-spin"/>:<Sparkles className="h-4 w-4"/>}{busy?"Gerando...":"Gerar rascunho com IA"}</button><p className="text-xs text-slate-500">Preços confirmados vêm do catálogo validado. Valores digitados manualmente são estimativas, nunca confirmação de fornecedor.</p>
      {(pendingQuestions.length > 0 || visitRequired) && <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <h3 className="font-bold">Pendências para fechar o orçamento</h3>
        {visitRequired && <p className="mt-2"><b>Visita técnica pendente.</b> {visitReason || "É necessária avaliação ou medição no local antes da proposta definitiva."}</p>}
        {pendingQuestions.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5">{pendingQuestions.map((question,index)=><li key={index}>{question}</li>)}</ul>}
      </section>}
      {error&&<p role="alert" className="text-sm text-rose-600">{error}</p>}</section>
    {items.length>0&&<section className="space-y-4 rounded-2xl border bg-white p-5 dark:bg-slate-900"><div className="flex justify-between"><h2 className="font-bold">Revisão do rascunho · {items.length} itens</h2><b>{total.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</b></div>{items.map((item)=><div key={item.id} className="grid gap-2 border-t pt-3 sm:grid-cols-[1fr_100px_140px_auto]"><label className="text-xs">Descrição<input value={item.description} onChange={(e)=>patch(item.id,{description:e.target.value})} className="mt-1 w-full rounded border p-2 text-sm dark:bg-slate-950"/></label><label className="text-xs">Quantidade<input type="number" min="0" step="0.01" value={item.quantityPending && item.quantity===0 ? "" : item.quantity} placeholder={item.quantityPending ? "Pendente" : "Quantidade"} onChange={(e)=>{const value=e.target.value;patch(item.id,{quantity:value===""?0:Number(value),quantityPending:value===""||!(Number(value)>0)})}} className="mt-1 w-full rounded border p-2 text-sm dark:bg-slate-950"/></label><label className="text-xs">Preço unitário<input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(e)=>patch(item.id,{unitPrice:Number(e.target.value),priceSource:Number(e.target.value)>0?"manual":"pending"})} className="mt-1 w-full rounded border p-2 text-sm dark:bg-slate-950"/></label><button onClick={()=>setItems((current)=>current.filter((x)=>x.id!==item.id))} aria-label="Remover item" className="self-end rounded border p-2 text-rose-600"><Trash2 className="h-4 w-4"/></button><p className="sm:col-span-4 text-xs text-amber-700">{item.quantityPending?"Quantidade pendente de medição · ":""}{item.priceSource==="catalog"?"Preço confirmado no catálogo":item.priceSource==="manual"?"Preço estimado informado manualmente":"Preço pendente de confirmação"} {item.notes}</p></div>)}<div className="flex flex-wrap items-end justify-between gap-3 border-t pt-3"><div><label className="block text-xs font-semibold">Mão de obra (% sobre materiais)<input type="number" min="0" max="300" step="1" value={laborPercent} onChange={(e)=>setLaborPercent(Math.max(0,Math.min(300,Number(e.target.value)||0)))} className="mt-1 w-36 rounded border p-2 text-sm dark:bg-slate-950"/></label><p className="mt-1 text-xs text-slate-500">Mão de obra: {laborAmount.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</p></div><div className="text-right text-sm"><p>Materiais confirmados: {confirmedSubtotal.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</p>{estimatedSubtotal>0&&<p>Materiais estimados: {estimatedSubtotal.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</p>}<p>Mão de obra calculada sobre valores confirmados e estimados: {laborAmount.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</p><p className="mt-1 text-base font-bold">{provisional?"Total preliminar":"Total confirmado"}: {total.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</p>{unpricedCount>0&&<p className="mt-1 text-xs text-amber-700">{unpricedCount} item(ns) sem preço; não incluídos no total preliminar.</p>}{pendingPriceCount>0&&<p className="mt-1 text-xs text-amber-700">{pendingPriceCount} item(ns) ainda não têm preço confirmado.</p>}{pendingQuantityCount>0&&<p className="mt-1 text-xs text-amber-700">{pendingQuantityCount} item(ns) aguardam medição/quantidade; não entram no cálculo.</p>}</div></div><button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 font-bold text-white"><Save className="h-4 w-4"/>{saving?"Salvando...":editingId?"Atualizar orçamento":"Salvar orçamento inteligente"}</button></section>}
    {!hideHistory&&<section className="rounded-2xl border bg-white p-5 dark:bg-slate-900"><h2 className="mb-3 flex items-center gap-2 font-bold"><FileText className="h-5 w-5"/>Histórico de Orçamentos Inteligentes</h2><p className="mb-3 text-xs text-slate-500">Exibindo os 200 orçamentos mais recentes.</p>{!history.length?<p className="text-sm text-slate-500">Nenhum orçamento inteligente salvo.</p>:history.map((item)=><div key={item.id} className="flex justify-between gap-3 border-t py-3 text-sm"><div><b>{item.clientName||"Cliente não informado"}</b><p className="text-xs text-slate-500">{item.items?.length||0} itens · {item.status}</p></div><b>{Number(item.total||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</b></div>)}</section>}
  </main>;
}
