import React, { useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase";
import { translations, LanguageCode } from "./translations";
import { languageMeta } from "./utils";  // ← ELIMINÉ generateBudgetTranslations
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
  Landmark,
  Plus,
  Trash,
  Award,
} from "lucide-react";
import Dashboard from "./components/Dashboard";
import Login from "./components/Login";
import Chatbot from "./components/Chatbot";
import WhatsAppButton from "./components/WhatsAppButton";
import { useToast } from "./components/ToastContext";

// Premium Brand Assets
import logoImg from "./assets/images/anacleto_logo_1780594599493.png";
import heroImg from "./assets/images/modern_house_esquadrias_1780594310165.png";
import facadeImg from "./assets/images/corporate_facade_1780594325774.png";
import bathImg from "./assets/images/bathroom_box_glass_1780594338585.png";
import pergolaImg from "./assets/images/pergola_glass_1780594351717.png";

// Componente de animación de inicio mejorado (sin canvas)
const AnimatedLoader = ({ onFinish }: { onFinish: () => void }) => {
  const [progress, setProgress] = useState(0);
  const [dots, setDots] = useState("");

  useEffect(() => {
    // Animación de progreso
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => onFinish(), 300);
          return 100;
        }
        return prev + 2;
      });
    }, 20);

    // Animación de puntos suspensivos
    const dotsInterval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? "" : prev + ".");
    }, 400);

    // Precarga de imágenes para evitar flashes
    const preloadImages = async () => {
      const images = [logoImg, heroImg, facadeImg, bathImg, pergolaImg];
      for (const src of images) {
        const img = new Image();
        img.src = src;
      }
    };
    preloadImages();

    return () => {
      clearInterval(interval);
      clearInterval(dotsInterval);
    };
  }, [onFinish]);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-luxury-darker via-luxury-dark to-luxury-darker z-50 flex flex-col items-center justify-center">
      <div className="text-center space-y-8 max-w-md px-6 animate-fade-in">
        {/* Logo con animación de pulso */}
        <div className="relative w-28 h-28 mx-auto">
          <div className="absolute inset-0 border-4 border-luxury-gold/20 rounded-full animate-ping"></div>
          <div className="absolute inset-0 border-4 border-luxury-gold/40 rounded-full animate-pulse"></div>
          <div className="absolute inset-0 bg-luxury-dark rounded-full flex items-center justify-center shadow-2xl shadow-luxury-gold/20">
            <span className="text-4xl font-black text-luxury-gold">A</span>
          </div>
        </div>

        {/* Texto de marca */}
        <div className="space-y-2">
          <h1 className="text-2xl font-black tracking-[0.3em] text-white uppercase animate-slide-up">
            ANACLETO
          </h1>
          <p className="text-xs text-luxury-gold tracking-[0.2em] font-medium uppercase animate-slide-up animation-delay-100">
            ESQUADRIAS DE ALUMÍNIO
          </p>
        </div>

        {/* Barra de progreso premium */}
        <div className="w-full max-w-xs mx-auto space-y-2">
          <div className="w-full bg-luxury-dark/50 rounded-full h-1 overflow-hidden backdrop-blur-sm">
            <div 
              className="bg-gradient-to-r from-luxury-gold to-amber-500 h-full transition-all duration-100 ease-out rounded-full relative"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full shadow-lg shadow-luxury-gold"></div>
            </div>
          </div>
          <p className="text-luxury-gold text-[10px] font-mono tracking-wider">
            CARGANDO SISTEMA{dots}
          </p>
        </div>

        {/* Mensajes rotativos */}
        <div className="text-slate-500 text-[9px] font-mono space-y-1">
          <p className="animate-pulse">✨ Sistema multilíngue integrado</p>
          <p className="animate-pulse animation-delay-300">🔒 Firestore sincronizado</p>
        </div>
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.6s ease-out forwards;
        }
        .animate-slide-up {
          animation: slide-up 0.5s ease-out forwards;
          opacity: 0;
        }
        .animation-delay-100 {
          animation-delay: 0.1s;
        }
        .animation-delay-300 {
          animation-delay: 0.3s;
        }
      `}</style>
    </div>
  );
};

export default function App() {
  const { showToast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [animationLoading, setAnimationLoading] = useState(true);
  const [isAdminPortal, setIsAdminPortal] = useState(false);
  const [language, setLanguage] = useState<LanguageCode>("pt");
  const [darkMode, setDarkMode] = useState(true);

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
    profileBio: "Mais de 20 anos de experiência prestando serviços qualificados em esquadrias de alumínio residenciais, prediais e corporativas de alto padrão.",
    profileAvatarUrl: "",
    profilePhone: "(51) 99311-0000",
    profileEmail: "contato@anacletoesquadrias.com.br",
    promotions: [
      { id: "p1", title: "Campanha Especial de Inverno", description: "Fechamentos de sacadas com esquadria Linha Suprema ou Gold e isolamento de vidro temperado com 10% de desconto real.", discountBadge: "10% OFF", isActive: true },
      { id: "p2", title: "Medição e Visita Gratuita", description: "Ganhe medição a laser residencial com orçamento completo sem compromisso.", discountBadge: "GRÁTIS", isActive: true }
    ],
    publicity: [
      { id: "ads1", bannerText: "✨ NOVIDADE: Parcelamento facilitado em até 10x sem juros em todas as esquadrias de alumínio de alto padrão!", bannerLink: "#solicitar", isActive: true, bgColor: "bg-amber-500 text-slate-950" }
    ],
    videos: [
      { id: "v1", title: "Showcase: Mansão Alto Padrão", url: "https://www.youtube.com/embed/dQw4w9WgXcQ", description: "Confira a instalação de esquadrias Suprema." }
    ]
  });

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

  const [visName, setVisName] = useState("");
  const [visEmail, setVisEmail] = useState("");
  const [visNif, setVisNif] = useState("");
  const [visAddress, setVisAddress] = useState("");
  const [visIsSubmitting, setVisIsSubmitting] = useState(false);
  const [visSubmittedSuccess, setVisSubmittedSuccess] = useState(false);
  const [visCustomLines, setVisCustomLines] = useState<{ id: string; description: string; qty: number; price: number }[]>([
    { id: "1", description: "Janelas e Portas de Alumínio Customizadas", qty: 2, price: 0 }
  ]);

  const [visAiPrompt, setVisAiPrompt] = useState("");
  const [visAiIsGenerating, setVisAiIsGenerating] = useState(false);
  const [visAiSuccessMsg, setVisAiSuccessMsg] = useState("");

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

    // Tiempo de carga mínimo para mostrar animación
    const timer = setTimeout(() => {
      setAnimationLoading(false);
    }, 2500);

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
    });

    const unsubConfig = onSnapshot(doc(db, "sender_config", "default"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSenderConfig((prev: any) => ({ ...prev, ...data }));
      }
    }, () => {
      console.warn("Could not load dynamic configuration");
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

      const formattedLines = visCustomLines.map((line) => ({
        id: line.id,
        description: line.description,
        quantity: line.qty,
        unitPrice: line.price,
      }));

      const subtotal = formattedLines.reduce((acc, current) => acc + (current.quantity * current.unitPrice), 0);
      const taxRate = 23;
      const taxAmount = Number(((subtotal * taxRate) / 100).toFixed(2));
      const total = Number((subtotal + taxAmount).toFixed(2));

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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, "budgets", budgetId), budgetDoc);
      
      setVisSubmittedSuccess(true);
      showToast("Solicitação de orçamento enviada com sucesso!", "success");
      setVisName("");
      setVisEmail("");
      setVisNif("");
      setVisAddress("");
      setVisCustomLines([{ id: "1", description: "Esquadrias de Alumínio Customizadas", qty: 2, price: 1200 }]);
    } catch (err) {
      console.error(err);
      showToast("Não foi possível enviar a sua solicitação.", "error");
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
      showToast("Por favor, preencha todos os campos obrigatórios.", "warning");
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
      showToast("Não foi possível agendar sua visita técnica.", "error");
    } finally {
      setSchIsSubmitting(false);
    }
  };

  const updateEstimateLine = (id: string, field: "description" | "qty" | "price", val: any) => {
    setVisCustomLines(
      visCustomLines.map((l) => (l.id === id ? { ...l, [field]: val } : l))
    );
  };

  const handleGenerateAiEstimatePreset = async (promptText?: string) => {
    const textToAnalyze = promptText || visAiPrompt;
    if (!textToAnalyze.trim()) return;

    setVisAiIsGenerating(true);
    setVisAiSuccessMsg("");
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setVisAiSuccessMsg("✨ IA: Projeto otimizado com sucesso!");
      if (!promptText) setVisAiPrompt("");
    } catch (err) {
      console.error(err);
    } finally {
      setVisAiIsGenerating(false);
    }
  };

  const t = translations[language] || translations.pt;
  const isRtl = language === "ar";

  // Mostrar animación de carga
  if (authLoading || animationLoading) {
    return <AnimatedLoader onFinish={() => setAnimationLoading(false)} />;
  }

  // Panel de administración
  if (isAdminPortal) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col">
        <header className="bg-white dark:bg-slate-900 border-b py-3.5 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 text-white rounded-xl">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-black text-slate-400">Private Admin Portal</span>
              <h2 className="text-sm font-black text-slate-900 dark:text-white">ANACLETO SECURE VAULT</h2>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={toggleTheme} className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800">
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <select value={language} onChange={(e) => handleLanguageChange(e.target.value as LanguageCode)} className="px-2.5 py-1.5 text-xs font-bold border rounded-lg">
              {Object.entries(languageMeta).map(([code, meta]) => (
                <option key={code} value={code}>{meta.flag} {code.toUpperCase()}</option>
              ))}
            </select>
            <button onClick={() => setIsAdminPortal(false)} className="text-xs font-bold hover:text-luxury-gold">
              {t.backToHome}
            </button>
          </div>
        </header>
        <main className="flex-1">
          {user ? (
            <Dashboard t={t} onLogout={handleLogout} currentLanguage={language} senderConfig={senderConfig} setSenderConfig={setSenderConfig} />
          ) : (
            <Login t={t} language={language} onLoginSuccess={() => {}} />
          )}
        </main>
        <footer className="py-6 text-center text-xs text-slate-400 border-t mt-12 bg-white dark:bg-slate-950">
          {t.footerRights}
        </footer>
      </div>
    );
  }

  // Vista pública principal
  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen bg-luxury-darker text-slate-100 flex flex-col">
      {senderConfig.publicity?.filter((item: any) => item.isActive).map((item: any) => (
        <div key={item.id} className={`${item.bgColor} text-center py-2 px-4 text-xs font-black flex items-center justify-center gap-2`}>
          <span>{item.bannerText}</span>
        </div>
      ))}
      
      <nav className="sticky top-0 z-30 bg-luxury-darker/90 backdrop-blur-md border-b py-4 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-luxury-dark rounded-xl overflow-hidden border">
              <img src={senderConfig.websiteLogoUrl || senderConfig.logoUrl || logoImg} className="w-full h-full object-contain" alt="Logo" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-[0.2em] uppercase text-white">{t.title}</h1>
              <p className="text-[9px] text-luxury-gold tracking-[0.12em] uppercase">{t.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-luxury-dark border px-3 py-1.5 rounded-2xl">
              <Globe className="w-4 h-4 text-luxury-gold" />
              <select value={language} onChange={(e) => handleLanguageChange(e.target.value as LanguageCode)} className="text-xs bg-transparent text-slate-300 font-bold">
                {Object.entries(languageMeta).map(([code, meta]) => (<option key={code} value={code}>{meta.flag} {meta.name}</option>))}
              </select>
            </div>
            <button onClick={toggleTheme} className="p-2.5 rounded-full bg-luxury-dark text-luxury-gold border">
              {darkMode ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
            </button>
            <button onClick={() => setIsAdminPortal(true)} className="text-xs font-bold px-4 py-2.5 rounded-2xl border border-luxury-gold/30 text-luxury-gold">
              {t.ctaAdmin}
            </button>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden pt-16 pb-24 px-6 bg-gradient-to-b from-luxury-dark via-luxury-darker to-luxury-darker">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-luxury-dark border border-luxury-gold/20 text-luxury-gold text-[10px] rounded-full">
              <Bot className="w-4 h-4" /> SISTEMA MULTILÍNGUE
            </span>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-white tracking-tight">{t.heroTitle}</h2>
            <p className="text-slate-350 text-base md:text-lg">{t.heroSub}</p>
            <div className="flex flex-wrap gap-4">
              <a href="#solicitar" className="flex items-center gap-2 px-6 py-3 bg-luxury-gold text-luxury-darker font-black uppercase tracking-wider rounded-2xl text-xs">
                {t.ctaGetBudget} <ArrowRight className="w-4.5 h-4.5" />
              </a>
              <a href="#agendar" className="px-6 py-3 bg-luxury-dark border text-slate-200 rounded-2xl text-xs font-black uppercase">
                Agendar Medição Grátis
              </a>
            </div>
          </div>
          <div className="lg:col-span-5">
            <div className="relative overflow-hidden rounded-3xl shadow-2xl border">
              <img src={heroImg} className="w-full h-80 object-cover" alt="Hero" />
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-luxury-dark">
        <div className="max-w-7xl mx-auto text-center mb-16">
          <h2 className="text-3xl font-black text-white uppercase">{t.servicesTitle}</h2>
        </div>
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 bg-luxury-darker rounded-3xl border hover:border-luxury-gold/40">
            <div className="w-10 h-10 bg-luxury-dark text-luxury-gold rounded-xl flex items-center justify-center"><Landmark className="w-5 h-5" /></div>
            <h3 className="font-extrabold text-sm text-white mt-3">{t.service1Name}</h3>
            <p className="text-xs text-slate-400 mt-2">{t.service1Desc}</p>
          </div>
          <div className="p-6 bg-luxury-darker rounded-3xl border hover:border-luxury-gold/40">
            <div className="w-10 h-10 bg-luxury-dark text-luxury-gold rounded-xl flex items-center justify-center"><FileText className="w-5 h-5" /></div>
            <h3 className="font-extrabold text-sm text-white mt-3">{t.service2Name}</h3>
            <p className="text-xs text-slate-400 mt-2">{t.service2Desc}</p>
          </div>
          <div className="p-6 bg-luxury-darker rounded-3xl border hover:border-luxury-gold/40">
            <div className="w-10 h-10 bg-luxury-dark text-luxury-gold rounded-xl flex items-center justify-center"><CheckCircle className="w-5 h-5" /></div>
            <h3 className="font-extrabold text-sm text-white mt-3">{t.service3Name}</h3>
            <p className="text-xs text-slate-400 mt-2">{t.service3Desc}</p>
          </div>
          <div className="p-6 bg-luxury-darker rounded-3xl border hover:border-luxury-gold/40">
            <div className="w-10 h-10 bg-luxury-dark text-luxury-gold rounded-xl flex items-center justify-center"><Users className="w-5 h-5" /></div>
            <h3 className="font-extrabold text-sm text-white mt-3">{t.service4Name}</h3>
            <p className="text-xs text-slate-400 mt-2">{t.service4Desc}</p>
          </div>
        </div>
      </section>

      {senderConfig.promotions?.filter((p: any) => p.isActive).length > 0 && (
        <section className="py-12 px-6 bg-gradient-to-r from-luxury-darker via-luxury-dark to-luxury-darker">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {senderConfig.promotions.filter((p: any) => p.isActive).map((p: any) => (
                <div key={p.id} className="p-6 bg-luxury-darker/90 rounded-3xl border border-luxury-gold/30">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-black text-white">{p.title}</h3>
                    <span className="px-3 py-1 bg-luxury-gold text-luxury-darker text-[10px] font-black rounded-lg">{p.discountBadge}</span>
                  </div>
                  <p className="text-xs text-slate-350">{p.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-20 px-6 bg-luxury-darker">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl font-black text-white uppercase mb-12">{t.whyTitle}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div><Award className="w-12 h-12 text-luxury-gold mx-auto mb-3" /><h3 className="font-extrabold text-white">{t.why1Title}</h3><p className="text-xs text-slate-400 mt-2">{t.why1Desc}</p></div>
            <div><Sparkles className="w-12 h-12 text-luxury-gold mx-auto mb-3" /><h3 className="font-extrabold text-white">{t.why2Title}</h3><p className="text-xs text-slate-400 mt-2">{t.why2Desc}</p></div>
            <div><Bot className="w-12 h-12 text-luxury-gold mx-auto mb-3" /><h3 className="font-extrabold text-white">{t.why3Title}</h3><p className="text-xs text-slate-400 mt-2">{t.why3Desc}</p></div>
          </div>
        </div>
      </section>

      <section id="portfolio" className="py-20 px-6 bg-luxury-dark">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-white uppercase">Portfólio de Sucesso</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[heroImg, facadeImg, bathImg, pergolaImg].map((img, idx) => (
              <div key={idx} className="rounded-2xl overflow-hidden border">
                <img src={img} className="w-full h-48 object-cover" alt={`Portfolio ${idx + 1}`} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="agendar" className="py-20 px-6 bg-luxury-darker">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-white uppercase">Agende sua Visita Técnica Gratuita</h2>
          </div>
          {schSubmittedSuccess ? (
            <div className="p-8 bg-luxury-dark border rounded-3xl text-center">
              <CheckCircle className="w-16 h-16 text-luxury-gold mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white">Visita Agendada com Sucesso!</h3>
              <button onClick={() => setSchSubmittedSuccess(false)} className="mt-4 px-5 py-2.5 bg-luxury-gold text-luxury-darker rounded-xl text-xs font-black">Agendar Outra Visita</button>
            </div>
          ) : (
            <form onSubmit={handleVisitorScheduleVisit} className="bg-luxury-dark p-8 rounded-3xl border space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input type="text" required value={schName} onChange={(e) => setSchName(e.target.value)} placeholder="Nombre completo *" className="px-3 py-2 text-xs border bg-luxury-darker text-white rounded-lg" />
                <input type="email" value={schEmail} onChange={(e) => setSchEmail(e.target.value)} placeholder="Email" className="px-3 py-2 text-xs border bg-luxury-darker text-white rounded-lg" />
                <input type="text" required value={schPhone} onChange={(e) => setSchPhone(e.target.value)} placeholder="Teléfono/WhatsApp *" className="px-3 py-2 text-xs border bg-luxury-darker text-white rounded-lg" />
                <input type="text" required value={schAddress} onChange={(e) => setSchAddress(e.target.value)} placeholder="Dirección completa *" className="px-3 py-2 text-xs border bg-luxury-darker text-white rounded-lg" />
                <input type="date" required value={schDate} onChange={(e) => setSchDate(e.target.value)} className="px-3 py-2 text-xs border bg-luxury-darker text-white rounded-lg" />
                <select value={schTime} onChange={(e) => setSchTime(e.target.value)} className="px-3 py-2 text-xs border bg-luxury-darker text-white rounded-lg">
                  <option value="09:00">09:00</option><option value="10:00">10:00</option><option value="11:00">11:00</option>
                  <option value="14:00">14:00</option><option value="15:00">15:00</option><option value="16:00">16:00</option>
                </select>
              </div>
              <textarea value={schNotes} onChange={(e) => setSchNotes(e.target.value)} rows={3} placeholder="Observaciones..." className="w-full px-3 py-2 text-xs border bg-luxury-darker text-white rounded-lg"></textarea>
              <button type="submit" disabled={schIsSubmitting} className="w-full py-3 bg-luxury-gold text-luxury-darker rounded-2xl text-xs font-black uppercase disabled:opacity-50">
                {schIsSubmitting ? "Cadastrando..." : "Agendar Visita Gratuita"}
              </button>
            </form>
          )}
        </div>
      </section>

      <section id="solicitar" className="py-20 px-6 bg-luxury-dark">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-white uppercase">{t.ctaGetBudget}</h2>
          </div>
          {visSubmittedSuccess ? (
            <div className="p-8 bg-luxury-darker border rounded-3xl text-center">
              <CheckCircle className="w-16 h-16 text-luxury-gold mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white">Solicitação Enviada com Sucesso!</h3>
              <button onClick={() => setVisSubmittedSuccess(false)} className="mt-4 px-5 py-2.5 bg-luxury-gold text-luxury-darker rounded-xl text-xs font-black">Simular Novo Orçamento</button>
            </div>
          ) : (
            <form onSubmit={handleVisitorSubmitEstimate} className="bg-luxury-darker p-8 rounded-3xl border space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input type="text" required value={visName} onChange={(e) => setVisName(e.target.value)} placeholder="Nombre completo *" className="px-3 py-2 text-xs border bg-luxury-dark text-white rounded-lg" />
                <input type="email" required value={visEmail} onChange={(e) => setVisEmail(e.target.value)} placeholder="Email *" className="px-3 py-2 text-xs border bg-luxury-dark text-white rounded-lg" />
                <input type="text" required value={visNif} onChange={(e) => setVisNif(e.target.value)} placeholder="NIF/CPF *" className="px-3 py-2 text-xs border bg-luxury-dark text-white rounded-lg" />
                <input type="text" value={visAddress} onChange={(e) => setVisAddress(e.target.value)} placeholder="Dirección" className="px-3 py-2 text-xs border bg-luxury-dark text-white rounded-lg" />
              </div>

              <div className="border-t pt-6">
                <div className="flex justify-between mb-4">
                  <h3 className="text-xs font-black uppercase text-luxury-gold">Itens do Orçamento</h3>
                  <button type="button" onClick={addEstimateLine} className="text-xs px-3 py-1.5 bg-luxury-dark text-luxury-gold border rounded-lg">+ Adicionar Item</button>
                </div>
                {visCustomLines.map((line) => (
                  <div key={line.id} className="flex gap-3 mb-3 items-center">
                    <select value={line.description} onChange={(e) => updateEstimateLine(line.id, "description", e.target.value)} className="flex-1 px-3 py-2 text-xs border bg-luxury-dark text-white rounded-lg">
                      <option>Janelas e Portas de Alumínio Customizadas</option>
                      <option>Fachadas Pele de Vidro</option>
                      <option>Vidro Temperado e Laminado</option>
                      <option>Box para Banheiro</option>
                      <option>Guarda-corpos e Corrimãos</option>
                      <option>Coberturas e Pergolados</option>
                    </select>
                    <input type="number" value={line.qty} onChange={(e) => updateEstimateLine(line.id, "qty", parseInt(e.target.value) || 1)} className="w-20 px-3 py-2 text-xs border bg-luxury-dark text-white rounded-lg" placeholder="Qtd" />
                    <button type="button" onClick={() => removeEstimateLine(line.id)} className="text-rose-500 p-2"><Trash className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>

              <button type="submit" disabled={visIsSubmitting} className="w-full py-3 bg-luxury-gold text-luxury-darker rounded-2xl text-xs font-black uppercase disabled:opacity-50">
                {visIsSubmitting ? "Enviando..." : "Enviar Solicitação de Orçamento"}
              </button>
            </form>
          )}
        </div>
      </section>

      <footer className="py-10 text-center border-t bg-luxury-darker">
        <p className="text-xs text-slate-400">{t.footerRights}</p>
      </footer>

      <Chatbot currentLanguage={language} t={t} />
      <WhatsAppButton currentLanguage={language} />
    </div>
  );
}
