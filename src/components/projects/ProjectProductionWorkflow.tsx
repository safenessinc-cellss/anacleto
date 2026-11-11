import React, { useMemo, useState } from "react";
import { addDoc, collection, doc, updateDoc } from "firebase/firestore";
import { auth, db } from "../../firebase";
import { TechnicalDrawing } from "../../types";
import DrawingSvgCanvas from "../technical-drawing/DrawingSvgCanvas";
import { ClipboardCheck, Ruler, Scissors, Hammer, Box, Sparkles, Loader2, Save, ShieldCheck } from "lucide-react";

type Props = { projectId: string; projectName: string; projectNotes?: string; assets?: Array<{name:string;url:string;kind:string}> };
type EngineeringPlan = {
  measurementPlan?: Array<{point:string;method:string;tool:string;checks:string[]}>;
  cuttingPlan?: Array<{pieceNumber:number;name:string;material:string;quantity:number;length:number;width:number;thickness:number;unit:string;cutAngle:string;notes:string}>;
  manufacturingSteps?: Array<{step:number;title:string;instructions:string[];qualityGate:string}>;
  modelDescription?: string;
  finalAppearance?: string;
  qualityChecklist?: string[];
  assumptions?: string[];
  approvalRequired?: boolean;
};
const initial = { width:"", height:"", depth:"", unit:"mm", quantity:"1", measurementSource:"field", productType:"Esquadria de alumínio e vidro", opening:"A definir", profileSystem:"A definir pelo responsável técnico", glass:"A definir", hardware:"A definir", tolerances:"A confirmar conforme sistema", notes:"" };

