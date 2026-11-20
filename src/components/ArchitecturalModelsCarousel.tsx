import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Expand, LoaderCircle, MoveUpRight, Sparkles, X } from "lucide-react";
import "./architectural-models-carousel.css";

export type ArchitecturalModel = {
  id: string;
  title: string;
  badge: string;
  line: "Suprema" | "Gold";
  model: "Janela de Correr Suprema" | "Porta Balcão" | "Maxim-Ar" | "Porta Camarão";
  color: string;
  panels: number;
  detail: string;
  image: string;
  generated?: boolean;
};
type Props = { onConfigure: (model: ArchitecturalModel) => void };

const baseModels: ArchitecturalModel[] = [
  { id:"suprema-2", title:"Janela de correr · 2 folhas", badge:"Linha Suprema • 2 Folhas", line:"Suprema", model:"Janela de Correr Suprema", color:"Branco", panels:2, detail:"Marco perimetral, folhas móveis, escovas de vedação e trilho inferior duplo.", image:"/images/anacleto/janela-explodida.webp" },
  { id:"suprema-4", title:"Janela de correr · 4 folhas", badge:"Linha Suprema • 4 Folhas", line:"Suprema", model:"Janela de Correr Suprema", color:"Preto Fosco", panels:4, detail:"Composição de quatro folhas, encontro central e distribuição para vãos amplos.", image:"/images/anacleto/colecao-esquadrias.webp" },
  { id:"gold-3", title:"Porta balcão panorâmica", badge:"Linha Gold • Contramarco", line:"Gold", model:"Porta Balcão", color:"Bronze", panels:3, detail:"Contramarco, trilhos de deslizamento, escovas e perfis reforçados.", image:"/images/anacleto/porta-explodida.webp" },
  { id:"gold-fold", title:"Porta camarão", badge:"Linha Gold • Articulada", line:"Gold", model:"Porta Camarão", color:"Natural Fosco", panels:3, detail:"Folhas articuladas, dobradiças, pivôs e pontos de fechamento.", image:"/images/anacleto/porta-explodida.webp" },
  { id:"suprema-maxim", title:"Janela Maxim-Ar", badge:"Linha Suprema • Maxim-Ar", line:"Suprema", model:"Maxim-Ar", color:"Branco", panels:1, detail:"Braços de projeção, limitadores, articulações e vedação perimetral.", image:"/images/anacleto/despiece-tecnico.webp" },
  { id:"gold-4", title:"Porta de correr ampla", badge:"Linha Gold • 4 Folhas", line:"Gold", model:"Porta Balcão", color:"Preto Fosco", panels:4, detail:"Conjunto para grandes vãos, roldanas, guia superior e trilho inferior.", image:"/images/anacleto/colecao-esquadrias.webp" },
];
const CACHE_KEY = "anacleto:architectural-models:v1";
const suggestions = ["Janela de correr 4 folhas Linha Gold preta com vidro reflecta", "Porta camarão Linha Gold bronze com 3 folhas", "Maxim-Ar Linha Suprema branca com vidro duplo"];

function loadCache(): ArchitecturalModel[] {
  try { const raw = sessionStorage.getItem(CACHE_KEY); return raw ? JSON.parse(raw) as ArchitecturalModel[] : []; } catch { return []; }
}
function saveCache(items: ArchitecturalModel[]) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(items.slice(0, 12))); } catch { /* storage can be unavailable */ }
}

