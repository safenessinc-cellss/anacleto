import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Expand, LoaderCircle, MoveUpRight, Sparkles } from "lucide-react";
import "./architectural-models-carousel.css";

export type ArchitecturalModel = {
  id: string;
  title: string;
  badge: string;
  line: "Suprema" | "Gold" | "Box";
  model: "Janela de Correr Suprema" | "Porta Balcão" | "Maxim-Ar" | "Porta Camarão" | "Porta de Giro" | "Porta Pivotante" | "Janela Oscilobatente" | "Janela Basculante" | "Box de Banho" | "Porta Lambril" | "Janela Veneziana" | "Painel Fixo";
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
  { id:"oscilobatente", title:"Janela oscilobatente", badge:"Linha Suprema • Dupla abertura", line:"Suprema", model:"Janela Oscilobatente", color:"Prata", panels:1, detail:"Abertura lateral e basculante para ventilação controlada.", image:"https://herabathware.com.au/cdn/shop/files/valentina-fully-frameless-shower-screen-2100mm-height-hinge-door-front-and-return-multiple-sizes600-9000mmbrushed-nickelshower-screenbella-vista-424275.jpg?v=1764911080" },
  { id:"basculante", title:"Janela basculante", badge:"Linha Suprema • Basculante", line:"Suprema", model:"Janela Basculante", color:"Verde Oliva", panels:2, detail:"Solução compacta para ventilação superior.", image:"https://image.made-in-china.com/2f0j00qDVcWySsLBrz/Modern-Square-Black-Aluminium-Profile-Sliding-Tempered-Glass-Door-Shower-Enclosure.webp" },
];
const doorModels: ArchitecturalModel[] = [
  { id:"door-sliding-2", title:"Porta de correr · 2 folhas", badge:"ALUMÍNIO • CORRER", line:"Suprema", model:"Porta Balcão", color:"Preto Fosco", panels:2, detail:"Duas folhas deslizantes, trilho inferior duplo e perfis de alumínio com grandes planos de vidro.", image:"https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1400&q=90" },
  { id:"door-sliding-4", title:"Porta de correr · 4 folhas", badge:"ALUMÍNIO • VÃO AMPLO", line:"Gold", model:"Porta Balcão", color:"Grafite", panels:4, detail:"Quatro folhas para integração entre sala, varanda e jardim, com abertura central ampla.", image:"https://www.westsidebathrooms.co.uk/images/shop/more/750x750_11800_cebfa1054f5c518f68c8178c2bad76c3_29194.jpg.jpeg" },
  { id:"door-folding", title:"Porta camarão articulada", badge:"ALUMÍNIO • ARTICULADA", line:"Gold", model:"Porta Camarão", color:"Bronze", panels:3, detail:"Folhas articuladas que recolhem lateralmente, ferragens e dobradiças para otimizar a passagem.", image:"https://images.unsplash.com/photo-1600607687644-c7171b42498f?auto=format&fit=crop&w=1400&q=90" },
  { id:"door-hinged", title:"Porta de giro", badge:"ALUMÍNIO • ABRIR", line:"Gold", model:"Porta de Giro", color:"Natural Fosco", panels:1, detail:"Folha de abrir com dobradiças, fechadura e puxador vertical, para acessos internos ou externos.", image:"https://images.unsplash.com/photo-1600607687644-c7171b42498f?auto=format&fit=crop&w=1400&q=88&sat=-15" },
  { id:"door-pivot", title:"Porta pivotante contemporânea", badge:"ALUMÍNIO • PIVOTANTE", line:"Gold", model:"Porta Pivotante", color:"Preto Fosco", panels:1, detail:"Abertura sobre eixo vertical, desenho imponente e acabamento de alto padrão para entrada principal.", image:"https://grandverre.fr/cdn/shop/products/6df68a90ebcbc8c543358a3b191f477c.jpg?v=1667964984&width=1445" },
  { id:"door-balcony", title:"Porta balcão panorâmica", badge:"ALUMÍNIO • PANORÂMICA", line:"Gold", model:"Porta Balcão", color:"Champagne", panels:3, detail:"Conjunto envidraçado para grandes vãos, luz natural e continuidade visual entre interior e exterior.", image:"https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1400&q=86&sat=-25" },
  { id:"door-entry", title:"Porta de entrada com vidro", badge:"ALUMÍNIO • ENTRADA", line:"Suprema", model:"Porta de Giro", color:"Amadeirado", panels:1, detail:"Composição de entrada com perfis de alumínio, vidro e puxador de presença arquitetônica.", image:"https://www.dmanbathroom.com/dmanbathroom/2024/02/22/5w8a6484-2.jpg&sat=-20" },
];


