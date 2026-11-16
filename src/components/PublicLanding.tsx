import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Check, ChevronDown, Menu, MessageCircle, Move3D, Ruler, ShieldCheck, Sparkles, X } from "lucide-react";
import logo from "../assets/images/anacleto-logo-premium.svg";
import "./public-landing.css";

const LazyShowroom = lazy(() => import("./PublicShowroom3D"));
const phone = "5551998193931";
type Model = "Janela de Correr" | "Porta Balcão" | "Maxim-Ar" | "Porta Camarão" | "Cobertura de Vidro";
type Config = { model: Model; line: "Suprema" | "Gold"; color: string; glass: string; width: number; height: number };
const defaults: Config = { model: "Janela de Correr", line: "Suprema", color: "Preto Fosco", glass: "Incolor", width: 1600, height: 1200 };
const wa = (message: string) => `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

function Preview({ config, opened }: { config: Config; opened: boolean }) {
  const frame = config.color === "Branco" ? "#e9edf2" : config.color === "Bronze" ? "#9a7048" : config.color === "Anodizado" ? "#aeb8c2" : "#202833";
  const glass = config.glass === "Fumê" ? "#526577" : config.glass === "Verde" ? "#71988d" : config.glass === "Reflecta" ? "#9db9c9" : "#a9d3e5";
  return <svg className="iso-preview" viewBox="0 0 720 520" role="img" aria-label={`Prévia isométrica de ${config.model} em alumínio ${config.color} e vidro ${config.glass}`}>
    <defs><linearGradient id="pane" x1="0" y1="0" x2="1" y2="1"><stop stopColor={glass} stopOpacity=".82"/><stop offset="1" stopColor="#e5f7ff" stopOpacity=".26"/></linearGradient><linearGradient id="metal" x1="0" y1="0" x2="1" y2="1"><stop stopColor={frame}/><stop offset=".5" stopColor="#8996a3"/><stop offset="1" stopColor={frame}/></linearGradient><filter id="shadow"><feGaussianBlur stdDeviation="13"/></filter></defs>
    <ellipse cx="365" cy="440" rx="230" ry="28" fill="#071522" opacity=".14" filter="url(#shadow)"/>
    <path d="M145 115 490 54 615 125 268 193Z" fill="#dce5eb" opacity=".45"/><path d="M268 193 615 125 615 407 268 475Z" fill="#d3e0e8" opacity=".16"/>
    <path d="M145 115 268 193 268 475 145 395Z" fill="url(#metal)" stroke="#d4dde5" strokeWidth="5"/>
    <path d="M160 130 254 190 254 452 160 391Z" fill="url(#pane)" stroke="#c5d1da" strokeWidth="8"/>
    <path d="M254 190 599 123 599 389 254 452Z" fill="url(#metal)" stroke="#cbd5df" strokeWidth="6"/>
    <path d="M274 205 430 175 430 422 274 452Z" transform={opened ? "translate(-22 0)" : undefined} fill="url(#pane)" stroke="#dce7ee" strokeWidth="7"/>
    <path d="M447 172 584 145 584 391 447 418Z" transform={opened ? "translate(22 0)" : undefined} fill="url(#pane)" stroke="#dce7ee" strokeWidth="7"/>
    <path d="M430 175 447 172 447 418 430 422Z" fill="url(#metal)"/><path d="M160 130 254 190 254 452 160 391Z" fill="none" stroke="#f7fbff" strokeWidth="3" opacity=".7"/>
    <path d="M286 223 418 197M460 191 572 169" stroke="#fff" strokeWidth="4" opacity=".42"/><path d="M250 460 602 394" stroke="#687989" strokeWidth="3" opacity=".55"/>
    <g fill="#637889" fontSize="13" fontFamily="monospace"><text x="365" y="500" textAnchor="middle">VISTA ISOMÉTRICA · ${config.width} × ${config.height} mm</text></g>
  </svg>;
}

export default function PublicLanding() {
  const [config, setConfig] = useState<Config>(defaults);
  const [opened, setOpened] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [faqOpen, setFaqOpen] = useState<number | null>(0);
  const viewerRef = useRef<HTMLDivElement>(null);
  const [show3D, setShow3D] = useState(false);
  useEffect(() => {
    const target = viewerRef.current;
    if (!target) return;
    if (!("IntersectionObserver" in window)) { setShow3D(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setShow3D(true);
        observer.disconnect();
      }
    }, { rootMargin: "240px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);
  const message = useMemo(() => `Olá, Anacleto! Gostaria de solicitar um orçamento para este modelo:\nModelo: ${config.model}\nLinha: ${config.line}\nCor do alumínio: ${config.color}\nVidro: ${config.glass}\nMedidas: ${config.width} mm (largura) × ${config.height} mm (altura).\nAguardo o contato para medição e orientação técnica.`, [config]);
  const set = <K extends keyof Config>(key: K, value: Config[K]) => setConfig(c => ({ ...c, [key]: value }));
  const nav = [["Showroom 3D","#showroom"],["Soluções","#solucoes"],["Obras","#obras"],["Processo","#processo"],["FAQ","#faq"]];
  const faqs = [
    ["Qual linha é indicada: Suprema ou Gold?", "A escolha depende da tipologia, das dimensões, do desempenho esperado e do projeto. A linha Suprema atende diversas aplicações residenciais; a linha Gold pode ser indicada para soluções de maior robustez. Nossa equipe orienta a especificação após avaliar o vão e o uso."],
    ["O vidro ajuda no isolamento acústico?", "Sim. A composição do vidro, a vedação, o sistema de abertura e a instalação influenciam o desempenho acústico. Para maior conforto, avaliamos opções como vidro laminado acústico e a solução adequada ao ambiente."],
    ["Como funciona o prazo de fabricação e instalação?", "O prazo é informado após a medição técnica, definição dos materiais, aprovação do projeto e confirmação da programação de fabricação. Cada obra recebe um cronograma conforme sua complexidade."],
    ["É possível solicitar um projeto sob medida?", "Sim. Desenvolvemos soluções conforme as medidas do local, arquitetura, acabamento e necessidade de cada cliente. A configuração 3D desta página é uma referência visual inicial, sujeita à validação técnica."],
    ["Como fazer a limpeza e manutenção?", "Utilize pano macio, água e detergente neutro. Evite produtos abrasivos, solventes e objetos que possam riscar o acabamento ou o vidro. A limpeza periódica dos trilhos e a inspeção das ferragens ajudam a preservar o funcionamento."]
  ];
  const schema = { "@context":"https://schema.org", "@type":"HomeAndConstructionBusiness", name:"Anacleto Esquadrias", url:"https://anacletoesquadrias.com.br/", image:"https://anacletoesquadrias.com.br/og-anacleto.jpg", telephone:"+55 51 99819-3931", address:{ "@type":"PostalAddress", addressLocality:"São Leopoldo", addressRegion:"RS", addressCountry:"BR" }, areaServed:{ "@type":"AdministrativeArea", name:"São Leopoldo e região, Rio Grande do Sul, Brasil" }, description:"Esquadrias de alumínio, portas, janelas, vidraçaria e projetos sob medida.", makesOffer:["Esquadrias de Alumínio","Vidraçaria","Portas e Janelas de Alumínio","Coberturas e Tetos de Vidro","Fechamento de Sacadas","Box e Espelhos Sob Medida"].map(name=>({ "@type":"Offer", itemOffered:{ "@type":"Service", name }})), founder:{ "@type":"Organization", name:"Anacleto Esquadrias" }, provider:{ "@type":"Organization", name:"Anacleto Esquadrias" }, creator:{ "@type":"Organization", name:"Safeness.inc" } };
  const faqSchema = { "@context":"https://schema.org", "@type":"FAQPage", mainEntity:faqs.map(([q,a])=>({ "@type":"Question", name:q, acceptedAnswer:{ "@type":"Answer", text:a }})) };
  return <div className="public-site">
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(faqSchema)}} />
    <header className="site-header"><a href="#inicio" className="brand" aria-label="Anacleto Esquadrias - início"><img src={logo} alt="Logotipo Anacleto Esquadrias" width="1200" height="600" /></a><button className="mobile-toggle" onClick={()=>setMobileMenu(v=>!v)} aria-label="Abrir menu">{mobileMenu?<X/>:<Menu/>}</button><nav className={mobileMenu?"site-nav is-open":"site-nav"}>{nav.map(([label,href])=><a key={href} href={href} onClick={()=>setMobileMenu(false)}>{label}</a>)}</nav><a className="button button-primary header-cta" href={wa("Olá! Gostaria de solicitar um orçamento com a Anacleto Esquadrias.")} target="_blank" rel="noreferrer"><MessageCircle size={17}/> Pedir Orçamento</a></header>
    <main>
      <section className="hero-section" id="inicio"><div className="hero-copy"><div className="eyebrow"><span/> ENGENHARIA · DESIGN · PRECISÃO</div><h1>Esquadrias de Alumínio e Vidraçaria Sob Medida com Design Arquitetônico</h1><p className="hero-lead">Soluções em alumínio e vidro que valorizam a arquitetura, ampliam a luz natural e entregam conforto para cada ambiente.</p><div className="hero-actions"><a className="button button-primary" href="#showroom">Explorar Showroom 3D <ArrowUpRight size={18}/></a><a className="text-link" href="#solucoes">Conhecer soluções <span>→</span></a></div><div className="trust-row"><span><ShieldCheck size={17}/> Medição técnica</span><span><Ruler size={17}/> Sob medida</span><span><Check size={17}/> Instalação especializada</span></div></div>
      <div className="hero-art"><div className="art-label"><span>01 / 04</span> ARQUITETURA EM DETALHE</div><Preview config={config} opened={opened}/><div className="art-caption"><span>ANACLETO <b>ESQUADRIAS</b></span><small>FORMAS QUE TRANSFORMAM ESPAÇOS</small></div></div></section>
      <section className="showroom-section section-wrap" id="showroom"><div className="section-heading"><div><span className="eyebrow">CONFIGURADOR VISUAL</span><h2>Seu projeto, em perspectiva.</h2></div><p>Explore combinações de perfis e vidros. A visualização é conceitual e ajuda a iniciar a conversa sobre seu projeto.</p></div>
        <div className="showroom-grid"><div className="config-panel"><div className="config-top"><span>PERSONALIZE SUA ESQUADRIA</span><Sparkles size={17}/></div>
          <label>Modelo<select value={config.model} onChange={e=>set("model",e.target.value as Model)}>{["Janela de Correr","Porta Balcão","Maxim-Ar","Porta Camarão","Cobertura de Vidro"].map(x=><option key={x}>{x}</option>)}</select></label>
          <div className="config-two"><label>Linha<select value={config.line} onChange={e=>set("line",e.target.value as Config["line"])}><option>Suprema</option><option>Gold</option></select></label><label>Cor do Alumínio<select value={config.color} onChange={e=>set("color",e.target.value)}>{["Preto Fosco","Branco","Bronze","Anodizado"].map(x=><option key={x}>{x}</option>)}</select></label></div>
          <label>Tipo de Vidro<select value={config.glass} onChange={e=>set("glass",e.target.value)}>{["Incolor","Fumê","Verde","Reflecta"].map(x=><option key={x}>{x}</option>)}</select></label>
          <div className="config-two"><label>Largura (mm)<input type="number" min="300" max="8000" step="50" value={config.width} onChange={e=>set("width",Math.max(300,Math.min(8000,Number(e.target.value)||300)))}/></label><label>Altura (mm)<input type="number" min="300" max="6000" step="50" value={config.height} onChange={e=>set("height",Math.max(300,Math.min(6000,Number(e.target.value)||300)))}/></label></div>
          <button className="button button-outline open-button" onClick={()=>setOpened(v=>!v)}><Move3D size={17}/>{opened?"Fechar Folhas":"Abrir / Fechar Folhas"}</button>
          <a className="button button-primary full-button" href={wa(message)} target="_blank" rel="noreferrer">Solicitar Orçamento deste Modelo <ArrowUpRight size={17}/></a><small className="config-note">Sem preços nesta página. As especificações seguem para atendimento e avaliação técnica.</small>
        </div><div className="viewer-panel" ref={viewerRef}><div className="viewer-toolbar"><span><i/> VISUALIZAÇÃO DO MODELO</span><span>360° · INTERATIVO</span></div>{show3D ? <Suspense fallback={<div className="viewer-fallback"><Preview config={config} opened={opened}/><span>Preparando visualização 3D…</span></div>}><LazyShowroom config={config} opened={opened}/></Suspense> : <div className="viewer-fallback"><Preview config={config} opened={opened}/><span>Prévia isométrica · toque para personalizar</span></div>}<div className="viewer-footer"><span>{config.model} / Linha {config.line}</span><span>{config.color} · Vidro {config.glass}</span></div></div></div>
      </section>
      <section className="solutions-section section-wrap" id="solucoes"><div className="section-heading"><div><span className="eyebrow">SOLUÇÕES ANACLETO</span><h2>Detalhes que definem espaços.</h2></div><p>Projetos personalizados para integrar funcionalidade, estética e desempenho.</p></div><div className="solution-grid">
        {[
          ["01","Portas e Janelas de Alumínio","Linhas e tipologias para projetos residenciais e comerciais.","window"],
          ["02","Coberturas e Tetos de Vidro","Mais luz natural com soluções planejadas para cada estrutura.","roof"],
          ["03","Fechamento de Sacadas","Proteção, transparência e integração entre ambientes.","balcony"],
          ["04","Box e Espelhos Sob Medida","Acabamento preciso para banheiros e interiores.","glass"]
        ].map(([n,title,desc,kind])=><article className="solution-card" key={n}><div className={"solution-visual "+kind}><div className="mini-frame"><i/><i/><i/></div><span>{n}</span></div><div className="solution-copy"><h3>{title}</h3><p>{desc}</p><a href={wa("Olá! Gostaria de informações sobre "+title+".")} target="_blank" rel="noreferrer">Conversar sobre esta solução <ArrowUpRight size={16}/></a></div></article>)}
      </div></section>
      <section className="projects-section" id="obras"><div className="section-wrap projects-inner"><div><span className="eyebrow">OBRAS E APLICAÇÕES</span><h2>Arquitetura valorizada em cada escolha.</h2><p>Da residência ao espaço comercial, cada instalação começa com uma boa especificação e atenção aos detalhes.</p><a className="button button-light" href={wa("Olá! Gostaria de conhecer referências de obras da Anacleto Esquadrias.")} target="_blank" rel="noreferrer">Solicitar referências <ArrowUpRight size={17}/></a></div><div className="project-graphic" aria-label="Composição arquitetônica ilustrativa de fachada com esquadrias de alumínio"><div className="building"><div/><div/><div/><div/><div/><div/></div><span>LINHAS · LUZ · PROPORÇÃO</span></div></div></section>
      <section className="process-section section-wrap" id="processo"><div className="section-heading"><div><span className="eyebrow">NOSSA ENTREGA</span><h2>Do primeiro traço ao pós-venda.</h2></div><p>Um processo claro, com acompanhamento em cada etapa do seu projeto.</p></div><div className="process-grid">{[["01","Projeto e Medição Técnica","Entendimento do ambiente, conferência dos vãos e definição da solução."],["02","Fabricação Sob Medida","Preparação dos componentes conforme as especificações aprovadas."],["03","Instalação Limpa e Pontual","Equipe especializada e cuidado com o ambiente da obra."],["04","Garantia e Pós-Venda","Orientação de uso e suporte após a conclusão do serviço."]].map(([n,t,d])=><article key={n}><span>{n}</span><div><h3>{t}</h3><p>{d}</p></div></article>)}</div></section>
      <section className="faq-section" id="faq"><div className="section-wrap faq-layout"><div><span className="eyebrow">DÚVIDAS FREQUENTES</span><h2>Informação para decidir com confiança.</h2><p>Tem outra dúvida? Nossa equipe pode orientar a melhor solução para seu ambiente.</p><a className="button button-primary" href={wa("Olá! Tenho dúvidas sobre esquadrias e vidraçaria sob medida.")} target="_blank" rel="noreferrer">Falar com um especialista <ArrowUpRight size={17}/></a></div><div className="faq-list">{faqs.map(([q,a],i)=><article className={faqOpen===i?"faq-item active":"faq-item"} key={q}><button onClick={()=>setFaqOpen(faqOpen===i?null:i)} aria-expanded={faqOpen===i}><span>{q}</span><ChevronDown size={19}/></button>{faqOpen===i&&<p>{a}</p>}</article>)}</div></div></section>
    </main>
    <footer className="site-footer"><div className="footer-main"><img src={logo} alt="Anacleto Esquadrias" width="1200" height="600" /><p>Esquadrias de alumínio e soluções em vidro para projetos que valorizam cada detalhe.</p><a href={wa("Olá! Gostaria de solicitar um orçamento.")} target="_blank" rel="noreferrer"><MessageCircle size={17}/> WhatsApp</a></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Anacleto Esquadrias. Todos os direitos reservados.</span><span>Desenvolvido por Safeness.inc</span></div></footer>
  </div>;
}