export default function ArchitecturalModelsCarousel({ onConfigure }: Props) {
  const [generated, setGenerated] = useState<ArchitecturalModel[]>([]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [active, setActive] = useState<ArchitecturalModel | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const items = useMemo(() => [...generated, ...baseModels], [generated]);

  useEffect(() => { setGenerated(loadCache()); }, []);
  useEffect(() => { if (generated.length) saveCache(generated); }, [generated]);

  const move = (direction: number) => {
    const node = track.current;
    if (!node) return;
    const card = node.querySelector<HTMLElement>(".amc-card");
    node.scrollBy({ left: direction * ((card?.getBoundingClientRect().width || 320) + 18), behavior: "smooth" });
  };

  const generate = async () => {
    const description = prompt.trim();
    if (description.length < 8) { setNotice("Descreva o modelo com pelo menos 8 caracteres."); return; }
    setLoading(true); setNotice("");
    try {
      const response = await fetch("/api/generate-3d-render", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      const data = await response.json();
      if (!response.ok || !data.image) throw new Error(data.error || "Não foi possível gerar o render.");
      const panelMatch = description.match(/(\d+)\s*folhas?/i);
      const panelCount = Math.min(6, Math.max(1, Number(panelMatch?.[1] ?? 2)));
      const model: ArchitecturalModel = {
        id: `ai-${Date.now()}`, title: description.length > 54 ? `${description.slice(0, 51)}…` : description,
        badge: "Render IA • Sob medida", line: /gold/i.test(description) ? "Gold" : "Suprema",
        model: /maxim/i.test(description) ? "Maxim-Ar" : /camarão|camarao/i.test(description) ? "Porta Camarão" : /porta/i.test(description) ? "Porta Balcão" : "Janela de Correr Suprema",
        color: /bronze/i.test(description) ? "Bronze" : /branc/i.test(description) ? "Branco" : /natural/i.test(description) ? "Natural Fosco" : "Preto Fosco",
        panels: panelCount,
        detail: "Render conceitual gerado por IA. Perfis, ferragens, fixações e medidas devem ser validados pela equipe técnica.",
        image: data.image, generated: true,
      };
      setGenerated(current => [model, ...current.filter(item => item.id !== model.id)].slice(0, 6));
      setPrompt("");
      setNotice(data.fallback ? "Provedor indisponível: exibindo o render técnico local de respaldo." : "Novo modelo adicionado ao início da coleção.");
      track.current?.scrollTo({ left: 0, behavior: "smooth" });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Serviço temporariamente indisponível.");
    } finally { setLoading(false); }
  };

  return <section className="amc-section" aria-labelledby="amc-title">
    <div className="amc-heading">
      <div><span className="amc-kicker">ANACLETO / COLEÇÃO TÉCNICA 3D</span><h2 id="amc-title">Modelos para imaginar. Engenharia para construir.</h2><p>Explore tipologias, acabamentos e detalhes de montagem em uma galeria de inspiração arquitetônica.</p></div>
      <div className="amc-nav"><button type="button" aria-label="Modelos anteriores" onClick={() => move(-1)}><ArrowLeft size={18}/></button><button type="button" aria-label="Próximos modelos" onClick={() => move(1)}><ArrowRight size={18}/></button></div>
    </div>
    <div className="amc-generator">
      <div className="amc-generator-label"><Sparkles size={17}/><span>GERAR NOVO MODELO 3D</span><small>Descreva uma esquadria para criar um novo estudo</small></div>
      <div className="amc-prompt-row"><input value={prompt} onChange={e=>setPrompt(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")void generate();}} placeholder="Ex.: janela 4 folhas Linha Gold preto com persiana integrada" aria-label="Descreva o modelo arquitetônico"/><button type="button" onClick={()=>void generate()} disabled={loading}>{loading?<LoaderCircle className="amc-spin" size={16}/>:<Sparkles size={16}/>} {loading?"Gerando…":"Gerar render"}</button></div>
      <div className="amc-suggestions">{suggestions.map(s=><button key={s} type="button" onClick={()=>setPrompt(s)}>{s}</button>)}</div>
      {notice&&<p className="amc-notice" role="status">{notice}</p>}
    </div>
    <div className="amc-track" ref={track} aria-label="Carrossel de modelos arquitetônicos" tabIndex={0} onScroll={e=>{const node=e.currentTarget;const card=node.querySelector<HTMLElement>(".amc-card");if(card)setActiveIndex(Math.max(0,Math.min(items.length-1,Math.round(node.scrollLeft/(card.offsetWidth+18)))));}}>
      {items.map(item=><article className="amc-card" key={item.id}>
        <button className="amc-image-button" type="button" onClick={()=>setActive(item)} aria-label={`Ampliar ${item.title}`}><img src={item.image} alt={`Render técnico de ${item.title}, acabamento ${item.color}`} loading={item.generated?"eager":"lazy"}/><span className="amc-watermark" aria-hidden="true">ANACLETO ESQUADRIAS</span><span className="amc-zoom"><Expand size={15}/> VER DETALHES</span></button>
        <div className="amc-card-content"><span className="amc-badge">{item.badge}</span><h3>{item.title}</h3><p>{item.detail}</p><div className="amc-meta"><span><i style={{background:item.color==="Branco"?"#f2f2ef":item.color==="Bronze"?"#9a704d":item.color==="Natural Fosco"?"#aeb6b9":"#24282e"}}/>{item.color}</span><span>{item.panels} {item.panels===1?"folha":"folhas"}</span></div><button className="amc-configure" type="button" onClick={()=>onConfigure(item)}>Configurar este modelo <MoveUpRight size={16}/></button></div>
      </article>)}
    </div>
    <div className="amc-mobile-hint"><span>DESLIZE PARA EXPLORAR</span><span>{items.length} MODELOS</span></div>
    <p className="amc-disclaimer">Renders conceituais para referência visual. Perfis, componentes, ferragens, dimensões e desempenho dependem de especificação e validação técnica.</p>
    {active&&<div className="amc-lightbox" role="dialog" aria-modal="true" aria-label={`Detalhes de ${active.title}`} onMouseDown={e=>{if(e.target===e.currentTarget)setActive(null);}}><div className="amc-lightbox-panel"><button className="amc-close" type="button" onClick={()=>setActive(null)} aria-label="Fechar"><X size={22}/></button><div className="amc-lightbox-image"><img src={active.image} alt={`Detalhe ampliado de ${active.title}`}/><span className="amc-watermark amc-watermark-large" aria-hidden="true">ANACLETO ESQUADRIAS</span></div><div className="amc-lightbox-copy"><span className="amc-badge">{active.badge}</span><h3>{active.title}</h3><p>{active.detail}</p><ul><li><Check size={15}/> Perfis e encontros de alumínio</li><li><Check size={15}/> Trilhos, guias e pontos de fixação</li><li><Check size={15}/> Vidro e vedação perimetral</li><li><Check size={15}/> Esquadro, parafusos e união dos marcos</li></ul><button className="amc-configure" type="button" onClick={()=>{onConfigure(active);setActive(null);}}>Cotizar a medida <MoveUpRight size={16}/></button></div></div></div>}
  </section>;
}
