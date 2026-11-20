import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Expand, LoaderCircle, MoveUpRight, Sparkles } from "lucide-react";
import "./architectural-models-carousel.css";

export type ArchitecturalModel = {
  id: string;
  title: string;
  badge: string;
  line: "Suprema" | "Gold";
  model: "Janela de Correr Suprema" | "Porta Balcão" | "Maxim-Ar" | "Porta Camarão" | "Porta de Giro" | "Porta Pivotante" | "Janela Oscilobatente" | "Janela Basculante";
  color: string;
  panels: number;
  detail: string;
  image: string;
  generated?: boolean;
};
type Props = { onConfigure: (model: ArchitecturalModel) => void; onView: (model: ArchitecturalModel) => void };

const baseModels: ArchitecturalModel[] = [
  { id:"suprema-2", title:"Janela de correr · 2 folhas", badge:"Linha Suprema • 2 Folhas", line:"Suprema", model:"Janela de Correr Suprema", color:"Branco", panels:2, detail:"Marco perimetral, folhas móveis, escovas de vedação e trilho inferior duplo.", image:"https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=85" },
  { id:"suprema-4", title:"Janela de correr · 4 folhas", badge:"Linha Suprema • 4 Folhas", line:"Suprema", model:"Janela de Correr Suprema", color:"Preto Fosco", panels:4, detail:"Composição de quatro folhas, encontro central e distribuição para vãos amplos.", image:"https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1400&q=85" },
  { id:"gold-3", title:"Porta balcão panorâmica", badge:"Linha Gold • Contramarco", line:"Gold", model:"Porta Balcão", color:"Bronze", panels:3, detail:"Contramarco, trilhos de deslizamento, escovas e perfis reforçados.", image:"https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1400&q=85" },
  { id:"gold-fold", title:"Porta camarão", badge:"Linha Gold • Articulada", line:"Gold", model:"Porta Camarão", color:"Natural Fosco", panels:3, detail:"Folhas articuladas, dobradiças, pivôs e pontos de fechamento.", image:"https://images.unsplash.com/photo-1600607687644-c7171b42498f?auto=format&fit=crop&w=1400&q=85" },
  { id:"suprema-maxim", title:"Janela Maxim-Ar", badge:"Linha Suprema • Maxim-Ar", line:"Suprema", model:"Maxim-Ar", color:"Branco", panels:1, detail:"Braços de projeção, limitadores, articulações e vedação perimetral.", image:"https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1400&q=85" },
  { id:"gold-4", title:"Porta de correr ampla", badge:"Linha Gold • 4 Folhas", line:"Gold", model:"Porta Balcão", color:"Preto Fosco", panels:4, detail:"Conjunto para grandes vãos, roldanas, guia superior e trilho inferior.", image:"https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1400&q=85" },
  { id:"panoramica", title:"Esquadria piso-teto", badge:"Linha Gold • Panorâmica", line:"Gold", model:"Porta Balcão", color:"Preto Fosco", panels:4, detail:"Fechamento de grandes vãos com visual limpo e entrada abundante de luz natural.", image:"https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=85" },
  { id:"vista", title:"Janela com vista panorâmica", badge:"Linha Suprema • Panorâmica", line:"Suprema", model:"Janela de Correr Suprema", color:"Natural Fosco", panels:3, detail:"Abertura ampla para integração entre ambiente interno e paisagem.", image:"https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=1400&q=85" },
  { id:"entrada", title:"Porta de entrada contemporânea", badge:"Linha Gold • Entrada", line:"Gold", model:"Porta Balcão", color:"Bronze", panels:1, detail:"Composição de acesso com perfis de alumínio e acabamento arquitetônico.", image:"https://images.unsplash.com/photo-1600607687644-c7171b42498f?auto=format&fit=crop&w=1400&q=85&sat=-15" },
  { id:"varanda", title:"Fechamento de varanda", badge:"Linha Suprema • Varanda", line:"Suprema", model:"Janela de Correr Suprema", color:"Champagne", panels:4, detail:"Solução visual para proteção e integração de varandas e sacadas.", image:"https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=85&sat=-20" },
  { id:"porta-giro", title:"Porta de giro", badge:"Linha Gold • Abrir", line:"Gold", model:"Porta de Giro", color:"Corten", panels:1, detail:"Porta de abrir com dobradiças, fechadura e perfis reforçados.", image:"https://images.unsplash.com/photo-1600607687644-c7171b42498f?auto=format&fit=crop&w=1400&q=90" },
  { id:"pivotante", title:"Porta pivotante", badge:"Linha Gold • Pivotante", line:"Gold", model:"Porta Pivotante", color:"Preto Fosco", panels:1, detail:"Abertura sobre eixo vertical e presença arquitetônica.", image:"https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1400&q=90" },
  { id:"oscilobatente", title:"Janela oscilobatente", badge:"Linha Suprema • Dupla abertura", line:"Suprema", model:"Janela Oscilobatente", color:"Prata", panels:1, detail:"Abertura lateral e basculante para ventilação controlada.", image:"https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1400&q=90" },
  { id:"basculante", title:"Janela basculante", badge:"Linha Suprema • Basculante", line:"Suprema", model:"Janela Basculante", color:"Verde Oliva", panels:2, detail:"Solução compacta para ventilação superior.", image:"https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1400&q=90" },
];
const CACHE_KEY = "anacleto:architectural-models:v2";
const suggestions = ["Janela de correr 4 folhas Linha Gold grafite com vidro reflecta", "Porta pivotante de alumínio amadeirado com puxador vertical", "Janela oscilobatente branca com vidro fumê", "Porta de giro bronze com fechadura multiponto"];

function loadCache(): ArchitecturalModel[] {
  try { const raw = sessionStorage.getItem(CACHE_KEY); return raw ? JSON.parse(raw) as ArchitecturalModel[] : []; } catch { return []; }
}
function saveCache(items: ArchitecturalModel[]) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(items.slice(0, 12))); } catch { /* storage can be unavailable */ }
}

export default function ArchitecturalModelsCarousel({ onConfigure, onView }: Props) {
  const [generated, setGenerated] = useState<ArchitecturalModel[]>([]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
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
        <button className="amc-image-button" type="button" onClick={()=>onView(item)} aria-label={`Abrir ${item.title} no visualizador 360 graus`}><img src={item.image} alt={`Render técnico de ${item.title}, acabamento ${item.color}`} loading={item.generated?"eager":"lazy"}/><span className="amc-watermark" aria-hidden="true">ANACLETO ESQUADRIAS</span><span className="amc-zoom"><Expand size={15}/> VER DETALHES</span></button>
        <div className="amc-card-content"><span className="amc-badge">{item.badge}</span><h3>{item.title}</h3><p>{item.detail}</p><div className="amc-meta"><span><i style={{background:item.color==="Branco"?"#f2f2ef":item.color==="Bronze"?"#9a704d":item.color==="Natural Fosco"?"#aeb6b9":"#24282e"}}/>{item.color}</span><span>{item.panels} {item.panels===1?"folha":"folhas"}</span></div><button className="amc-configure" type="button" onClick={()=>onConfigure(item)}>Configurar este modelo <MoveUpRight size={16}/></button></div>
      </article>)}
    </div>
    <div className="amc-mobile-hint"><span>DESLIZE PARA EXPLORAR</span><span>{items.length} MODELOS</span></div>
    <p className="amc-disclaimer">Renders conceituais para referência visual. Perfis, componentes, ferragens, dimensões e desempenho dependem de especificação e validação técnica.</p>

  </section>;
}