export default function ProjectProductionWorkflow({projectId,projectName,projectNotes="",assets=[]}:Props) {
  const [form,setForm]=useState(initial);
  const [plan,setPlan]=useState<EngineeringPlan|null>(null);
  const [drawing,setDrawing]=useState<TechnicalDrawing|null>(null);
  const [busy,setBusy]=useState(false);
  const [saving,setSaving]=useState(false);
  const [approved,setApproved]=useState(false);
  const [checked,setChecked]=useState<string[]>([]);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const numericDimensions=useMemo(()=>[form.width,form.height].every(v=>Number(v)>0),[form.width,form.height]);
  const update=(key:string,value:string)=>setForm(current=>({...current,[key]:value}));
  const toggle=(value:string)=>setChecked(current=>current.includes(value)?current.filter(x=>x!==value):[...current,value]);

  const generate=async()=>{
    const user=auth.currentUser;
    if(!user){setError("Entre novamente para gerar o projeto técnico.");return;}
    if(!numericDimensions){setError("Informe largura e altura medidas ou identificadas no desenho original. A IA não deve inventar cotas.");return;}
    setBusy(true);setError("");setNotice("");setPlan(null);setDrawing(null);setApproved(false);setChecked([]);
    try{
      const token=await user.getIdToken();
      const prompt=[
        "DESENVOLVA O DOSSIÊ TÉCNICO COMPLETO DE FABRICAÇÃO PARA ESTE PROJETO.",
        "Projeto: "+projectName,
        "Descrição e arquivos associados (nomes/referências, não conteúdo binário): "+projectNotes+" "+assets.map(a=>a.name+" ["+a.kind+"] "+a.url).join("; "),
        "Produto: "+form.productType+"; abertura: "+form.opening+"; sistema de perfis: "+form.profileSystem,
        "Dimensões fornecidas: largura "+form.width+" x altura "+form.height+" x profundidade "+(form.depth||"não informada")+" "+form.unit+"; quantidade "+form.quantity,
        "Origem das medidas: "+form.measurementSource+"; tolerâncias: "+form.tolerances,
        "Vidro: "+form.glass+"; ferragens: "+form.hardware+"; observações: "+form.notes,
        "REGRAS: preserve exatamente as dimensões fornecidas e a unidade. Não invente folgas, descontos, fórmulas de perfis, espessuras, códigos de sistema ou tolerâncias. Onde faltar informação, escreva PENDENTE DE CONFIRMAÇÃO e explique como obter a medida. Não libere corte real sem sistema de perfil e fórmula validados.",
        "Retorne desenho técnico com vistas/cotas, peças preliminares, plano de medição passo a passo (pontos, método, ferramenta, conferências), plano de corte preliminar por peça, sequência de fabricação/montagem, descrição do modelo 3D/visual final, checklist de qualidade e lista de premissas/pendências."
      ].join("\n");
      const response=await fetch("/api/ai/technical-drawing",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({prompt,catalog:[]})});
      const data=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(data?.error||"Falha ao gerar o dossiê técnico ("+response.status+").");
      if(data?._fallback)throw new Error("A IA está indisponível. Não foi criado um plano de fabricação fictício.");
      if(!Array.isArray(data?.pieces)||!data.pieces.length||!data?.overallDimensions)throw new Error("A resposta não contém um desenho técnico completo.");
      const createdAt=new Date().toISOString();
      const nextDrawing:TechnicalDrawing={id:"",title:data.title||projectName,description:data.description||prompt,category:data.category||"custom",unit:data.unit==="mm"?"mm":"cm",overallDimensions:data.overallDimensions,pieces:data.pieces,dimensionLines:Array.isArray(data.dimensionLines)?data.dimensionLines:[],assemblyInstructions:Array.isArray(data.assemblyInstructions)?data.assemblyInstructions:[],steps:Array.isArray(data.steps)?data.steps:[],currentStep:1,createdAt,updatedAt:createdAt,projectId,projectName} as TechnicalDrawing;
      const nextPlan:EngineeringPlan={measurementPlan:data.measurementPlan||[],cuttingPlan:data.cuttingPlan||[],manufacturingSteps:data.manufacturingSteps||[],modelDescription:data.modelDescription||"",finalAppearance:data.finalAppearance||"",qualityChecklist:data.qualityChecklist||[],assumptions:data.assumptions||[],approvalRequired:true};
      setDrawing(nextDrawing);setPlan(nextPlan);
      setNotice("Dossiê preliminar gerado. Confira as medidas em obra e valide o sistema antes de liberar qualquer corte.");
    }catch(e){setError(e instanceof Error?e.message:"Não foi possível gerar o projeto técnico.");}
    finally{setBusy(false);}
  };

  const save=async()=>{
    if(!drawing||!plan)return;
    if(approved && (form.measurementSource==="estimate" || !form.profileSystem.trim() || form.profileSystem.toLowerCase().startsWith("a definir") || !plan.measurementPlan?.length || !plan.cuttingPlan?.length || !plan.manufacturingSteps?.length || !plan.qualityChecklist?.length || checked.length < plan.qualityChecklist.length)){setError("Não é possível aprovar: confirme medidas reais, sistema de perfis, plano de medição, corte, fabricação e todos os itens do checklist.");return;}
    const user=auth.currentUser;if(!user){setError("Sessão expirada.");return;}
    setSaving(true);setError("");setNotice("");
    try{
      const ref=await addDoc(collection(db,"technical_drawings"),{...drawing,projectId,projectName,engineeringPlan:plan,workflowStatus:approved?"Aprovado tecnicamente":"Aguardando validação",approvedBy:approved?user.uid:"",approvedAt:approved?new Date().toISOString():""});
      await updateDoc(doc(db,"projects",projectId),{engineering:{drawingId:ref.id,workflowStatus:approved?"Aprovado tecnicamente":"Aguardando validação",measurement:form,plan,approvalChecklist:checked,approved,updatedAt:new Date().toISOString()},updatedAt:new Date().toISOString()});
      setNotice("Dossiê e desenho salvos no projeto. "+(approved?"Aprovação registrada.":"Permanece pendente de aprovação técnica."));
    }catch(e){setError(e instanceof Error?e.message:"Falha ao salvar o dossiê.");}
    finally{setSaving(false);}
  };

  return <section className="mt-5 space-y-5 rounded-2xl border border-indigo-100 bg-white p-4 sm:p-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Engenharia • fabricação</p><h3 className="text-lg font-black text-slate-900">Dossiê técnico: {projectName}</h3><p className="text-sm text-slate-500">Medição, desenho, despiece, corte, montagem e resultado final num único fluxo.</p><p className="mt-1 text-xs text-amber-700">Os anexos ficam vinculados ao projeto; nesta etapa, a IA recebe descrições, nomes e referências, não o conteúdo visual interno de PDFs/imagens. Transcreva as cotas ou informe as medidas para uma análise técnica confiável.</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">Corte bloqueado até validação</span></header>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="text-xs font-semibold text-slate-600">Tipo de produto<input value={form.productType} onChange={e=>update("productType",e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm"/></label>
      <label className="text-xs font-semibold text-slate-600">Sistema / linha de perfis<input value={form.profileSystem} onChange={e=>update("profileSystem",e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm"/></label>
      <label className="text-xs font-semibold text-slate-600">Tipo de abertura<input value={form.opening} onChange={e=>update("opening",e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm"/></label>
      <label className="text-xs font-semibold text-slate-600">Largura ({form.unit}) *<input type="number" min="1" value={form.width} onChange={e=>update("width",e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm"/></label>
      <label className="text-xs font-semibold text-slate-600">Altura ({form.unit}) *<input type="number" min="1" value={form.height} onChange={e=>update("height",e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm"/></label>
      <label className="text-xs font-semibold text-slate-600">Profundidade ({form.unit})<input type="number" min="0" value={form.depth} onChange={e=>update("depth",e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm"/></label>
      <label className="text-xs font-semibold text-slate-600">Unidade<select value={form.unit} onChange={e=>update("unit",e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm"><option value="mm">Milímetros (mm)</option><option value="cm">Centímetros (cm)</option></select></label>
      <label className="text-xs font-semibold text-slate-600">Quantidade<input type="number" min="1" value={form.quantity} onChange={e=>update("quantity",e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm"/></label>
      <label className="text-xs font-semibold text-slate-600">Origem das medidas<select value={form.measurementSource} onChange={e=>update("measurementSource",e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm"><option value="field">Medição em obra</option><option value="customer_drawing">Desenho do cliente</option><option value="estimate">Estimativa / ainda não conferida</option></select></label>
      <label className="text-xs font-semibold text-slate-600">Especificação do vidro<input value={form.glass} onChange={e=>update("glass",e.target.value)} placeholder="Ex.: temperado 8 mm (confirmar)" className="mt-1 w-full rounded-lg border p-2.5 text-sm"/></label>
      <label className="text-xs font-semibold text-slate-600">Ferragens<input value={form.hardware} onChange={e=>update("hardware",e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm"/></label>
      <label className="text-xs font-semibold text-slate-600">Tolerâncias / folgas<input value={form.tolerances} onChange={e=>update("tolerances",e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm"/></label>
    </div>
    <label className="block text-xs font-semibold text-slate-600">Observações técnicas<textarea rows={3} value={form.notes} onChange={e=>update("notes",e.target.value)} placeholder="Vão, prumo, nível, esquadro, obstáculos, lado de abertura, acabamento..." className="mt-1 w-full rounded-lg border p-3 text-sm"/></label>
    <div className="flex flex-wrap gap-2"><button onClick={generate} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy?<Loader2 className="h-4 w-4 animate-spin"/>:<Sparkles className="h-4 w-4"/>}Gerar dossiê técnico com IA</button>{drawing&&<button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"><Save className="h-4 w-4"/>{saving?"Salvando...":"Salvar no projeto"}</button>}</div>
    {error&&<p role="alert" className="text-sm text-rose-700">{error}</p>}{notice&&<p role="status" className="text-sm text-emerald-700">{notice}</p>}
    {drawing&&plan&&<div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-2"><div><h4 className="mb-2 flex items-center gap-2 font-bold text-slate-900"><Ruler className="h-4 w-4"/> Desenho técnico e cotas</h4><DrawingSvgCanvas drawing={drawing} currentStep={1}/><h4 className="mb-2 mt-4 flex items-center gap-2 font-bold text-slate-900"><Box className="h-4 w-4"/> Vista final do projeto</h4><DrawingSvgCanvas drawing={drawing} currentStep={5}/></div><div className="space-y-3"><div className="rounded-xl border p-4"><h4 className="font-bold text-slate-900">Como medir em obra</h4>{plan.measurementPlan?.length?<ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-slate-700">{plan.measurementPlan.map((m,i)=><li key={i}><b>{m.point}</b>: {m.method}<p className="text-xs text-slate-500">Ferramenta: {m.tool} • Conferências: {(m.checks||[]).join("; ")}</p></li>)}</ol>:<p className="text-sm text-amber-700">A IA não retornou um plano de medição detalhado. Preencha os pontos e valide manualmente.</p>}</div><div className="rounded-xl border p-4"><h4 className="font-bold text-slate-900">Modelo e aparência final</h4><p className="mt-2 text-sm text-slate-700">{plan.modelDescription||"Não especificado."}</p><p className="mt-2 text-sm text-slate-700">{plan.finalAppearance||"Aguardando renderização/validação visual."}</p></div></div></div>
      <div className="rounded-xl border p-4"><h4 className="flex items-center gap-2 font-bold text-slate-900"><Scissors className="h-4 w-4"/> Plano de corte preliminar</h4><p className="my-2 text-xs text-amber-700">As dimensões abaixo são uma proposta da IA. Não executar cortes até confirmar linha de perfil, tabela de usinagem, folgas e ângulos do fabricante.</p>{plan.cuttingPlan?.length?<div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b text-slate-500"><th className="p-2">Peça</th><th className="p-2">Material</th><th className="p-2">Qtd.</th><th className="p-2">Comprimento</th><th className="p-2">Largura</th><th className="p-2">Espessura</th><th className="p-2">Ângulo / observação</th></tr></thead><tbody>{plan.cuttingPlan.map((p,i)=><tr key={i} className="border-b"><td className="p-2">{p.pieceNumber}. {p.name}</td><td className="p-2">{p.material}</td><td className="p-2">{p.quantity}</td><td className="p-2">{p.length} {p.unit}</td><td className="p-2">{p.width} {p.unit}</td><td className="p-2">{p.thickness} {p.unit}</td><td className="p-2">{p.cutAngle} • {p.notes}</td></tr>)}</tbody></table></div>:<p className="text-sm text-amber-700">Plano de corte pendente de detalhamento.</p>}</div>
      <div className="grid gap-4 lg:grid-cols-2"><div className="rounded-xl border p-4"><h4 className="flex items-center gap-2 font-bold text-slate-900"><Hammer className="h-4 w-4"/> Fabricação e montagem</h4><ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">{(plan.manufacturingSteps||[]).map((s,i)=><li key={i}><b>{s.title}</b><ul className="list-disc pl-5 text-slate-600">{(s.instructions||[]).map((t,j)=><li key={j}>{t}</li>)}</ul><p className="text-xs text-indigo-700">Ponto de controle: {s.qualityGate}</p></li>)}</ol></div><div className="rounded-xl border p-4"><h4 className="flex items-center gap-2 font-bold text-slate-900"><ClipboardCheck className="h-4 w-4"/> Conferência e aprovação</h4><div className="mt-2 space-y-2">{(plan.qualityChecklist||[]).map((item,i)=><label key={i} className="flex gap-2 text-sm"><input type="checkbox" checked={checked.includes(item)} onChange={()=>toggle(item)}/><span>{item}</span></label>)}</div><label className="mt-3 flex gap-2 text-sm font-semibold"><input type="checkbox" checked={approved} onChange={e=>setApproved(e.target.checked)}/><span>Confirmo que conferi os dados, medidas e sistema de fabricação. Registrar minha aprovação técnica.</span></label><p className="mt-2 flex items-start gap-2 text-xs text-amber-700"><ShieldCheck className="h-4 w-4 shrink-0"/> A aprovação é um registro operacional; não substitui a responsabilidade do profissional habilitado nem as tabelas oficiais do fabricante.</p></div></div>
      {plan.assumptions?.length>0&&<div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><h4 className="font-bold text-amber-900">Pendências e premissas</h4><ul className="mt-2 list-disc pl-5 text-sm text-amber-800">{plan.assumptions.map((a,i)=><li key={i}>{a}</li>)}</ul></div>}
    </div>}
  </section>;
}
