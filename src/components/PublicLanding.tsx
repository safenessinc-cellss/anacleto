import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, ChevronDown, Menu, MessageCircle, Move3D, RefreshCw, Sparkles, Upload, X } from "lucide-react";
import logo from "../assets/images/anacleto-logo-premium.svg";
import PublicAssemblyIntro from "./PublicAssemblyIntro";
import ArchitecturalModelsCarousel from "./ArchitecturalModelsCarousel";
import "./public-landing.css";

const LazyShowroom = lazy(() => import("./PublicShowroom3D"));
const phone = "5551998193931";
type Model = "Janela de Correr Suprema" | "Porta Balcão" | "Maxim-Ar" | "Porta Camarão";
type Config = { model: Model; line: "Suprema" | "Gold"; color: string; glass: string; width: number; height: number; panels: number };
const defaults: Config = { model: "Janela de Correr Suprema", line: "Suprema", color: "Preto Fosco", glass: "Incolor", width: 1600, height: 1200, panels: 2 };
const colors = [{name:"Preto Fosco",hex:"#202328"},{name:"Branco",hex:"#f2f3f3"},{name:"Bronze",hex:"#94704e"},{name:"Anodizado",hex:"#aeb8c1"},{name:"Champagne",hex:"#c6a77b"},{name:"Natural Fosco",hex:"#aeb6b9"},{name:"Amadeirado",hex:"#76543d"}];
const galleryModels = [{name:"Janela de correr 2 folhas",detail:"Clássica · sala e dormitório",model:"Janela de Correr Suprema" as Model,color:"Preto Fosco",panels:2},{name:"Janela de correr 4 folhas",detail:"Vão amplo · mais iluminação",model:"Janela de Correr Suprema" as Model,color:"Branco",panels:4},{name:"Porta balcão",detail:"Integração entre interior e varanda",model:"Porta Balcão" as Model,color:"Champagne",panels:2},{name:"Maxim-ar",detail:"Ventilação e abertura projetante",model:"Maxim-Ar" as Model,color:"Anodizado",panels:1},{name:"Porta camarão",detail:"Abertura articulada · otimiza espaço",model:"Porta Camarão" as Model,color:"Bronze",panels:3},{name:"Porta de correr ampla",detail:"Grandes vãos · fachada contemporânea",model:"Porta Balcão" as Model,color:"Amadeirado",panels:3}];
const glasses = ["Incolor","Fumê","Reflecta"];
const models: Model[] = ["Janela de Correr Suprema","Porta Balcão","Maxim-Ar","Porta Camarão"];
const wa = (message: string) => `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

function Preview({config,opened}:{config:Config;opened:boolean}) {
  const frame = colors.find(c=>c.name===config.color)?.hex ?? "#202328";
  const glass = config.glass==="Fumê"?"#526577":config.glass==="Reflecta"?"#c4a77b":"#a9d3e5";
  const roof = false;
  const fold = config.model==="Porta Camarão";
  return <svg className="iso-preview" viewBox="0 0 760 520" role="img" aria-label={`Modelo ${config.model}, alumínio ${config.color}, vidro ${config.glass}`}>
    <defs><linearGradient id="glassByYou" x1="0" y1="0" x2="1" y2="1"><stop stopColor={glass} stopOpacity=".9"/><stop offset="1" stopColor="#f7fbff" stopOpacity=".3"/></linearGradient><linearGradient id="metalByYou" x1="0" y1="0" x2="1" y2="1"><stop stopColor={frame}/><stop offset=".48" stopColor="#aab3ba"/><stop offset="1" stopColor={frame}/></linearGradient><filter id="softFloor"><feGaussianBlur stdDeviation="15"/></filter></defs>
    <ellipse cx="382" cy="440" rx="238" ry="27" fill="#17212b" opacity=".2" filter="url(#softFloor)"/>
    {roof ? <g transform="translate(0 24)"><path d="M142 180 493 105 631 180 278 255Z" fill="url(#metalByYou)" stroke="#dce4e9" strokeWidth="7"/><path d="M164 180 492 122 603 181 278 239Z" fill="url(#glassByYou)" stroke="#e9f0f4" strokeWidth="7"/>{[0,1,2,3,4].map(i=><path key={i} d={`M${180+i*83} 183 ${510+i*20} 135`} stroke={frame} strokeWidth="7"/>)}</g> : <g><path d="M150 115 490 54 620 126 277 196Z" fill="#dce5eb" opacity=".45"/><path d="M150 115 277 196 277 460 150 380Z" fill="url(#metalByYou)" stroke="#e4ebef" strokeWidth="6"/><path d="M166 132 260 192 260 435 166 376Z" fill="url(#glassByYou)" stroke="#d7e0e6" strokeWidth="8"/><path d="M277 196 604 128 604 390 277 460Z" fill="url(#metalByYou)" stroke="#e4ebef" strokeWidth="6"/><path d="M293 210 438 180 438 430 293 459Z" fill="url(#glassByYou)" stroke="#e5edf2" strokeWidth="7" transform={opened?"translate(-24 0)":undefined}/><path d="M455 177 588 149 588 393 455 421Z" fill="url(#glassByYou)" stroke="#e5edf2" strokeWidth="7" transform={opened?"translate(24 0)":undefined}/><path d="M438 180 455 177 455 421 438 430Z" fill="url(#metalByYou)"/>{fold&&<path d={opened?"M438 180 455 177 492 420 475 425Z":"M438 180 455 177 455 421 438 430Z"} fill="url(#metalByYou)"/>}<path d="M306 230 421 206M470 194 573 173" stroke="#fff" strokeWidth="4" opacity=".55"/></g>}
    <text x="380" y="493" textAnchor="middle" fill="#61717e" fontSize="13" fontFamily="monospace">{config.width} × {config.height} mm · ESTUDO CONCEITUAL</text>
  </svg>;
}


function ExplodedWindow() {
  return <svg className="exploded-window" viewBox="0 0 920 650" role="img" aria-label="Vista técnica explotada de una ventana corrediza de aluminio, con perfiles, hojas, vidrio, rieles y herrajes separados">
    <defs>
      <linearGradient id="expAluminium" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f4f7fa"/><stop offset=".22" stopColor="#8795a4"/><stop offset=".48" stopColor="#e7edf2"/><stop offset=".7" stopColor="#697887"/><stop offset="1" stopColor="#dce4eb"/></linearGradient>
      <linearGradient id="expDarkMetal" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#151e2a"/><stop offset=".45" stopColor="#5e7185"/><stop offset=".7" stopColor="#1b2a3a"/><stop offset="1" stopColor="#aebdca"/></linearGradient>
      <linearGradient id="expGlass" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#bce9ff" stopOpacity=".12"/><stop offset=".38" stopColor="#9bd7fa" stopOpacity=".42"/><stop offset=".7" stopColor="#d9f3ff" stopOpacity=".13"/><stop offset="1" stopColor="#5eb7f0" stopOpacity=".28"/></linearGradient>
      <linearGradient id="expBlue" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#4a9fff" stopOpacity="0"/><stop offset=".5" stopColor="#68bdff"/><stop offset="1" stopColor="#4a9fff" stopOpacity="0"/></linearGradient>
      <filter id="expGlow"><feGaussianBlur stdDeviation="13"/></filter>
      <filter id="expShadow"><feGaussianBlur stdDeviation="9"/></filter>
    </defs>
    <ellipse cx="470" cy="540" rx="310" ry="34" fill="#000" opacity=".28" filter="url(#expShadow)"/>
    <ellipse cx="470" cy="330" rx="300" ry="210" fill="#2e8edc" opacity=".11" filter="url(#expGlow)"/>
    <path d="M110 320H820M160 170L750 480M190 520L760 190" stroke="#75bfff" strokeOpacity=".12" strokeDasharray="3 12"/>
    <g opacity=".95">
      <path d="M170 155 565 82 565 438 170 511Z" fill="none" stroke="url(#expAluminium)" strokeWidth="24" strokeLinejoin="round"/>
      <path d="M170 155 565 82 565 438 170 511Z" fill="none" stroke="#f6fbff" strokeOpacity=".7" strokeWidth="2"/>
      <path d="M193 174 544 110 544 419 193 483Z" fill="none" stroke="#6c7e8d" strokeWidth="5"/>
      <path d="M180 146 565 75 585 90 199 164Z" fill="url(#expAluminium)" stroke="#dce5ec" strokeWidth="2"/>
      <path d="M565 82 585 96 585 452 565 438Z" fill="url(#expDarkMetal)" stroke="#b9c7d3" strokeWidth="2"/>
      <path d="M170 155 190 168 190 526 170 511Z" fill="url(#expDarkMetal)" stroke="#b9c7d3" strokeWidth="2"/>
    </g>
    <g transform="translate(55 -6)">
      <path d="M285 170 620 108 620 414 285 476Z" fill="url(#expGlass)" stroke="#a8ddff" strokeWidth="2"/>
      <path d="M302 186 603 130 603 398 302 454Z" fill="none" stroke="#e3f6ff" strokeOpacity=".75" strokeWidth="3"/>
      <path d="M325 210 580 162" stroke="#fff" strokeOpacity=".5" strokeWidth="3"/>
      <path d="M325 210 325 424" stroke="#fff" strokeOpacity=".25" strokeWidth="2"/>
    </g>
    <g transform="translate(112 20)">
      <path d="M300 150 630 89 630 397 300 458Z" fill="none" stroke="url(#expAluminium)" strokeWidth="16" strokeLinejoin="round"/>
      <path d="M316 165 614 110 614 383 316 438Z" fill="none" stroke="#eaf1f7" strokeOpacity=".7" strokeWidth="3"/>
      <path d="M300 150 316 165M630 89 614 110M630 397 614 383M300 458 316 438" stroke="#fff" strokeOpacity=".85" strokeWidth="3"/>
      <path d="M472 120 472 411" stroke="#d5e1e9" strokeWidth="8"/>
    </g>
    <g transform="translate(0 0)">
      <path d="M230 550 670 468" stroke="url(#expAluminium)" strokeWidth="18" strokeLinecap="round"/>
      <path d="M248 573 688 491" stroke="#9db0bf" strokeWidth="7" strokeLinecap="round"/>
      <path d="M245 540 245 560M650 465 650 486" stroke="#e7edf2" strokeWidth="6"/>
    </g>
    <g transform="translate(705 245) rotate(-10)">
      <rect x="0" y="0" width="24" height="94" rx="7" fill="url(#expDarkMetal)" stroke="#d8e3eb" strokeWidth="2"/>
      <rect x="8" y="12" width="8" height="69" rx="4" fill="#dbe5ed"/>
      <circle cx="12" cy="10" r="3" fill="#fff"/><circle cx="12" cy="84" r="3" fill="#fff"/>
    </g>
    <g fill="#d9e8f3" stroke="#7893a8" strokeWidth="2">
      <circle cx="688" cy="170" r="7"/><circle cx="710" cy="190" r="5"/><circle cx="732" cy="210" r="4"/>
      <circle cx="760" cy="360" r="6"/><circle cx="786" cy="382" r="4"/><circle cx="130" cy="250" r="5"/>
      <circle cx="145" cy="275" r="4"/><circle cx="158" cy="300" r="3"/>
    </g>
    <g stroke="#68baff" strokeWidth="1.5" fill="none" opacity=".85">
      <path d="M220 125 122 83 70 83"/><path d="M650 108 760 64 830 64"/><path d="M710 290 825 290 855 265"/>
      <path d="M260 550 165 602 92 602"/><path d="M510 480 565 585 680 585"/>
    </g>
    <g fill="#b8dfff" fontFamily="monospace" fontSize="12" letterSpacing="2">
      <text x="26" y="74">PERFIL EXTERNO</text><text x="735" y="54">VIDRO TÉCNICO</text>
      <text x="800" y="252">PUXADOR</text><text x="24" y="625">TRILHO INFERIOR</text>
      <text x="685" y="610">FOLHA MÓVEL</text>
    </g>
    <path d="M80 330H840" stroke="url(#expBlue)" strokeWidth="2" opacity=".55"/>
  </svg>;
}

export default function PublicLanding() {
  const [config,setConfig] = useState<Config>(defaults);
  const [introSeen,setIntroSeen] = useState(()=>{try{return sessionStorage.getItem("anacleto-assembly-seen")==="1";}catch{return false;}});
  const [introKey,setIntroKey] = useState(0);
  const [visualPrompt,setVisualPrompt] = useState("");
  const [referenceImage,setReferenceImage] = useState<string|undefined>();
  const [referenceName,setReferenceName] = useState("");
  const [renderImage,setRenderImage] = useState("");
  const [renderFallback,setRenderFallback] = useState(false);
  const [renderMessage,setRenderMessage] = useState("");
  const [renderLoading,setRenderLoading] = useState(false);
  const [opened,setOpened] = useState(false);
  const [menuOpen,setMenuOpen] = useState(false);
  const [faqOpen,setFaqOpen] = useState<number|null>(0);
  const [show3D,setShow3D] = useState(false);
  const viewerRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const finishIntro = useCallback(()=>{try{sessionStorage.setItem("anacleto-assembly-seen","1");}catch{}setIntroSeen(true);},[]);
  const replayIntro = ()=>{setIntroSeen(false);setIntroKey(k=>k+1);};
  const handleReference = (file?:File)=>{if(!file){setReferenceImage(undefined);setReferenceName("");return;}if(!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>3*1024*1024){setRenderMessage("Envie uma imagem PNG, JPG ou WebP de até 3 MB.");return;}const reader=new FileReader();reader.onload=()=>{setReferenceImage(String(reader.result));setReferenceName(file.name);setRenderMessage("");};reader.readAsDataURL(file);};
  const generateArchitecturalView = async()=>{if(visualPrompt.trim().length<8){setRenderMessage("Descreva o ambiente e a esquadria desejada.");return;}setRenderLoading(true);setRenderMessage("");setRenderImage("");try{const response=await fetch("/api/public/architectural-visualization",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({description:visualPrompt,referenceImage})});const data=await response.json();if(!response.ok)throw new Error(data.error||"Não foi possível gerar a visualização.");if(data.image){setRenderImage(data.image);setRenderFallback(Boolean(data.fallback));setRenderMessage(data.message||"Visualização pronta.");}else throw new Error(data.error||"O serviço não retornou uma imagem.");}catch(error){setRenderMessage(error instanceof Error?error.message:"Serviço temporariamente indisponível.");}finally{setRenderLoading(false);}};
  useEffect(()=>{const node=viewerRef.current;if(!node)return;if(!("IntersectionObserver" in window)){setShow3D(true);return;}const io=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setShow3D(true);io.disconnect();}},{rootMargin:"280px"});io.observe(node);return()=>io.disconnect();},[]);
  const update=<K extends keyof Config>(key:K,value:Config[K])=>setConfig(c=>({...c,[key]:value}));
  const message = useMemo(()=>`Olá, Anacleto! Quero desenvolver este projeto sob medida:
