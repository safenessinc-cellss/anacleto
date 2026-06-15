import React, { useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, addDoc, doc, setDoc, onSnapshot } from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "./firebase";
import { translations, LanguageCode } from "./translations";
import { languageMeta, formatCurrency, generateBudgetTranslations } from "./utils";
import {
  ShieldCheck,
  Globe,
  Sun,
  Moon,
  ArrowRight,
  FileText,
  Users,
  CheckCircle,
  Sparkles,
  Bot,
  MessageSquare,
  ChevronRight,
  Landmark,
  Plus,
  Trash,
  Info,
  Calendar,
  Clock,
  MapPin,
  MessageCircle,
  Award,
  ShieldAlert,
  Menu,
  Phone,
  Mail
} from "lucide-react";
import Dashboard from "./components/Dashboard";
import Login from "./components/Login";
import Chatbot from "./components/Chatbot";
import WhatsAppButton from "./components/WhatsAppButton";
import SimpleLoader from "./components/SimpleLoader"; // ← CAMBIADO: Nuevo loader
import { useToast } from "./components/ToastContext";

// Premium Brand Assets
import logoImg from "./assets/images/anacleto_logo_1780594599493.png";
import heroImg from "./assets/images/modern_house_esquadrias_1780594310165.png";
import facadeImg from "./assets/images/corporate_facade_1780594325774.png";
import bathImg from "./assets/images/bathroom_box_glass_1780594338585.png";
import pergolaImg from "./assets/images/pergola_glass_1780594351717.png";

