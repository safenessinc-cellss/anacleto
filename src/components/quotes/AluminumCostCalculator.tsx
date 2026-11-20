import React, { useEffect, useMemo, useState } from "react";
import { Calculator, Plus, Scissors, PackageCheck } from "lucide-react";
import type { QuoteItem } from "../../types";
import { calculateAluminumCost, type AluminumProfileRule, type AccessoryCostInput } from "../../utils/aluminumCosting";

const initialProfiles: AluminumProfileRule[] = [
  { id: "frame-vertical", profileCode: "PERFIL-MARCO", profileName: "Marco · montantes", axis: "H", divisor: 1, deductionMm: 0, quantity: 2, weightKgPerM: 0, priceMode: "kg", pricePerKg: 0, pricePerBar: 0, barLengthMm: 6000, kerfMm: 4, trimMm: 15 },
  { id: "frame-horizontal", profileCode: "PERFIL-MARCO", profileName: "Marco · travessas", axis: "L", divisor: 1, deductionMm: 0, quantity: 2, weightKgPerM: 0, priceMode: "kg", pricePerKg: 0, pricePerBar: 0, barLengthMm: 6000, kerfMm: 4, trimMm: 15 },
  { id: "sash-vertical", profileCode: "PERFIL-FOLHA", profileName: "Folha · montantes", axis: "H", divisor: 1, deductionMm: 0, quantity: 4, weightKgPerM: 0, priceMode: "kg", pricePerKg: 0, pricePerBar: 0, barLengthMm: 6000, kerfMm: 4, trimMm: 15 },
  { id: "sash-horizontal", profileCode: "PERFIL-FOLHA", profileName: "Folha · travessas", axis: "L", divisor: 2, deductionMm: 0, quantity: 4, weightKgPerM: 0, priceMode: "kg", pricePerKg: 0, pricePerBar: 0, barLengthMm: 6000, kerfMm: 4, trimMm: 15 },
];

const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
const fieldClass = "mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-900";\nconst PROFILE_RULES_KEY = "anacleto.aluminum-profile-rules.v1";