const allAluminumModels: ArchitecturalModel[] = [
  { id:"alu-porta-lambril", title:"Porta de alumínio tipo lambril", badge:"LINHA ALUMÍNIO • LAMBRIL", line:"Gold", model:"Porta Lambril", color:"Amadeirado", panels:1, detail:"Folha de alumínio com réguas tipo lambril, estrutura reforçada e opção de ventilação conforme projeto.", image:"https://images.unsplash.com/photo-1600607687644-c7171b42498f?auto=format&fit=crop&w=1400&q=88" },
  { id:"alu-porta-veneziana", title:"Porta veneziana de alumínio", badge:"LINHA ALUMÍNIO • VENEZIANA", line:"Suprema", model:"Porta Lambril", color:"Branco", panels:1, detail:"Porta com painéis venezianados para ventilação e privacidade, sob medida.", image:"https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1400&q=88" },
  { id:"alu-janela-veneziana", title:"Janela veneziana", badge:"LINHA ALUMÍNIO • VENEZIANA", line:"Suprema", model:"Janela Veneziana", color:"Branco", panels:3, detail:"Conjunto de folhas venezianadas e opção de vidro, conforme composição e ambiente.", image:"https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1400&q=88" },
  { id:"alu-painel-fixo", title:"Painel fixo de alumínio", badge:"LINHA ALUMÍNIO • FIXO", line:"Gold", model:"Painel Fixo", color:"Preto Fosco", panels:1, detail:"Painel fixo para fechamento, integração de fachadas e composição com portas e janelas.", image:"https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=88" },
  ...baseModels.map(item=>({...item,id:`alu-${item.id}`,badge:`LINHA ALUMÍNIO • ${item.badge.replace(/^Linha (Suprema|Gold) • /,"")}`})),
];
const showerBoxModels: ArchitecturalModel[] = [
  { id:"box-frontal-2", title:"Box frontal de correr · 2 folhas", badge:"BOX DE BANHO • FRONTAL", line:"Box", model:"Box de Banho", color:"Preto Fosco", panels:2, detail:"Box frontal com duas folhas deslizantes, roldanas e perfis de alumínio.", image:"https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=90" },
  { id:"box-frontal-3", title:"Box frontal de correr · 3 folhas", badge:"BOX DE BANHO • VÃO AMPLO", line:"Box", model:"Box de Banho", color:"Natural Fosco", panels:3, detail:"Composição de três folhas para vãos maiores, com trilhos e guias em alumínio.", image:"https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1400&q=90" },
  { id:"box-canto-l", title:"Box de canto em L", badge:"BOX DE BANHO • CANTO", line:"Box", model:"Box de Banho", color:"Preto Fosco", panels:2, detail:"Fechamento em duas faces para área de banho de canto, com encontro em esquadro.", image:"https://www.myhomeware.com.au/cdn/shop/files/685-1400mm-l-shape-frameless-shower-screen-hinge-door-fixed-panel-chrome-fittings-10mm-glass-screens-746.jpg?crop=center&height=1200&v=1725766243&width=1200" },
  { id:"box-ate-teto", title:"Box até o teto", badge:"BOX DE BANHO • PÉ-DIREITO", line:"Box", model:"Box de Banho", color:"Champagne", panels:2, detail:"Fechamento alto para projetos específicos, sujeito à avaliação de ventilação e ferragens.", image:"https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1400&q=90" },
  { id:"box-elegance", title:"Box com roldanas aparentes", badge:"BOX DE BANHO • ELEGANCE", line:"Box", model:"Box de Banho", color:"Preto Fosco", panels:2, detail:"Sistema com roldanas aparentes e estética contemporânea.", image:"https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1400&q=90" },
  { id:"box-articulado", title:"Box articulado", badge:"BOX DE BANHO • ARTICULADO", line:"Box", model:"Box de Banho", color:"Prata", panels:2, detail:"Folhas articuladas para espaços compactos, conforme ferragens compatíveis.", image:"https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=90" },
];
const productCollections = [
  { id:"vidro-aluminio", title:"Linha vidro + alumínio", description:"Portas, janelas e painéis envidraçados com perfis de alumínio. Reúne os modelos já existentes das linhas Suprema e Gold.", items:[...baseModels,...doorModels] },
  { id:"somente-aluminio", title:"Linha somente alumínio", description:"Portas lambril, venezianas, painéis e as tipologias existentes em composições sem vidro, conforme especificação.", items:allAluminumModels },
  { id:"box-banho", title:"Linha box de banho", description:"Modelos frontais, de canto, articulados e de correr, com opções de perfis e acabamentos.", items:showerBoxModels },
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
  const [activeCollection, setActiveCollection] = useState("vidro-aluminio");
  const [activeModelType, setActiveModelType] = useState("Todos");
  const track = useRef<HTMLDivElement>(null);
  const activeItems = useMemo(() => {
    const collection = productCollections.find(item => item.id === activeCollection) ?? productCollections[0];
    const sourceItems = activeCollection === "vidro-aluminio" ? [...generated, ...collection.items] : collection.items;
    const seenImages = new Set<string>();
    const uniqueImages = sourceItems.filter(item => {
      const imageKey = item.image.split("?")[0];
      if (seenImages.has(imageKey)) return false;
      seenImages.add(imageKey);
      return true;
    });
    if (activeModelType === "Todos") return uniqueImages;
    if (activeModelType === "Portas") return uniqueImages.filter(item => item.model.startsWith("Porta"));
    if (activeModelType === "Janelas") return uniqueImages.filter(item => item.model.startsWith("Janela") || item.model === "Maxim-Ar");
    if (activeModelType === "Box") return uniqueImages.filter(item => item.model === "Box de Banho");
    return uniqueImages.filter(item => item.model === "Painel Fixo");
  }, [activeCollection, activeModelType, generated]);

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
    <div className="amc-catalog-tabs" role="tablist" aria-label="Linhas de produtos">
      {productCollections.map(collection=><button key={collection.id} type="button" role="tab" aria-selected={activeCollection===collection.id} className={activeCollection===collection.id?"is-active":""} onClick={()=>{setActiveCollection(collection.id);setActiveModelType("Todos");track.current?.scrollTo({left:0});}}>{collection.title}</button>)}
    </div>
    <div className="amc-model-tabs" role="tablist" aria-label="Tipos de modelos">
      {["Todos","Portas","Janelas","Box","Painéis"].map(type=><button key={type} type="button" role="tab" aria-selected={activeModelType===type} className={activeModelType===type?"is-active":""} onClick={()=>setActiveModelType(type)}>{type}</button>)}
    </div>
    <div className="amc-selected-line">
      <div><span className="amc-kicker">CATÁLOGO / {productCollections.find(item=>item.id===activeCollection)?.title.toUpperCase()}</span><h3>{productCollections.find(item=>item.id===activeCollection)?.title}</h3><p>{productCollections.find(item=>item.id===activeCollection)?.description}</p></div>
      <span>{activeItems.length} MODELOS</span>
    </div>
    <div className="amc-product-line-grid amc-tabbed-grid" ref={track}>
      {activeItems.map(item=><article className="amc-line-card" key={item.id}>
        <button className="amc-line-image" type="button" onClick={()=>onView(item)} aria-label={`Abrir ${item.title} no visualizador 360 graus`}><img src={item.image} alt={item.title} loading="lazy"/><span>VER EM 360° ↗</span></button>
        <div className="amc-line-copy"><small>{item.badge}</small><h4>{item.title}</h4><p>{item.detail}</p><div><span>{item.line}</span><span>{item.color}</span><span>{item.panels} {item.panels===1?"folha":"folhas"}</span></div><button type="button" onClick={()=>onConfigure(item)}>Configurar modelo <MoveUpRight size={15}/></button></div>
      </article>)}
      {activeItems.length===0&&<p className="amc-empty-state">Nenhum modelo nesta categoria. Selecione outro tipo de modelo.</p>}
    </div>
    <p className="amc-disclaimer">Renders conceituais para referência visual. Perfis, componentes, ferragens, dimensões e desempenho dependem de especificação e validação técnica.</p>

  </section>;
}
