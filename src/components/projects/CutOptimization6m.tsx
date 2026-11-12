import React, { useEffect, useMemo, useState } from "react";
import { addDoc, collection, onSnapshot } from "firebase/firestore";
import { jsPDF } from "jspdf";
import { auth, db } from "../../firebase";
import { Scissors, Plus, Trash2, Save, Download, PackageOpen, RefreshCw } from "lucide-react";

type CutInput = { id: string; label: string; lengthMm: number; quantity: number };
type CutPiece = { id: string; label: string; lengthMm: number; index: number };
type CutBar = { pieces: CutPiece[]; usedMm: number; leftoverMm: number };
type SavedDrawing = { id: string; title?: string; cuttingPlan?: Array<Record<string, any>>; pieces?: Array<Record<string, any>> };

const STOCK_MM = 6000;
const KERF_MM = 4;
const makeId = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2);

function optimizeCuts(inputs: CutInput[]) {
  const expanded: CutPiece[] = [];
  for (const item of inputs) {
    const length = Math.round(Number(item.lengthMm));
    const quantity = Math.floor(Number(item.quantity));
    if (!Number.isFinite(length) || length <= 0 || length > STOCK_MM || !Number.isFinite(quantity) || quantity < 1 || quantity > 1000) continue;
    for (let index = 1; index <= quantity; index += 1) expanded.push({ id: item.id, label: item.label || "Peça", lengthMm: length, index });
  }
  expanded.sort((a, b) => b.lengthMm - a.lengthMm);
  const bars: CutBar[] = [];
  for (const piece of expanded) {
    let placed = false;
    for (const bar of bars) {
      const kerf = bar.pieces.length ? KERF_MM : 0;
      if (bar.usedMm + kerf + piece.lengthMm <= STOCK_MM) {
        bar.usedMm += kerf + piece.lengthMm;
        bar.pieces.push(piece);
        placed = true;
        break;
      }
    }
    if (!placed) bars.push({ pieces: [piece], usedMm: piece.lengthMm, leftoverMm: 0 });
  }
  bars.forEach(bar => { bar.leftoverMm = STOCK_MM - bar.usedMm; });
  return { bars, expanded, invalid: inputs.filter(item => Number(item.lengthMm) > STOCK_MM || Number(item.lengthMm) <= 0) };
}