export default function App() {
  const { showToast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [animationLoading, setAnimationLoading] = useState(true); // ← Se mantiene pero ahora funciona
  const [isAdminPortal, setIsAdminPortal] = useState(false);
  const [language, setLanguage] = useState<LanguageCode>("pt");
  const [darkMode, setDarkMode] = useState(true);

  // Real-time synchronization of website & billing settings
  const [senderConfig, setSenderConfig] = useState<any>({
    name: "Anacleto Esquadrias",
    nif: "CNPJ 50.204.533/0001-99",
    address: "Av. Caxias do Sul, 1069 - Rio dos Sinos",
    postalCode: "93110-000",
    city: "São Leopoldo - RS",
    country: "Brasil",
    logoUrl: "",
    bankAccount: "PIX: CNPJ 50.204.533/0001-99 - Banco Sicredi",
    currency: "BRL",
    updatedAt: new Date().toISOString(),
    websiteLogoUrl: "",
    profileName: "Anacleto Esquadrias",
    profileRole: "Diretor Comercial & Operações",
    profileBio: "Mais de 20 anos de experiência prestando serviços qualificados em esquadrias de alumínio residenciais, prediais e corporativas de alto padrão. Medições a laser precisas, design exclusivas e total conformidade técnica.",
    profileAvatarUrl: "",
    profilePhone: "(51) 99311-0000",
    profileEmail: "contato@anacletoesquadrias.com.br",
    promotions: [
      { id: "p1", title: "Campanha Especial de Inverno", description: "Fechamentos de sacadas com esquadria Linha Suprema ou Gold e isolamento de vidro temperado com 10% de desconto real.", discountBadge: "10% OFF", isActive: true },
      { id: "p2", title: "Medição e Visita Gratuita", description: "Ganhe medição a laser residencial com orçamento completo sem compromisso em Porto Alegre e Região Metropolitana.", discountBadge: "GRÁTIS", isActive: true }
    ],
    publicity: [
      { id: "ads1", bannerText: "✨ NOVIDADE: Parcelamento facilitado em até 10x sem juros em todas as esquadrias de alumínio de alto padrão!", bannerLink: "#solicitar", isActive: true, bgColor: "bg-amber-500 text-slate-950" }
    ],
    videos: [
      { id: "v1", title: "Showcase: Mansão Alto Padrão - Pele de Vidro & Alumínio Preto", url: "https://www.youtube.com/embed/dQw4w9WgXcQ", description: "Confira a espetacular instalação de esquadrias Suprema e vidros laminados acústicos de controle térmico nesta residência exclusiva." }
    ]
  });

  // Technical visit scheduling states
  const [schName, setSchName] = useState("");
  const [schEmail, setSchEmail] = useState("");
  const [schPhone, setSchPhone] = useState("");
  const [schService, setSchService] = useState("Esquadrias Residenciais");
  const [schAddress, setSchAddress] = useState("");
  const [schDate, setSchDate] = useState("");
  const [schTime, setSchTime] = useState("09:00");
  const [schNotes, setSchNotes] = useState("");
  const [schIsSubmitting, setSchIsSubmitting] = useState(false);
  const [schSubmittedSuccess, setSchSubmittedSuccess] = useState(false);

  // Visitor estimate simulator client variables
  const [visName, setVisName] = useState("");
  const [visEmail, setVisEmail] = useState("");
  const [visNif, setVisNif] = useState("");
  const [visAddress, setVisAddress] = useState("");
  const [visService, setVisService] = useState("Esquadrias Residenciais");
  const [visQty, setVisQty] = useState(1);
  const [visCustomPrice, setVisCustomPrice] = useState(0);
  const [visIsSubmitting, setVisIsSubmitting] = useState(false);
  const [visSubmittedSuccess, setVisSubmittedSuccess] = useState(false);
  const [visCustomLines, setVisCustomLines] = useState<{ id: string; description: string; qty: number; price: number }[]>([
    { id: "1", description: "Janelas e Portas de Alumínio Customizadas (Linha Suprema/Gold)", qty: 2, price: 0 }
  ]);

  // AI-Powered visitor layout simulator attributes
  const [visAiPrompt, setVisAiPrompt] = useState("");
  const [visAiIsGenerating, setVisAiIsGenerating] = useState(false);
  const [visAiSuccessMsg, setVisAiSuccessMsg] = useState("");

  const handleGenerateAiEstimatePreset = async (promptText?: string) => {
    const textToAnalyze = promptText || visAiPrompt;
    if (!textToAnalyze.trim()) return;

    setVisAiIsGenerating(true);
    setVisAiSuccessMsg("");
    try {
      const response = await fetch("/api/ai-preset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: textToAnalyze, language }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.items && Array.isArray(data.items)) {
          const formatted = data.items.map((item: any, index: number) => ({
            id: "ai_" + index + "_" + Math.random().toString(36).substring(2),
            description: item.description,
            qty: item.qty || 1,
            price: item.price || 0,
          }));
          setVisCustomLines(formatted);
          setVisAiSuccessMsg(language === "es" ? "✨ IA: ¡Proyecto optimizado con éxito! Datos incorporados al simulador." : language === "en" ? "✨ AI: Project successfully optimized! Simulated items loaded below." : "✨ IA: Projeto otimizado com sucesso! Itens e simulação inseridos abaixo.");
          if (!promptText) {
            setVisAiPrompt("");
          }
        }
      }
    } catch (err) {
      console.error("AI preset generator client error: ", err);
    } finally {
      setVisAiIsGenerating(false);
    }
  };

  // Read language and dark mode from local storage on startup
  useEffect(() => {
    const savedLang = localStorage.getItem("anacleto_language") as LanguageCode;
    if (savedLang && translations[savedLang]) {
      setLanguage(savedLang);
    }

    const savedTheme = localStorage.getItem("anacleto_theme");
    if (savedTheme === "light") {
      setDarkMode(false);
      document.documentElement.classList.remove("dark");
    } else {
      setDarkMode(true);
      document.documentElement.classList.add("dark");
    }

    // Pequeño delay para asegurar que el DOM está listo
    const timer = setTimeout(() => {
      setAnimationLoading(false);
    }, 1500);

    // Monitor Firebase Auth state
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
    });

    // Real-time listener for website configurations & promotions
    const unsubConfig = onSnapshot(doc(db, "sender_config", "default"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSenderConfig((prev: any) => ({
          ...prev,
          ...data
        }));
      }
    }, (error) => {
      console.warn("Could not load dynamic configuration from Firestore sender_config/default. Using local default configuration instead.");
    });

    return () => {
      clearTimeout(timer);
      unsubscribe();
      unsubConfig();
    };
  }, []);

  const toggleTheme = () => {
    const nextDark = !darkMode;
    setDarkMode(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("anacleto_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("anacleto_theme", "light");
    }
  };

  const handleLanguageChange = (langCode: LanguageCode) => {
    setLanguage(langCode);
    localStorage.setItem("anacleto_language", langCode);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsAdminPortal(false);
    } catch (err) {
      console.error(err);
    }
  };

  // Submit client budget estimate directly to database
  const handleVisitorSubmitEstimate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (visCustomLines.length === 0) {
      showToast("Por favor adicione pelo menos um item à sua solicitação.", "warning");
      return;
    }
    setVisIsSubmitting(true);

    try {
      const budgetId = "bud_vis_" + Math.random().toString(36).substring(2);
      const budgetNo = "PRES-" + new Date().getFullYear() + "-VIS" + Math.floor(Math.random() * 900 + 100);

      // Reformat custom lines structure to standard BudgetLineItem
      const formattedLines = visCustomLines.map((line) => ({
        id: line.id,
        description: line.description,
        quantity: line.qty,
        unitPrice: line.price,
      }));

      const subtotal = formattedLines.reduce((acc, current) => acc + (current.quantity * current.unitPrice), 0);
      const taxRate = 23; // default Portuguese IVA
      const taxAmount = Number(((subtotal * taxRate) / 100).toFixed(2));
      const total = Number((subtotal + taxAmount).toFixed(2));

      // Translate descriptors for all languages
      const translationsMap = generateBudgetTranslations(formattedLines);

      // Distribute taxes dynamically inside translation mappings
      Object.keys(translationsMap).forEach((langKey) => {
        const itemVal = translationsMap[langKey];
        itemVal.taxAmount = Number(((itemVal.subtotal * taxRate) / 100).toFixed(2));
        itemVal.total = Number((itemVal.subtotal + itemVal.taxAmount).toFixed(2));
      });

      const budgetDoc = {
        id: budgetId,
        number: budgetNo,
        clientName: visName,
        clientEmail: visEmail,
        clientNif: visNif,
        clientAddress: visAddress,
        date: new Date().toISOString().split("T")[0],
        items: formattedLines,
        subtotal,
        taxRate,
        taxAmount,
        total,
        status: "pending",
        language: language,
        translations: translationsMap,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, "budgets", budgetId), budgetDoc);
      
      setVisSubmittedSuccess(true);
      showToast("Solicitação de orçamento enviada com sucesso!", "success");
      // Clean up fields
      setVisName("");
      setVisEmail("");
      setVisNif("");
      setVisAddress("");
      setVisCustomLines([{ id: "1", description: "Esquadrias de Alumínio Customizadas (Suprema/Gold - m²)", qty: 2, price: 1200 }]);
    } catch (err) {
      console.error(err);
      showToast("Não foi possível enviar a sua solicitação. Por favor revise os dados informados.", "error");
    } finally {
      setVisIsSubmitting(false);
    }
  };

  const addEstimateLine = () => {
    setVisCustomLines([
      ...visCustomLines,
      {
        id: Math.random().toString(36).substring(2),
        description: "Instalação Especializada e Limpeza Técnica",
        qty: 1,
        price: 0,
      }
    ]);
  };

  const removeEstimateLine = (id: string) => {
    setVisCustomLines(visCustomLines.filter((l) => l.id !== id));
  };

  const handleVisitorScheduleVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schName.trim() || !schPhone.trim() || !schDate || !schTime) {
      showToast("Por favor, preencha todos os campos obrigatórios (*).", "warning");
      return;
    }
    setSchIsSubmitting(true);

    try {
      const visitId = "vst_" + Math.random().toString(36).substring(2);
      const visitDoc = {
        id: visitId,
        name: schName.trim(),
        email: schEmail.trim(),
        phone: schPhone.trim(),
        service: schService,
        address: schAddress.trim(),
        preferDate: schDate,
        preferTime: schTime,
        notes: schNotes.trim(),
        status: "pending",
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, "visits", visitId), visitDoc);

      setSchSubmittedSuccess(true);
      showToast("Agendamento de visita solicitado com sucesso!", "success");
      // Clean up fields
      setSchName("");
      setSchEmail("");
      setSchPhone("");
      setSchService("Esquadrias Residenciais");
      setSchAddress("");
      setSchDate("");
      setSchTime("09:00");
      setSchNotes("");
    } catch (err) {
      console.error(err);
      showToast("Não foi possível agendar sua visita técnica. Por favor tente novamente.", "error");
    } finally {
      setSchIsSubmitting(false);
    }
  };

  const updateEstimateLine = (id: string, field: "description" | "qty" | "price", val: any) => {
    setVisCustomLines(
      visCustomLines.map((l) => (l.id === id ? { ...l, [field]: val } : l))
    );
  };

  // Get localized language bundle
  const t = translations[language] || translations.pt;
  const isRtl = language === "ar";

  // Calculate live visitor totals for client visual preview
  const liveSubtotal = visCustomLines.reduce((acc, current) => acc + (current.qty * current.price), 0);
  const liveTax = Number(((liveSubtotal * 23) / 100).toFixed(2));
  const liveTotal = Number((liveSubtotal + liveTax).toFixed(2));

  // Mostrar loader mientras carga
  if (authLoading || animationLoading) {
    return <SimpleLoader onFinish={() => setAnimationLoading(false)} />;
  }

  // PRIVATE ADMINISTRATIVE COMPARTMENT ROUTE
  if (isAdminPortal) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col transition-colors duration-300 print:bg-white print:text-black">
        {/* Admin Section Top Header (Printed hidden) */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 py-3.5 px-6 shadow-sm flex items-center justify-between print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 text-white rounded-xl">
              <ShieldCheck className="w-5 h-5 text-indigo-200" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">Private Admin Portal</span>
              <h2 className="text-sm font-black text-slate-900 dark:text-white">ANACLETO SECURE VAULT</h2>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-500 dark:text-amber-400 transition cursor-pointer"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value as LanguageCode)}
              className="px-2.5 py-1.5 text-xs font-bold border border-slate-350 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg cursor-pointer outline-hidden"
            >
              {Object.entries(languageMeta).map(([code, meta]) => (
                <option key={code} value={code}>
                  {meta.flag} {code.toUpperCase()}
                </option>
              ))}
            </select>

            <button
              onClick={() => setIsAdminPortal(false)}
              className="text-xs font-bold text-slate-600 dark:text-slate-350 hover:text-luxury-gold hover:underline cursor-pointer transition-all"
            >
              {t.backToHome}
            </button>
          </div>
        </header>

        <main className="flex-1">
          {user ? (
            <Dashboard
              t={t}
              onLogout={handleLogout}
              currentLanguage={language}
              senderConfig={senderConfig}
              setSenderConfig={setSenderConfig}
            />
          ) : (
            <Login t={t} language={language} onLoginSuccess={() => {}} />
          )}
        </main>

        <footer className="py-6 text-center text-xs text-slate-400 dark:text-slate-600 border-t border-slate-150 dark:border-slate-850 mt-12 bg-white dark:bg-slate-905 print:hidden">
          {t.footerRights}
        </footer>
      </div>
    );
  }

  // PUBLIC VISITOR WEBPAGE PORTFOLIO ROUTE
  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="min-h-screen bg-luxury-darker text-slate-100 flex flex-col transition-colors duration-300 selection:bg-luxury-gold/30 selection:text-white"
    >
      {senderConfig.publicity && senderConfig.publicity.filter((item: any) => item.isActive).map((item: any) => (
        <div key={item.id} className={`${item.bgColor || "bg-amber-500 text-slate-950"} text-center py-2 px-4 text-xs font-black tracking-wide flex items-center justify-center gap-2 transition animate-fade-in print:hidden`}>
          <span>{item.bannerText}</span>
          {item.bannerLink && (
            <a href={item.bannerLink} className="underline hover:opacity-85 ml-1 inline-flex items-center gap-0.5">
              Saber mais <ArrowRight className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      ))}
      
      {/* 1. Brand navigation Ribbon */}
      <nav className="sticky top-0 z-30 bg-luxury-darker/90 backdrop-blur-md border-b border-luxury-border/60 py-4 px-6 transition-colors duration-300 shadow-xl shadow-black/20">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-luxury-dark rounded-xl overflow-hidden relative shrink-0 border border-luxury-border shadow-md">
              <img src={senderConfig.websiteLogoUrl || senderConfig.logoUrl || logoImg} referrerPolicy="no-referrer" className="w-full h-full object-contain scale-105" alt="Anacleto Logo" />
            </div>
            <div className="text-left">
              <h1 className="text-lg font-black tracking-[0.2em] uppercase text-white font-sans">
                {t.title}
              </h1>
              <p className="text-[9px] text-luxury-gold tracking-[0.12em] font-medium uppercase">{t.subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-luxury-dark border border-luxury-border px-3 py-1.5 rounded-2xl shadow-inner">
              <Globe className="w-4 h-4 text-luxury-gold" />
              <select
                value={language}
                onChange={(e) => handleLanguageChange(e.target.value as LanguageCode)}
                className="text-xs bg-transparent text-slate-300 font-bold border-none outline-hidden cursor-pointer focus:ring-0"
              >
                {Object.entries(languageMeta).map(([code, meta]) => (
                  <option key={code} value={code}>
                    {meta.flag} {meta.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-full bg-luxury-dark hover:bg-luxury-dark/80 text-luxury-gold border border-luxury-border transition-all cursor-pointer shadow-xs"
              aria-label="Toggle Dark Mode"
            >
              {darkMode ? <Sun className="w-4.5 h-4.5 text-amber-400" /> : <Moon className="w-4.5 h-4.5 text-luxury-gold" />}
            </button>
            <button
              onClick={() => setIsAdminPortal(true)}
              className="text-xs font-bold px-4 py-2.5 rounded-2xl border border-luxury-gold/30 text-luxury-gold hover:bg-luxury-gold/5 transition cursor-pointer"
            >
              {t.ctaAdmin}
            </button>
          </div>

        </div>
      </nav>

      {/* 2. Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-24 px-6 bg-gradient-to-b from-luxury-dark via-luxury-darker to-luxury-darker border-b border-luxury-border/30">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          <div className="lg:col-span-7 space-y-6 text-left">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-luxury-dark border border-luxury-gold/20 text-luxury-gold font-extrabold text-[10px] tracking-wider rounded-full uppercase">
              <Bot className="w-4 h-4 text-luxury-gold" />
              SISTEMA MULTILÍNGUE • PORTUGUÊS DEFAULT
            </span>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-white tracking-tight leading-tight">
              {t.heroTitle}
            </h2>
            <p className="text-slate-350 text-base md:text-lg max-w-xl leading-relaxed">
              {t.heroSub}
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-4">
              <span className="relative inline-flex">
                <a
                  href="#solicitar"
                  className="flex items-center gap-2 px-6 py-3 bg-luxury-gold hover:bg-luxury-gold-dark text-luxury-darker font-extrabold uppercase tracking-wider rounded-2xl text-xs shadow-lg shadow-luxury-gold/10 transition transform hover:-translate-y-0.5 active:translate-y-0 duration-200 hover:scale-103 cursor-pointer"
                >
                  {t.ctaGetBudget}
                  <ArrowRight className="w-4.5 h-4.5" />
                </a>
              </span>
              <a
                href="#agendar"
                className="px-6 py-3 bg-luxury-dark border border-luxury-border text-slate-200 hover:text-white hover:border-luxury-gold transition rounded-2xl text-xs font-black uppercase tracking-wider shadow-xs cursor-pointer text-center"
              >
                Agendar Medição Grátis
              </a>
            </div>
          </div>

          <div className="lg:col-span-5 relative group">
            <div className="absolute inset-0 bg-luxury-gold/5 blur-3xl rounded-full opacity-60 group-hover:opacity-100 transition duration-500"></div>
            <div className="relative overflow-hidden rounded-3xl shadow-2xl border border-luxury-border transition-all duration-300 transform group-hover:scale-[1.01]">
              <img
                src={heroImg}
                referrerPolicy="no-referrer"
                className="w-full h-80 object-cover"
                alt="Anacleto Esquadrias"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent flex flex-col justify-end p-6 text-white text-left">
                <span className="text-[10px] font-black uppercase tracking-wider text-luxury-gold bg-luxury-dark border border-luxury-gold/20 px-2.5 py-1 rounded-md w-fit mb-2">
                  Qualidade Certificada NBR
                </span>
                <p className="text-lg font-black tracking-tight leading-tight">
                  Design Moderno, Conforto Acústico e Garantia de Fábrica de até 10 anos.
                </p>
                <div className="flex gap-4 items-center mt-3 text-[10px] font-mono text-slate-350">
                  <span>✨ 20+ Anos de Sucesso</span>
                  <span>🏆 100% Instalação Própria</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* 3. Core Services Grid Section */}
      <section className="py-20 px-6 bg-luxury-dark border-b border-luxury-border/30 transition-colors duration-300">
        <div className="max-w-7xl mx-auto text-center space-y-4 mb-16">
          <h2 className="text-3xl font-black tracking-tight text-white uppercase">
            {t.servicesTitle}
          </h2>
          <p className="text-sm text-slate-400 max-w-lg mx-auto">
            {t.servicesSlogan}
          </p>
        </div>

        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
          <div className="p-6 bg-luxury-darker rounded-3xl shadow-xs border border-luxury-border/60 hover:border-luxury-gold/40 space-y-3 transition transform hover:-translate-y-1 duration-200">
            <div className="w-10 h-10 bg-luxury-dark text-luxury-gold rounded-xl flex items-center justify-center border border-luxury-gold/25">
              <Landmark className="w-5 h-5" />
            </div>
            <h3 className="font-extrabold text-sm text-white">{t.service1Name}</h3>
            <p className="text-xs text-slate-400 leading-relaxed">{t.service1Desc}</p>
          </div>

          <div className="p-6 bg-luxury-darker rounded-3xl shadow-xs border border-luxury-border/60 hover:border-luxury-gold/40 space-y-3 transition transform hover:-translate-y-1 duration-200">
            <div className="w-10 h-10 bg-luxury-dark text-luxury-gold rounded-xl flex items-center justify-center border border-luxury-gold/25">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="font-extrabold text-sm text-white">{t.service2Name}</h3>
            <p className="text-xs text-slate-400 leading-relaxed">{t.service2Desc}</p>
          </div>

          <div className="p-6 bg-luxury-darker rounded-3xl shadow-xs border border-luxury-border/60 hover:border-luxury-gold/40 space-y-3 transition transform hover:-translate-y-1 duration-200">
            <div className="w-10 h-10 bg-luxury-dark text-luxury-gold rounded-xl flex items-center justify-center border border-luxury-gold/25">
              <CheckCircle className="w-5 h-5" />
            </div>
            <h3 className="font-extrabold text-sm text-white">{t.service3Name}</h3>
            <p className="text-xs text-slate-400 leading-relaxed">{t.service3Desc}</p>
          </div>

          <div className="p-6 bg-luxury-darker rounded-3xl shadow-xs border border-luxury-border/60 hover:border-luxury-gold/40 space-y-3 transition transform hover:-translate-y-1 duration-200">
            <div className="w-10 h-10 bg-luxury-dark text-luxury-gold rounded-xl flex items-center justify-center border border-luxury-gold/25">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="font-extrabold text-sm text-white">{t.service4Name}</h3>
            <p className="text-xs text-slate-400 leading-relaxed">{t.service4Desc}</p>
          </div>
        </div>
      </section>

      {/* ACTIVE PROMOTIONS SECTION */}
      {senderConfig.promotions && senderConfig.promotions.filter((p: any) => p.isActive).length > 0 && (
        <section className="py-12 px-6 bg-gradient-to-r from-luxury-darker via-luxury-dark to-luxury-darker border-b border-luxury-border/30">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-2 justify-center mb-8">
              <span className="p-1 px-2.5 bg-luxury-gold/10 text-luxury-gold border border-luxury-gold/25 rounded-md font-extrabold text-[10px] tracking-widest uppercase">
                CAMPANHAS ATIVAS SOB MEDIDA
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {senderConfig.promotions.filter((p: any) => p.isActive).map((p: any) => (
                <div key={p.id} className="p-6 bg-luxury-darker/90 rounded-3xl border border-luxury-gold/30 shadow-2xl relative overflow-hidden group hover:border-luxury-gold transition duration-300 text-left">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-luxury-gold/5 rounded-full blur-xl pointer-events-none"></div>
                  <div className="flex justify-between items-start gap-4 mb-3">
                    <h3 className="font-black text-white text-base tracking-tight">{p.title}</h3>
                    <span className="px-3 py-1 bg-luxury-gold text-luxury-darker text-[10px] font-black rounded-lg uppercase tracking-wider shrink-0 shadow-sm animate-pulse">
                      {p.discountBadge}
                    </span>
                  </div>
                  <p className