Modelo: ${config.model}
Linha: ${config.line}
Acabamento do alumínio: ${config.color}
Vidro: ${config.glass}
Dimensões de referência: ${config.width} mm (largura) × ${config.height} mm (altura).
Gostaria de agendar uma avaliação e medição técnica. Não considerar preço nesta configuração visual.`,[config]);
  const faqs = [
    ["Como funciona o configurador Anacleto By You?","A visualização permite explorar tipologias, acabamentos e vidros como referência inicial. A solução final depende da medição técnica, das condições da obra e da especificação aprovada."],
    ["Qual a diferença entre as linhas Suprema e Gold?","A indicação depende das dimensões, da tipologia, do uso e do desempenho esperado. Nossa equipe avalia o vão e o projeto para recomendar o sistema adequado."],
    ["Quais opções de vidro estão disponíveis?","Trabalhamos com diferentes composições, como vidro incolor, fumê, refletivo e laminado acústico, conforme aplicação, segurança e requisitos técnicos."],
    ["A Anacleto atende projetos sob medida?","Sim. Cada projeto é desenvolvido considerando arquitetura, medidas, acabamento, ferragens, instalação e necessidades específicas do ambiente."]
  ];
  const businessSchema={"@context":"https://schema.org","@type":"HomeAndConstructionBusiness","name":"Anacleto Esquadrias","url":"https://anacletoesquadrias.com.br/","telephone":"+55 51 99819-3931","address":{"@type":"PostalAddress","streetAddress":"Av. Caxias do Sul, 1069, Rio dos Sinos","addressLocality":"São Leopoldo","addressRegion":"RS","addressCountry":"BR"},"areaServed":{"@type":"AdministrativeArea","name":"São Leopoldo e região, Rio Grande do Sul, Brasil"},"description":"Esquadrias de alumínio, portas, janelas, coberturas de vidro e vidraçaria sob medida.","creator":{"@type":"Organization","name":"Safeness.inc"}};
  const faqSchema={"@context":"https://schema.org","@type":"FAQPage","mainEntity":faqs.map(([q,a])=>({"@type":"Question",name:q,acceptedAnswer:{"@type":"Answer",text:a}}))};
  const nav=[["Início","#inicio"],["Modelos","#modelos"],["Projetos","#showroom"],["Sobre Nós","#engenharia"],["Contato","#contato"]];
  return <div className="public-site nike-site">
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(businessSchema)}}/><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(faqSchema)}}/>
    <header className="site-header site-header-glass">
      <a href="#inicio" className="brand" aria-label="Anacleto Esquadrias"><img src={logo} alt="Anacleto Esquadrias" width="1200" height="600"/></a>
      <nav className={menuOpen?"site-nav is-open":"site-nav"} aria-label="Navegação principal">{nav.map(([label,href])=><a key={href} href={href} onClick={()=>setMenuOpen(false)}>{label}</a>)}</nav>
      <div className="header-actions">
        <a className="button dashboard-access" href="/gestao/" aria-label="Acessar área restrita do Dashboard">Área Restrita <ArrowUpRight size={15}/></a>
        <a className="button button-primary header-cta" href={wa("Olá! Gostaria de solicitar um orçamento com a Anacleto Esquadrias.")} target="_blank" rel="noreferrer">Solicitar Orçamento <ArrowUpRight size={16}/></a>
      </div>
      <button className="mobile-toggle" onClick={()=>setMenuOpen(v=>!v)} aria-label={menuOpen?"Fechar menu":"Abrir menu"}>{menuOpen?<X/>:<Menu/>}</button>
    </header>
    <main id="inicio">
      <section className="exploded-hero">
        <div className="exploded-hero-grid"/>
        <div className="exploded-copy">
          <span className="exploded-kicker"><i/> ANACLETO ESQUADRIAS <b>·</b> ENGENHARIA DE PRECISÃO</span>
          <h1>Qualidade que se vê em cada <em>detalhe.</em></h1>
          <p>Esquadrias de alumínio de alto padrão, com tecnologia, design e durabilidade para o seu projeto.</p>
          <div className="exploded-actions">
            <a className="button button-primary" href="#showroom">Explore em 3D <Move3D size={17}/></a>
            <a className="exploded-secondary" href={wa("Olá! Gostaria de solicitar um orçamento para meu projeto.")} target="_blank" rel="noreferrer">Solicitar orçamento <ArrowUpRight size={16}/></a>
          </div>
          <div className="exploded-proof"><span><b>01</b> DESIGN SOB MEDIDA</span><i/><span><b>02</b> PRECISÃO TÉCNICA</span></div>
        </div>
        <div className="exploded-stage">
          <div className="exploded-stage-label"><span>ANATOMIA DE UMA ESQUADRIA</span><span>01 — 04 / SISTEMA CORREDIÇO</span></div>
          <div className="exploded-art"><ExplodedWindow/></div>
          <div className="exploded-360"><span className="exploded-360-icon"><Move3D size={23}/></span><b>360°</b><span>Gire e explore</span><small>VISUALIZAÇÃO TÉCNICA</small></div>
          <div className="exploded-coordinate">ALUMÍNIO <i/> VIDRO <i/> ENGENHARIA</div>
        </div>
        <div className="exploded-scroll"><span/> ROLE PARA EXPLORAR</div>
      </section>
      <section className="benefit-strip" aria-label="Diferenciais Anacleto">
        <article><span className="benefit-icon">◇</span><div><b>Design moderno</b><small>Linhas que valorizam a arquitetura</small></div></article>
        <article><span className="benefit-icon">⌁</span><div><b>Alta durabilidade</b><small>Materiais e acabamentos selecionados</small></div></article>
        <article><span className="benefit-icon">＋</span><div><b>Precisão na fabricação</b><small>Detalhes pensados sob medida</small></div></article>
        <article><span className="benefit-icon">↗</span><div><b>Responsabilidade</b><small>Eficiência e escolhas conscientes</small></div></article>
      </section>
      <section className="aluminum-gallery section-wrap" id="modelos"><div className="gallery-heading"><div><span className="eyebrow">COLEÇÃO ANACLETO · ALUMÍNIO</span><h2>Portas e janelas para cada arquitetura.</h2></div><p>Explore diferentes tipologias, configurações de folhas e acabamentos de alumínio. Selecione um modelo para abrir sua configuração no estúdio.</p></div><div className="aluminum-gallery-grid">{galleryModels.map((item,i)=><button className="aluminum-model-card" key={item.name} onClick={()=>{setConfig(c=>({...c,model:item.model,color:item.color,panels:item.panels,line:i===2||i===3||i===5?"Gold":"Suprema"}));document.getElementById("showroom")?.scrollIntoView({behavior:"smooth",block:"start"});}}><span className="gallery-index">0{i+1} / ALUMÍNIO</span><svg viewBox="0 0 300 220" role="img" aria-label={item.name}><defs><linearGradient id={`gallery-glass-${i}`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#dceef4"/><stop offset="1" stopColor="#8faebd"/></linearGradient><linearGradient id={`gallery-metal-${i}`}><stop stopColor={colors.find(c=>c.name===item.color)?.hex||"#222"}/><stop offset=".5" stopColor="#c5cbd0"/><stop offset="1" stopColor={colors.find(c=>c.name===item.color)?.hex||"#222"}/></linearGradient></defs><ellipse cx="150" cy="194" rx="100" ry="8" fill="#202830" opacity=".12"/><rect x="53" y="20" width="194" height="166" rx="2" fill={`url(#gallery-metal-${i})`}/><rect x="62" y="29" width="176" height="148" fill={`url(#gallery-glass-${i})`}/>{Array.from({length:item.panels},(_,j)=><g key={j}><rect x={64+j*174/item.panels} y="31" width={172/item.panels} height="144" fill={`url(#gallery-glass-${i})`} stroke={colors.find(c=>c.name===item.color)?.hex||"#222"} strokeWidth="4"/><path d={`M${70+j*174/item.panels} 38 l${45/item.panels} 0  ${-35/item.panels} 128`} stroke="#fff" strokeWidth="2" opacity=".22"/></g>)}<path d="M53 186h194" stroke="#89949b" strokeWidth="5"/></svg><div className="gallery-card-copy"><div><h3>{item.name}</h3><p>{item.detail}</p></div><span className="gallery-swatch" style={{background:colors.find(c=>c.name===item.color)?.hex}} title={item.color}/></div><span className="gallery-finish">ACABAMENTO · {item.color.toUpperCase()}</span></button>)}</div><div className="gallery-footnote">Imagens ilustrativas de sistemas em alumínio. Tipologias, perfis, dimensões, ferragens e cores disponíveis são confirmados conforme projeto e linha técnica.</div></section>
      <ArchitecturalModelsCarousel onConfigure={(item)=>{setConfig(c=>({...c,model:item.model,line:item.line,color:item.color,panels:item.panels}));document.getElementById("showroom")?.scrollIntoView({behavior:"smooth",block:"start"});}} />
      <section className="showroom-section section-wrap" id="showroom"><div className="section-heading"><div><span className="eyebrow">NIKE BY YOU · ANACLETO EDITION</span><h2>Crie sua combinação.</h2></div><p>Escolha a tipologia, defina o acabamento e visualize uma proposta inicial. A configuração será enviada à nossa equipe sem exibir preços.</p></div>
        <div className="showroom-grid"><div className="viewer-panel" ref={viewerRef}><div className="viewer-toolbar"><span><i/> ESTÚDIO 3D / AO VIVO</span><span>ARRASTE PARA GIRAR 360°</span></div>{show3D?<Suspense fallback={<div className="viewer-fallback"><Preview config={config} opened={opened}/><span>Preparando o estúdio 3D…</span></div>}><LazyShowroom config={config} opened={opened}/></Suspense>:<div className="viewer-fallback"><Preview config={config} opened={opened}/><span>Prévia instantânea · 3D sob demanda</span></div>}<div className="viewer-footer"><span>{config.model}</span><span>{config.color} / {config.glass}</span></div></div>
          <aside className="config-panel"><div className="config-top"><span>PERSONALIZAÇÃO DO PRODUTO</span><Move3D size={18}/></div><label className="field-label">01 / ESCOLHA A SILHUETA</label><div className="model-options">{models.map((m,i)=><button key={m} className={config.model===m?"model-option selected":"model-option"} onClick={()=>update("model",m)}><span>0{i+1}</span>{m}<ArrowUpRight size={14}/></button>)}</div>
            <label className="field-label">02 / ACABAMENTO DO ALUMÍNIO</label><div className="swatch-row">{colors.map(c=><button key={c.name} className={config.color===c.name?"swatch active":"swatch"} onClick={()=>update("color",c.name)} aria-label={c.name} title={c.name}><i style={{background:c.hex}}/><span>{c.name}</span></button>)}</div>
            <div className="config-two"><label>LINHA DE PERFIL<select value={config.line} onChange={e=>update("line",e.target.value as Config["line"])}><option>Suprema</option><option>Gold</option></select></label><label>TIPO DE VIDRO<select value={config.glass} onChange={e=>update("glass",e.target.value)}>{glasses.map(g=><option key={g}>{g}</option>)}</select></label></div>
            <div className="config-two"><label>LARGURA (MM)<input type="number" min="300" max="8000" step="50" value={config.width} onChange={e=>update("width",Math.max(300,Math.min(8000,Number(e.target.value)||300)))}/></label><label>ALTURA (MM)<input type="number" min="300" max="6000" step="50" value={config.height} onChange={e=>update("height",Math.max(300,Math.min(6000,Number(e.target.value)||300)))}/></label></div>
            <button className="button button-outline open-button" onClick={()=>setOpened(v=>!v)}><Move3D size={16}/>{opened?"Fechar esquadria":"Testar Abertura"}</button><a className="button button-primary full-button" href={wa(message)} target="_blank" rel="noreferrer"><MessageCircle size={17}/> Solicitar Orçamento deste Projeto no WhatsApp <ArrowUpRight size={16}/></a><small className="config-note">Configuração conceitual, sujeita à validação de medidas e especificação técnica. Sem preços online.</small>
          </aside></div>
      </section>
      <section className="ai-visual-section section-wrap" id="visualizacao-ia"><div className="ai-visual-heading"><div><span className="eyebrow">VISUALIZAÇÃO ARQUITETÔNICA</span><h2>Imagine antes de construir.</h2><p>Descreva sua ideia ou envie uma foto da obra. A visualização ajuda a explorar possibilidades — a especificação final é validada pela equipe técnica.</p></div><div className="ai-mark"><Sparkles size={22}/><span>STUDIO<br/>VISUAL</span></div></div><div className="ai-visual-card"><div className="ai-visual-form"><label htmlFor="visual-prompt">DESCREVA SUA ESQUADRIA E O AMBIENTE</label><textarea id="visual-prompt" value={visualPrompt} onChange={e=>setVisualPrompt(e.target.value)} placeholder="Ex.: janela de correr com perfis pretos e vidro fumê em uma sala com fachada contemporânea..." rows={5}/><div className="ai-upload-row"><label className="upload-trigger"><Upload size={16}/><span>{referenceName||"Adicionar foto da obra (opcional)"}</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>handleReference(e.target.files?.[0])}/></label>{referenceName&&<button className="remove-upload" onClick={()=>handleReference(undefined)}>Remover</button>}</div><button className="button button-primary ai-generate" onClick={generateArchitecturalView} disabled={renderLoading}><Sparkles size={17}/>{renderLoading?"Criando visualização…":"Visualizar no Ambiente com IA"}<ArrowUpRight size={16}/></button><p className="ai-disclaimer">A imagem é conceitual e não substitui projeto executivo, medição ou validação estrutural.</p>{renderMessage&&<p className={renderFallback?"ai-status fallback":"ai-status"}>{renderMessage}</p>}</div><div className="ai-result">{renderImage?<><img src={renderImage} alt="Visualização arquitetônica da esquadria solicitada"/>{renderFallback&&<span className="ai-result-tag">PRÉVIA VETORIAL LOCAL</span>}</>:<div className="ai-result-empty"><div className="ai-window-glyph"><i/><i/><i/><i/></div><span>SUA IDEIA, EM CONTEXTO ARQUITETÔNICO</span><small>O resultado aparecerá aqui</small></div>}</div></div></section>
      <section className="engineering-section" id="engenharia"><div className="section-wrap"><div className="section-heading"><div><span className="eyebrow">ENGENHARIA QUE VOCÊ SENTE</span><h2>Performance em cada detalhe.</h2></div><p>Estética limpa por fora. Engenharia e cuidado em cada componente.</p></div><div className="bento-grid"><article className="bento-card bento-dark"><span>01 / CONFORTO</span><div className="bento-icon">◌</div><h3>Isolamento acústico de alta performance.</h3><p>Composições de vidro e sistemas de vedação avaliados conforme cada ambiente.</p></article><article className="bento-card bento-image"><span>02 / PROTEÇÃO</span><h3>Vedação contra chuva e vento.</h3><p>Encaixes, escovas e instalação pensados para o desempenho do conjunto.</p></article><article className="bento-card bento-line"><span>03 / SISTEMAS</span><h3>Perfis Suprema & Gold.</h3><p>Linhas para diferentes escalas, vãos e linguagens arquitetônicas.</p></article><article className="bento-card bento-glass"><span>04 / MATERIALIDADE</span><h3>Vidros temperados e laminados.</h3><p>Especificação conforme aplicação, segurança e normas pertinentes.</p></article></div></div></section>
      <section className="lines-section section-wrap" id="linhas"><div className="lines-copy"><span className="eyebrow">DO CONCEITO À INSTALAÇÃO</span><h2>Precisão em quatro movimentos.</h2></div><div className="process-grid">{[["01","Projeto 3D","Visualização e definição da solução."],["02","Fabricação Própria","Componentes preparados sob medida."],["03","Instalação Precisa","Montagem técnica e cuidado com a obra."],["04","Pós-Venda Garantido","Orientação e suporte após a entrega."]].map(([n,t,d])=><article key={n}><span>{n}</span><h3>{t}</h3><p>{d}</p></article>)}</div></section>
      <section className="faq-section" id="contato"><div className="section-wrap faq-layout"><div><span className="eyebrow">FAQ / ANACLETO</span><h2>Boas escolhas começam com boas respostas.</h2><p>Converse com nossa equipe para transformar a referência visual em um projeto real.</p><a className="button button-primary" href={wa("Olá! Quero conversar sobre meu projeto com a Anacleto Esquadrias.")} target="_blank" rel="noreferrer">Falar com a Anacleto <ArrowUpRight size={16}/></a></div><div className="faq-list">{faqs.map(([q,a],i)=><article className={faqOpen===i?"faq-item active":"faq-item"} key={q}><button onClick={()=>setFaqOpen(faqOpen===i?null:i)} aria-expanded={faqOpen===i}><span>{q}</span><ChevronDown size={19}/></button>{faqOpen===i&&<p>{a}</p>}</article>)}</div></div></section>
    </main><footer className="site-footer"><span>Desenvolvido por Safeness.inc</span></footer>
  </div>;
}