export default function AluminumCostCalculator({ onApply }: { onApply: (items: QuoteItem[]) => void }) {
  const [width, setWidth] = useState(1500);
  const [height, setHeight] = useState(1200);
  const [profiles, setProfiles] = useState<AluminumProfileRule[]>(() => {\n    try { const saved = typeof window !== "undefined" ? window.localStorage.getItem(PROFILE_RULES_KEY) : null; return saved ? JSON.parse(saved) as AluminumProfileRule[] : initialProfiles; } catch { return initialProfiles; }\n  });
  const [glassWidthDeduction, setGlassWidthDeduction] = useState(100);
  const [glassHeightDeduction, setGlassHeightDeduction] = useState(80);
  const [panes, setPanes] = useState(2);
  const [minimumGlassArea, setMinimumGlassArea] = useState(0.25);
  const [glassPrice, setGlassPrice] = useState(0);
  const [accessories, setAccessories] = useState<AccessoryCostInput[]>([
    { id: "hardware-kit", name: "Kit de ferragens", mode: "unit", quantity: 1, unitPrice: 0 },
    { id: "sealing-brush", name: "Escovas / vedação", mode: "meter", quantity: 0, unitPrice: 0 },
  ]);
  const [labor, setLabor] = useState(0);
  const [margin, setMargin] = useState(30);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => { try { window.localStorage.setItem(PROFILE_RULES_KEY, JSON.stringify(profiles)); } catch { /* local persistence is best-effort */ } }, [profiles]);\n\n  const result = useMemo(() => calculateAluminumCost({
    widthMm: width, heightMm: height, profiles,
    glass: { widthDeductionMm: glassWidthDeduction, heightDeductionMm: glassHeightDeduction, panes, minimumAreaM2: minimumGlassArea, pricePerM2: glassPrice },
    accessories, labor, marginPercent: margin,
  }), [width, height, profiles, glassWidthDeduction, glassHeightDeduction, panes, minimumGlassArea, glassPrice, accessories, labor, margin]);

  const updateProfile = (id: string, patch: Partial<AluminumProfileRule>) => setProfiles((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  const updateAccessory = (id: string, patch: Partial<AccessoryCostInput>) => setAccessories((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  const apply = () => {
    if (!result.valid) return;
    const items: QuoteItem[] = result.quoteItems.map((item, index) => ({
      id: `aluminum-cost-${Date.now()}-${index}`,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
      notes: item.notes,
      priceSource: "manual",
    }));
    onApply(items);
  };

  return <section className="space-y-4 rounded-2xl border border-blue-200 bg-white p-4 text-slate-900 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h2 className="flex items-center gap-2 text-lg font-black"><Calculator className="h-5 w-5 text-blue-600"/> Calculadora técnica de esquadrias</h2><p className="text-sm text-slate-500">Despiece linear, otimização de barras, alumínio, vidro, acessórios e preço final.</p></div>
      <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">Pré-cálculo · validar tabela do fabricante</span>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-xs font-semibold">Largura do vão (L) · mm<input type="number" min="1" value={width} onChange={(e)=>setWidth(Number(e.target.value))} className={fieldClass}/></label>
      <label className="text-xs font-semibold">Altura do vão (H) · mm<input type="number" min="1" value={height} onChange={(e)=>setHeight(Number(e.target.value))} className={fieldClass}/></label>
    </div>
    <div className="space-y-3">
      <div className="flex items-center justify-between"><h3 className="font-bold">1–3. Regras de corte e perfis</h3><button type="button" onClick={()=>setProfiles((current)=>[...current,{id:crypto.randomUUID(),profileCode:"NOVO-PERFIL",profileName:"Novo perfil",axis:"L",divisor:1,deductionMm:0,quantity:1,weightKgPerM:0,priceMode:"kg",pricePerKg:0,pricePerBar:0,barLengthMm:6000,kerfMm:4,trimMm:15}])} className="inline-flex items-center gap-1 text-xs font-bold text-blue-700"><Plus className="h-4 w-4"/> Adicionar perfil</button></div>
      {profiles.map((profile)=> <div key={profile.id} className="grid grid-cols-2 gap-2 rounded-xl border p-3 sm:grid-cols-4 lg:grid-cols-6">
        <label className="col-span-2 text-[11px] font-semibold sm:col-span-2">Perfil / código<input value={profile.profileName} onChange={(e)=>updateProfile(profile.id,{profileName:e.target.value,profileCode:e.target.value.toUpperCase().replace(/[^A-Z0-9]+/g,"-")})} className={fieldClass}/></label>
        <label className="text-[11px] font-semibold">Base<select value={profile.axis} onChange={(e)=>updateProfile(profile.id,{axis:e.target.value as "L"|"H"})} className={fieldClass}><option value="L">Largura (L)</option><option value="H">Altura (H)</option></select></label>
        <label className="text-[11px] font-semibold">Divisor<input type="number" min="0.01" step="0.5" value={profile.divisor} onChange={(e)=>updateProfile(profile.id,{divisor:Number(e.target.value)})} className={fieldClass}/></label>
        <label className="text-[11px] font-semibold">Desconto (mm)<input type="number" value={profile.deductionMm} onChange={(e)=>updateProfile(profile.id,{deductionMm:Number(e.target.value)})} className={fieldClass}/></label>
        <label className="text-[11px] font-semibold">Quantidade<input type="number" min="1" value={profile.quantity} onChange={(e)=>updateProfile(profile.id,{quantity:Number(e.target.value)})} className={fieldClass}/></label>
        <label className="text-[11px] font-semibold">Peso (kg/m)<input type="number" min="0" step="0.001" value={profile.weightKgPerM} onChange={(e)=>updateProfile(profile.id,{weightKgPerM:Number(e.target.value)})} className={fieldClass}/></label>
        <label className="text-[11px] font-semibold">Preço por kg (R$)<input type="number" min="0" step="0.01" value={profile.pricePerKg} onChange={(e)=>updateProfile(profile.id,{pricePerKg:Number(e.target.value),priceMode:"kg"})} className={fieldClass}/></label>
        <label className="text-[11px] font-semibold">Preço por barra (R$)<input type="number" min="0" step="0.01" value={profile.pricePerBar} onChange={(e)=>updateProfile(profile.id,{pricePerBar:Number(e.target.value),priceMode:"bar"})} className={fieldClass}/></label>
        <label className="text-[11px] font-semibold">Barra (mm)<input type="number" min="1" value={profile.barLengthMm} onChange={(e)=>updateProfile(profile.id,{barLengthMm:Number(e.target.value)})} className={fieldClass}/></label>
        <div className="grid grid-cols-2 gap-2"><label className="text-[11px] font-semibold">Disco (mm)<input type="number" min="0" value={profile.kerfMm} onChange={(e)=>updateProfile(profile.id,{kerfMm:Number(e.target.value)})} className={fieldClass}/></label><label className="text-[11px] font-semibold">Despunte (mm)<input type="number" min="0" value={profile.trimMm} onChange={(e)=>updateProfile(profile.id,{trimMm:Number(e.target.value)})} className={fieldClass}/></label></div>
      </div>)}
      <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Os descontos iniciais estão em zero apenas como campos de configuração. Informe os abatimentos reais do fabricante e o peso kg/m de cada código antes de usar o resultado para fabricação.</p>
    </div>
    <div className="space-y-3">
      <h3 className="font-bold">4. Vidro e acessórios</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <label className="text-[11px] font-semibold">Desconto largura vidro (mm)<input type="number" value={glassWidthDeduction} onChange={(e)=>setGlassWidthDeduction(Number(e.target.value))} className={fieldClass}/></label>
        <label className="text-[11px] font-semibold">Desconto altura vidro (mm)<input type="number" value={glassHeightDeduction} onChange={(e)=>setGlassHeightDeduction(Number(e.target.value))} className={fieldClass}/></label>
        <label className="text-[11px] font-semibold">Quantidade de panos<input type="number" min="1" value={panes} onChange={(e)=>setPanes(Number(e.target.value))} className={fieldClass}/></label>
        <label className="text-[11px] font-semibold">Área mínima (m²/pano)<input type="number" min="0" step="0.05" value={minimumGlassArea} onChange={(e)=>setMinimumGlassArea(Number(e.target.value))} className={fieldClass}/></label>
        <label className="text-[11px] font-semibold">Preço do vidro (R$/m²)<input type="number" min="0" step="0.01" value={glassPrice} onChange={(e)=>setGlassPrice(Number(e.target.value))} className={fieldClass}/></label>
      </div>
      {accessories.map((item)=><div key={item.id} className="grid grid-cols-2 gap-2 rounded-xl border p-3 sm:grid-cols-4"><label className="col-span-2 text-[11px] font-semibold">Acessório<input value={item.name} onChange={(e)=>updateAccessory(item.id,{name:e.target.value})} className={fieldClass}/></label><label className="text-[11px] font-semibold">Quantidade / metros<input type="number" min="0" value={item.quantity} onChange={(e)=>updateAccessory(item.id,{quantity:Number(e.target.value)})} className={fieldClass}/></label><label className="text-[11px] font-semibold">Preço unitário / metro (R$)<input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(e)=>updateAccessory(item.id,{unitPrice:Number(e.target.value)})} className={fieldClass}/></label></div>)}
      <button type="button" onClick={()=>setAccessories((current)=>[...current,{id:crypto.randomUUID(),name:"Novo acessório",mode:"unit",quantity:1,unitPrice:0}])} className="text-xs font-bold text-blue-700"><Plus className="mr-1 inline h-4 w-4"/>Adicionar acessório</button>
    </div>
    <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold">Mão de obra (R$)<input type="number" min="0" step="0.01" value={labor} onChange={(e)=>setLabor(Number(e.target.value))} className={fieldClass}/></label><label className="text-xs font-semibold">Margem sobre preço de venda (%)<input type="number" min="0" max="99" step="0.5" value={margin} onChange={(e)=>setMargin(Number(e.target.value))} className={fieldClass}/></label></div>
    <button type="button" onClick={()=>setShowResult(true)} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white"><Scissors className="h-4 w-4"/> Calcular despiece e custo</button>
    {showResult && <div className="space-y-3 rounded-xl bg-slate-50 p-3">
      <h3 className="font-bold">Resultado do cálculo</h3>
      {result.errors.length>0 && <ul className="list-disc space-y-1 pl-5 text-xs text-rose-700">{result.errors.map((error,index)=><li key={index}>{error}</li>)}</ul>}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><div className="rounded-lg bg-white p-3"><p className="text-xs text-slate-500">Barras</p><p className="text-xl font-black">{result.barCount}</p></div><div className="rounded-lg bg-white p-3"><p className="text-xs text-slate-500">Peso consumido</p><p className="text-xl font-black">{result.aluminumConsumptionKg} kg</p></div><div className="rounded-lg bg-white p-3"><p className="text-xs text-slate-500">Área de vidro</p><p className="text-xl font-black">{result.glassAreaM2} m²</p></div><div className="rounded-lg bg-white p-3"><p className="text-xs text-slate-500">Custo direto</p><p className="text-xl font-black">{money(result.directCost)}</p></div></div>
      <div className="overflow-x-auto rounded-lg border bg-white"><table className="w-full text-left text-xs"><thead className="bg-slate-100"><tr><th className="p-2">Perfil</th><th className="p-2">Cortes (mm)</th><th className="p-2">Barra</th><th className="p-2">Sobra (mm)</th></tr></thead><tbody>{result.bars.map((bar,index)=><tr key={index} className="border-t"><td className="p-2">{bar.profileName}</td><td className="p-2">{bar.cuts.map((cut)=>Math.round(cut.lengthMm)).join(" · ")}</td><td className="p-2">{bar.barNumber}</td><td className="p-2">{Math.round(bar.leftoverMm)}</td></tr>)}</tbody></table></div>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs text-slate-500">Custo de compra do material: {money(result.aluminumPurchaseCost)}</p><p className="text-xs text-slate-500">Preço de venda calculado (margem {result.marginPercent}%):</p><p className="text-2xl font-black text-emerald-700">{money(result.sellingPrice)}</p></div><button type="button" disabled={!result.valid} onClick={apply} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-40"><PackageCheck className="h-4 w-4"/> Adicionar itens ao orçamento</button></div>
    </div>}
  </section>;
}
