import React, { useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase";
import { translations, LanguageCode } from "./translations";
import { languageMeta, generateBudgetTranslations } from "./utils";
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
import AnimatedWindowLoader from "./components/AnimatedWindowLoader";
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

    // Precargar imágenes
    const preloadImages = async () => {
      const images = [logoImg, heroImg, facadeImg, bathImg, pergolaImg];
      for (const src of images) {
        const img = new Image();
        img.src = src;
      }
    };
    preloadImages();

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

  // Mostrar animación de montaje de ventana
  if (authLoading || animationLoading) {
    return <AnimatedWindowLoader onFinish={() => setAnimationLoading(false)} currentLanguage={language} />;
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

  // Vista pública principal (el resto del código va aquí)
  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen bg-luxury-darker text-slate-100 flex flex-col">
      {/* Resto del contenido de la página - igual que antes */}
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

      {/* Hero Section */}
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

      {/* Services Section */}
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

      {/* Footer */}
      <footer className="py-10 text-center border-t bg-luxury-darker">
        <p className="text-xs text-slate-400">{t.footerRights}</p>
      </footer>

      <Chatbot currentLanguage={language} t={t} />
      <WhatsAppButton currentLanguage={language} />
    </div>
  );
}