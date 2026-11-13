import React, { useMemo, useState } from "react";
import { Calculator, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";

type CatalogProfile = { id: string; name?: string; description?: string; sku?: string; code?: string; source?: string };
type CutRow = { id: string; profileId: string; lengthMm: number; quantity: number };

function weightPerMeter(profile: CatalogProfile): number | undefined {
  const text = `${profile.name || ""} ${profile.description || ""}`;
  const match = text.match(/(?:\(|\b)(\d+(?:[.,]\d+)?)\s*kg\s*\/\s*m\b/i);
  if (!match) return undefined;
  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}
function round50(value: number) { return Math.ceil(Math.max(0, value) / 50) * 50; }
function money(value: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0); }

export default function OptionalAluminumCostCalculator({
  catalogItems, onApply, disabled = false,
}: {
  catalogItems: CatalogProfile[];
  onApply: (price: number, notes: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [finish, setFinish] = useState("Natural / Bruto");
  const [method, setMethod] = useState<"retalho" | "barra">("retalho");
  const [priceKg, setPriceKg] = useState("");
  const [actualScale, setActualScale] = useState(false);
  const [cuts, setCuts] = useState<CutRow[]>([]);
  const [glassWidth, setGlassWidth] = useState("");
  const [glassHeight, setGlassHeight] = useState("");
  const [glassQty, setGlassQty] = useState("1");
  const [glassPrice, setGlassPrice] = useState("");
  const [components, setComponents] = useState("");
  const [hours, setHours] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [markup, setMarkup] = useState("2.10");

  const profiles = useMemo(() => catalogItems.map(profile => ({ ...profile, kgm: weightPerMeter(profile) })).filter(profile => profile.kgm), [catalogItems]);
  const calc = useMemo(() => {
    const pricePerKg = Math.max(0, Number(priceKg) || 0);
    const expanded = cuts.flatMap(cut => {
      const profile = profiles.find(item => item.id === cut.profileId);
      if (!profile || !profile.kgm || cut.lengthMm <= 0 || cut.quantity <= 0) return [];
      return Array.from({ length: Math.min(1000, Math.floor(cut.quantity)) }, () => ({ profileId: profile.id, sku: profile.sku || profile.code || profile.id, name: profile.name || profile.description || profile.id, lengthMm: Math.ceil(cut.lengthMm), kgm: profile.kgm as number }));
    });
    let aluminumKg = 0;
    let bars = 0;
    if (method === "barra") {
      const groups = new Map<string, typeof expanded>();
      expanded.forEach(piece => groups.set(piece.profileId, [...(groups.get(piece.profileId) || []), piece]));
      for (const pieces of groups.values()) {
        const bins: number[] = [];
        pieces.sort((a,b) => b.lengthMm - a.lengthMm).forEach(piece => {
          const required = piece.lengthMm + 4;
          const index = bins.findIndex(remaining => remaining >= required);
          if (index >= 0) bins[index] -= required;
          else bins.push(6000 - required);
        });
        bars += bins.length;
        aluminumKg += bins.length * 6 * (pieces[0]?.kgm || 0);
      }
      if (actualScale) aluminumKg *= 1.05;
    } else {
      aluminumKg = expanded.reduce((sum, piece) => sum + piece.lengthMm / 1000 * piece.kgm, 0) * 1.12;
    }
    const aluminumCost = aluminumKg * pricePerKg;
    const width = round50(Number(glassWidth) || 0);
    const height = round50(Number(glassHeight) || 0);
    const quantity = Math.max(0, Math.floor(Number(glassQty) || 0));
    const areaPerSheet = width > 0 && height > 0 ? Math.max(0.25, width * height / 1000000) : 0;
    const glassArea = areaPerSheet * quantity;
    const glassCost = glassArea * Math.max(0, Number(glassPrice) || 0);
    const componentCost = Math.max(0, Number(components) || 0);
    const laborCost = Math.max(0, Number(hours) || 0) * Math.max(0, Number(hourlyRate) || 0);
    const direct = aluminumCost + glassCost + componentCost + laborCost;
    const factor = Math.max(1, Number(markup) || 1);
    return { aluminumKg, bars, aluminumCost, glassArea, glassCost, componentCost, laborCost, direct, factor, sale: direct * factor, margin: direct * factor - direct, pieces: expanded.length, width, height };
  }, [cuts, profiles, method, actualScale, priceKg, glassWidth, glassHeight, glassQty, glassPrice, components, hours, hourlyRate, markup]);

  const addCut = () => setCuts(rows => [...rows, { id: crypto.randomUUID(), profileId: profiles[0]?.id || "", lengthMm: 1000, quantity: 1 }]);
  const updateCut = (id: string, patch: Partial<CutRow>) => setCuts(rows => rows.map(row => row.id === id ? { ...row, ...patch } : row));

  return (
    <section className="mt-5 rounded-2xl border border-indigo-300/30 bg-indigo-500/5 p-4 text-slate-100">
      <button type="button" disabled={disabled} onClick={() => setOpen(value => !value)} className="flex w-full items-center justify-between gap-3 text-left disabled:opacity-50">
        <span className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-indigo-200"><Calculator className="h-4 w-4"/> Cálculo técnico de custos (opcional)</span>
        {open ? <ChevronUp className="h-4 w-4"/> : <ChevronDown className="h-4 w-4"/>}
      </button>
      {!open ? <p className="mt-2 text-[11px] text-slate-400">Ative somente quando quiser detalhar perfis, vidro, componentes, mão de obra e margem. O orçamento comum continua funcionando normalmente.</p> : (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-[11px] text-slate-300">Acabamento<select value={finish} onChange={e=>setFinish(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs text-white"><option>Natural / Bruto</option><option>Anodizado</option><option>Pintura eletrostática branca</option><option>Pintura eletrostática preta</option><option>Pintura eletrostática bronze</option></select></label>
            <label className="text-[11px] text-slate-300">Preço do alumínio (R$/kg)<input type="number" min="0" step="0.01" value={priceKg} onChange={e=>setPriceKg(e.target.value)} placeholder="Informe o preço" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs text-white"/></label>
            <label className="text-[11px] text-slate-300">Método de compra<select value={method} onChange={e=>setMethod(e.target.value as "retalho"|"barra")} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs text-white"><option value="retalho">Peso consumido + 12% retalho</option><option value="barra">Barras fechadas de 6.000 mm</option></select></label>
          </div>
          {method === "barra" && <label className="flex items-center gap-2 text-[11px] text-slate-300"><input type="checkbox" checked={actualScale} onChange={e=>setActualScale(e.target.checked)}/> Fornecedor cobra peso real na balança (+5% de tolerância)</label>}
          <div className="rounded-xl border border-slate-700 p-3">
            <div className="mb-2 flex items-center justify-between"><strong className="text-xs">Lista de corte de perfis</strong><button type="button" onClick={addCut} disabled={!profiles.length} className="flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-[10px] font-bold disabled:opacity-40"><Plus className="h-3 w-3"/> Adicionar perfil</button></div>
            {!profiles.length && <p className="text-[11px] text-amber-300">Cadastre no catálogo o peso linear no formato “0,850 kg/m” na descrição do perfil para habilitá-lo aqui.</p>}
            {cuts.map(row=><div key={row.id} className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_100px_75px_30px]">
              <select value={row.profileId} onChange={e=>updateCut(row.id,{profileId:e.target.value})} className="min-w-0 rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs text-white">{profiles.map(p=><option key={p.id} value={p.id}>{p.sku || p.code || p.id} · {p.name || p.description} · {p.kgm} kg/m</option>)}</select>
              <input aria-label="Comprimento de corte em milímetros" type="number" min="1" value={row.lengthMm} onChange={e=>updateCut(row.id,{lengthMm:Number(e.target.value)})} className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs text-white" placeholder="mm"/>
              <input aria-label="Quantidade de cortes" type="number" min="1" value={row.quantity} onChange={e=>updateCut(row.id,{quantity:Number(e.target.value)})} className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs text-white"/>
              <button type="button" aria-label="Remover corte" onClick={()=>setCuts(rows=>rows.filter(item=>item.id!==row.id))} className="text-rose-300"><Trash2 className="h-4 w-4"/></button>
            </div>)}
            <p className="mt-2 text-[10px] text-slate-400">Plano de barras por algoritmo First-Fit Decreasing, agrupado por perfil, com 4 mm por corte. Resultado estimado; confirme o plano de fábrica antes da compra.</p>
          </div>
          <div className="rounded-xl border border-slate-700 p-3">
            <strong className="text-xs">Vidro (cobrança comercial)</strong>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <label className="text-[10px] text-slate-300">Largura (mm)<input type="number" min="1" value={glassWidth} onChange={e=>setGlassWidth(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs text-white"/></label>
              <label className="text-[10px] text-slate-300">Altura (mm)<input type="number" min="1" value={glassHeight} onChange={e=>setGlassHeight(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs text-white"/></label>
              <label className="text-[10px] text-slate-300">Folhas / chapas<input type="number" min="1" value={glassQty} onChange={e=>setGlassQty(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs text-white"/></label>
              <label className="text-[10px] text-slate-300">Preço (R$/m²)<input type="number" min="0" step="0.01" value={glassPrice} onChange={e=>setGlassPrice(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs text-white"/></label>
            </div>
            <p className="mt-2 text-[10px] text-slate-400">Cada dimensão é arredondada para cima a cada 50 mm; área mínima faturável de 0,25 m² por chapa.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-[10px] text-slate-300">Componentes / ferragens (R$)<input type="number" min="0" step="0.01" value={components} onChange={e=>setComponents(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs text-white"/></label>
            <label className="text-[10px] text-slate-300">Horas de mão de obra<input type="number" min="0" step="0.25" value={hours} onChange={e=>setHours(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs text-white"/></label>
            <label className="text-[10px] text-slate-300">Custo por hora (R$)<input type="number" min="0" step="0.01" value={hourlyRate} onChange={e=>setHourlyRate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs text-white"/></label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-[10px] text-slate-300">Fator de venda (markup)<input type="number" min="1" step="0.01" value={markup} onChange={e=>setMarkup(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs text-white"/></label>
            <div className="text-[10px] text-slate-400">Acabamento selecionado: <strong>{finish}</strong>. Informe valores reais de fornecedores; campos vazios são considerados zero e não são inventados.</div>
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-950 p-3 text-[11px] sm:grid-cols-4">
            <div><span className="text-slate-500">Alumínio</span><strong className="block">{money(calc.aluminumCost)} · {calc.aluminumKg.toFixed(3)} kg</strong></div>
            <div><span className="text-slate-500">Vidro</span><strong className="block">{money(calc.glassCost)} · {calc.glassArea.toFixed(3)} m²</strong></div>
            <div><span className="text-slate-500">Componentes + mão de obra</span><strong className="block">{money(calc.componentCost + calc.laborCost)}</strong></div>
            <div><span className="text-slate-500">Barras estimadas</span><strong className="block">{method === "barra" ? calc.bars : "—"}</strong></div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-700 pt-3">
            <div><p className="text-[10px] text-slate-400">Custo direto: {money(calc.direct)} · Margem bruta: {money(calc.margin)}</p><p className="text-lg font-black text-emerald-300">Preço de venda: {money(calc.sale)}</p></div>
            <button type="button" disabled={disabled || calc.direct <= 0 || !Number.isFinite(calc.sale)} onClick={()=>onApply(Number(calc.sale.toFixed(2)), `Cálculo técnico opcional · acabamento: ${finish}; método: ${method === "barra" ? "barras 6m" : "peso consumido +12%"}; alumínio: ${calc.aluminumKg.toFixed(3)} kg / ${money(calc.aluminumCost)}; vidro: ${calc.glassArea.toFixed(3)} m² / ${money(calc.glassCost)}; componentes: ${money(calc.componentCost)}; mão de obra: ${money(calc.laborCost)}; custo direto: ${money(calc.direct)}; markup: ${calc.factor.toFixed(2)}; margem bruta: ${money(calc.margin)}; barras: ${calc.bars}; lista de corte: ${calc.pieces} peças; plano estimado FFD com serra 4mm.`)} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white hover:bg-emerald-500 disabled:opacity-40">Adicionar ao orçamento</button>
          </div>
        </div>
      )}
    </section>
  );
}