export default function CutOptimization6m() {
  const [inputs, setInputs] = useState<CutInput[]>([{ id: makeId(), label: "Montante", lengthMm: 1200, quantity: 2 }]);
  const [drawings, setDrawings] = useState<SavedDrawing[]>([]);
  const [drawingId, setDrawingId] = useState("");
  const [orderReference, setOrderReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => onSnapshot(collection(db, "technical_drawings"), snap => {
    setDrawings(snap.docs.map(d => ({ id: d.id, ...d.data() } as SavedDrawing)));
  }, e => setError("Não foi possível carregar os desenhos salvos: " + e.message)), []);

  const result = useMemo(() => optimizeCuts(inputs), [inputs]);
  const totalLinearMm = result.expanded.reduce((sum, piece) => sum + piece.lengthMm, 0);
  const totalWasteMm = result.bars.reduce((sum, bar) => sum + bar.leftoverMm, 0);
  const yieldRate = result.bars.length ? (totalLinearMm / (result.bars.length * STOCK_MM)) * 100 : 0;

  const updateInput = (id: string, patch: Partial<CutInput>) => setInputs(current => current.map(item => item.id === id ? { ...item, ...patch } : item));
  const addInput = () => setInputs(current => [...current, { id: makeId(), label: "Nova peça", lengthMm: 1000, quantity: 1 }]);
  const importDrawing = () => {
    const drawing = drawings.find(item => item.id === drawingId);
    if (!drawing) return;
    const source = Array.isArray(drawing.cuttingPlan) && drawing.cuttingPlan.length ? drawing.cuttingPlan : drawing.pieces || [];
    const imported = source.map((piece, index) => {
      const dimensions = piece.dimensions || {};
      const length = Number(piece.length || piece.lengthMm || dimensions.width || piece.width || dimensions.height || piece.height || 0);
      return { id: makeId(), label: String(piece.name || piece.description || "Peça " + (index + 1)), lengthMm: Math.round(length), quantity: Math.max(1, Math.floor(Number(piece.quantity || 1))) };
    }).filter(item => item.lengthMm > 0);
    if (!imported.length) { setError("O desenho selecionado não possui comprimentos de corte utilizáveis."); return; }
    setInputs(imported); setNotice(imported.length + " linhas importadas do desenho técnico."); setError("");
  };
  const savePlan = async () => {
    if (!result.expanded.length) { setError("Adicione pelo menos uma medida de corte válida."); return; }
    setSaving(true); setError(""); setNotice("");
    try {
      await addDoc(collection(db, "cut_plans"), {
        title: "Plano de Corte 6m" + (orderReference.trim() ? " · " + orderReference.trim() : ""),
        orderReference: orderReference.trim(), sourceDrawingId: drawingId || null,
        stockLengthMm: STOCK_MM, kerfMm: KERF_MM, algorithm: "FIRST_FIT_DECREASING",
        inputs, bars: result.bars, barsToBuy: result.bars.length,
        totalLinearMm, totalWasteMm, yieldRate: Number(yieldRate.toFixed(2)),
        createdAt: new Date().toISOString(), createdBy: auth.currentUser?.uid || ""
      });
      setNotice("Plano de corte salvo em Projetos e Ordens de Produção.");
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar o plano."); }
    finally { setSaving(false); }
  };
  const exportPdf = () => {
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    pdf.setFontSize(18); pdf.text("ANACLETO ESQUADRIAS · PLANO DE CORTE 6.000 mm", 14, 16);
    pdf.setFontSize(10); pdf.text("Referência: " + (orderReference || "Não informada") + " · Disco: " + KERF_MM + " mm · Algoritmo: First-Fit Decreasing", 14, 23);
    pdf.text("Barras a comprar: " + result.bars.length + " · Comprimento total: " + totalLinearMm + " mm · Sobra total: " + totalWasteMm + " mm · Aproveitamento: " + yieldRate.toFixed(1) + "%", 14, 30);
    let y = 42;
    result.bars.forEach((bar, index) => {
      if (y > 175) { pdf.addPage(); y = 18; }
      pdf.setFontSize(11); pdf.text("Barra " + (index + 1) + " · Utilizado " + bar.usedMm + " mm · Retalho " + bar.leftoverMm + " mm", 14, y);
      y += 7; pdf.setFontSize(9);
      bar.pieces.forEach(piece => { pdf.text("• " + piece.label + " — " + piece.lengthMm + " mm", 20, y); y += 5; });
      y += 4;
    });
    pdf.save("anacleto-plano-corte-6m.pdf");
  };

  return <section className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-xs font-bold uppercase tracking-wider text-blue-600">OTIMIZAÇÃO LINEAR</p><h2 className="text-xl font-black">Plano de Corte & Otimização (6m)</h2><p className="text-sm text-slate-500">Barras de 6.000 mm · First-Fit Decreasing · disco de 4 mm por separação.</p></div>
      <div className="flex flex-wrap gap-2"><button onClick={exportPdf} disabled={!result.bars.length} className="rounded-lg border px-3 py-2 text-sm font-bold disabled:opacity-40"><Download className="mr-1 inline h-4 w-4"/>PDF oficina</button><button onClick={() => void savePlan()} disabled={saving || !result.bars.length} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-40"><Save className="mr-1 inline h-4 w-4"/>{saving ? "Salvando..." : "Salvar plano"}</button></div>
    </div>
    <div className="grid gap-3 sm:grid-cols-4">
      {[["Barras a comprar",result.bars.length],["Peças",result.expanded.length],["Sobra total",totalWasteMm.toLocaleString("pt-BR")+" mm"],["Aproveitamento",yieldRate.toFixed(1)+"%"]].map(([label,value])=><div key={String(label)} className="rounded-xl border bg-white p-3 dark:bg-slate-900"><p className="text-xs text-slate-500">{label}</p><p className="text-xl font-black">{value}</p></div>)}
    </div>
    <div className="grid gap-3 md:grid-cols-3">
      <label className="text-xs font-semibold text-slate-500">Importar de desenho salvo<select value={drawingId} onChange={e=>setDrawingId(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm text-slate-900"><option value="">Selecionar desenho técnico</option>{drawings.map(d=><option key={d.id} value={d.id}>{d.title || d.id}</option>)}</select></label>
      <div className="flex items-end"><button onClick={importDrawing} disabled={!drawingId} className="rounded-lg border px-3 py-2.5 text-sm font-bold disabled:opacity-40"><RefreshCw className="mr-1 inline h-4 w-4"/>Importar peças</button></div>
      <label className="text-xs font-semibold text-slate-500">Ordem / referência<input value={orderReference} onChange={e=>setOrderReference(e.target.value)} placeholder="OP-2026-0001" className="mt-1 w-full rounded-lg border p-2.5 text-sm text-slate-900"/></label>
    </div>
    <div className="overflow-hidden rounded-xl border bg-white dark:bg-slate-900">
      <div className="flex items-center justify-between border-b p-3 dark:border-slate-800"><h3 className="font-bold">Lista de cortes (mm)</h3><button onClick={addInput} className="rounded-lg border px-3 py-1.5 text-xs font-bold"><Plus className="mr-1 inline h-3 w-3"/>Adicionar peça</button></div>
      <div className="space-y-2 p-3">{inputs.map(item=><div key={item.id} className="grid grid-cols-[1fr_110px_90px_36px] gap-2"><input value={item.label} onChange={e=>updateInput(item.id,{label:e.target.value})} aria-label="Descrição da peça" className="min-w-0 rounded-lg border p-2 text-sm text-slate-900"/><input type="number" min="1" max={STOCK_MM} value={item.lengthMm} onChange={e=>updateInput(item.id,{lengthMm:Number(e.target.value)})} aria-label="Comprimento em milímetros" className="rounded-lg border p-2 text-sm text-slate-900"/><input type="number" min="1" max="1000" value={item.quantity} onChange={e=>updateInput(item.id,{quantity:Number(e.target.value)})} aria-label="Quantidade" className="rounded-lg border p-2 text-sm text-slate-900"/><button onClick={()=>setInputs(current=>current.filter(row=>row.id!==item.id))} aria-label="Remover peça" className="text-rose-600"><Trash2 className="h-4 w-4"/></button></div>)}</div>
    </div>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
    {result.invalid.length > 0 && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Existem medidas inválidas ou maiores que 6.000 mm. Corrija antes de liberar o plano.</p>}
    <div className="space-y-3">{result.bars.map((bar,index)=><article key={index} className="rounded-xl border bg-white p-3 dark:bg-slate-900"><div className="mb-2 flex flex-wrap justify-between gap-2 text-sm"><strong>Barra {index+1}</strong><span className="text-slate-500">Usado {bar.usedMm} mm · Retalho {bar.leftoverMm} mm</span></div><div className="flex h-10 overflow-hidden rounded-md border bg-slate-100 dark:bg-slate-800">{bar.pieces.map((piece,i)=><div key={i} title={piece.label+" · "+piece.lengthMm+" mm"} style={{width:(piece.lengthMm/STOCK_MM*100)+"%"}} className="flex min-w-0 items-center justify-center border-r border-white/70 bg-blue-500 px-1 text-[9px] font-bold text-white">{piece.lengthMm}</div>)}<div style={{width:(bar.leftoverMm/STOCK_MM*100)+"%"}} className="flex items-center justify-center bg-amber-100 text-[9px] font-bold text-amber-900">{bar.leftoverMm>0?bar.leftoverMm+" mm":""}</div></div><p className="mt-2 text-xs text-slate-500">{bar.pieces.map(piece=>piece.label+" ("+piece.lengthMm+" mm)").join(" · ")}</p></article>)}</div>
    {!result.bars.length && <div className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500"><PackageOpen className="mx-auto mb-2 h-8 w-8"/>Adicione cortes ou importe as peças de um desenho técnico.</div>}
  </section>;
}
