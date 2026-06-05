import React, { useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, addDoc, doc, setDoc } from "firebase/firestore";
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
  const [isAdminPortal, setIsAdminPortal] = useState(false);
  const [language, setLanguage] = useState<LanguageCode>("pt");
  const [darkMode, setDarkMode] = useState(true);

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

    // Monitor Firebase Auth state
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
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

  if (authLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-semibold text-slate-500 tracking-wider uppercase">
            Iniciando Portal Anacleto...
          </p>
        </div>
      </div>
    );
  }

  // PRIVATE PRIVATE ADMINISTRATIVE COMPARTMENT ROUTE
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
            {/* Dark Mode toggle inside admin dashboard */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-500 dark:text-amber-400 transition cursor-pointer"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Language switch select */}
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

        {/* Dashboard Frame or Authentication Credentials Gate */}
        <main className="flex-1">
          {user ? (
            <Dashboard
              t={t}
              onLogout={handleLogout}
              currentLanguage={language}
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

  // PUBLIC VISITOR WEBPAGE PORTFOLIO ROUTE (TRULY OUTSTANDING MULTILINGUAL PLATFORM)
  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="min-h-screen bg-luxury-darker text-slate-100 flex flex-col transition-colors duration-300 selection:bg-luxury-gold/30 selection:text-white"
    >
      
      {/* 1. Brand navigation Ribbon */}
      <nav className="sticky top-0 z-30 bg-luxury-darker/90 backdrop-blur-md border-b border-luxury-border/60 py-4 px-6 transition-colors duration-300 shadow-xl shadow-black/20">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-luxury-dark rounded-xl overflow-hidden relative shrink-0 border border-luxury-border shadow-md">
              <img src={logoImg} referrerPolicy="no-referrer" className="w-full h-full object-contain scale-105" alt="Anacleto Logo" />
            </div>
            <div className="text-left">
              <h1 className="text-lg font-black tracking-[0.2em] uppercase text-white font-sans">
                {t.title}
              </h1>
              <p className="text-[9px] text-luxury-gold tracking-[0.12em] font-medium uppercase">{t.subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            
            {/* Floating Lang switch */}
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
              {/* Dark Mode toggle */}
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-full bg-luxury-dark hover:bg-luxury-dark/80 text-luxury-gold border border-luxury-border transition-all cursor-pointer shadow-xs"
              aria-label="Toggle Dark Mode"
            >
              {darkMode ? <Sun className="w-4.5 h-4.5 text-amber-400" /> : <Moon className="w-4.5 h-4.5 text-luxury-gold" />}
            </button>

            {/* Admin Private compartmental routing button */}
            <button
              onClick={() => setIsAdminPortal(true)}
              className="text-xs font-bold px-4 py-2.5 rounded-2xl border border-luxury-gold/30 text-luxury-gold hover:bg-luxury-gold/5 transition cursor-pointer"
            >
              {t.ctaAdmin}
            </button>
          </div>

        </div>
      </nav>

      {/* 2. Outstanding Hero Grid Presentation */}
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

          {/* Premium Image visual showcase */}
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
          {/* Card 1 */}
          <div className="p-6 bg-luxury-darker rounded-3xl shadow-xs border border-luxury-border/60 hover:border-luxury-gold/40 space-y-3 transition transform hover:-translate-y-1 duration-200">
            <div className="w-10 h-10 bg-luxury-dark text-luxury-gold rounded-xl flex items-center justify-center border border-luxury-gold/25">
              <Landmark className="w-5 h-5" />
            </div>
            <h3 className="font-extrabold text-sm text-white">{t.service1Name}</h3>
            <p className="text-xs text-slate-400 leading-relaxed">{t.service1Desc}</p>
          </div>

          {/* Card 2 */}
          <div className="p-6 bg-luxury-darker rounded-3xl shadow-xs border border-luxury-border/60 hover:border-luxury-gold/40 space-y-3 transition transform hover:-translate-y-1 duration-200">
            <div className="w-10 h-10 bg-luxury-dark text-luxury-gold rounded-xl flex items-center justify-center border border-luxury-gold/25">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="font-extrabold text-sm text-white">{t.service2Name}</h3>
            <p className="text-xs text-slate-400 leading-relaxed">{t.service2Desc}</p>
          </div>

          {/* Card 3 */}
          <div className="p-6 bg-luxury-darker rounded-3xl shadow-xs border border-luxury-border/60 hover:border-luxury-gold/40 space-y-3 transition transform hover:-translate-y-1 duration-200">
            <div className="w-10 h-10 bg-luxury-dark text-luxury-gold rounded-xl flex items-center justify-center border border-luxury-gold/25">
              <CheckCircle className="w-5 h-5" />
            </div>
            <h3 className="font-extrabold text-sm text-white">{t.service3Name}</h3>
            <p className="text-xs text-slate-400 leading-relaxed">{t.service3Desc}</p>
          </div>

          {/* Card 4 */}
          <div className="p-6 bg-luxury-darker rounded-3xl shadow-xs border border-luxury-border/60 hover:border-luxury-gold/40 space-y-3 transition transform hover:-translate-y-1 duration-200">
            <div className="w-10 h-10 bg-luxury-dark text-luxury-gold rounded-xl flex items-center justify-center border border-luxury-gold/25">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="font-extrabold text-sm text-white">{t.service4Name}</h3>
            <p className="text-xs text-slate-400 leading-relaxed">{t.service4Desc}</p>
          </div>
        </div>
      </section>

      {/* 4. Real-time Pitch & Value Props */}
      <section className="py-20 px-6 bg-luxury-darker border-b border-luxury-border/30">
        <div className="max-w-5xl mx-auto text-center space-y-12">
          <h2 className="text-3xl font-black text-white tracking-tight uppercase font-sans">
            {t.whyTitle}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-luxury-border/60 gap-8 md:gap-0 text-center">
            <div className="space-y-3 p-4">
              <div className="w-12 h-12 rounded-full bg-luxury-dark border border-luxury-gold/30 flex items-center justify-center mx-auto text-luxury-gold shadow-md">
                <Award className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-[#f3f4f6] text-sm tracking-wide uppercase">{t.why1Title}</h3>
              <p className="text-slate-400 text-xs leading-relaxed max-w-xs mx-auto">{t.why1Desc}</p>
            </div>

            <div className="space-y-3 p-4">
              <div className="w-12 h-12 rounded-full bg-luxury-dark border border-luxury-gold/30 flex items-center justify-center mx-auto text-luxury-gold shadow-md">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-[#f3f4f6] text-sm tracking-wide uppercase">{t.why2Title}</h3>
              <p className="text-slate-400 text-xs leading-relaxed max-w-xs mx-auto">{t.why2Desc}</p>
            </div>

            <div className="space-y-3 p-4">
              <div className="w-12 h-12 rounded-full bg-luxury-dark border border-luxury-gold/30 flex items-center justify-center mx-auto text-luxury-gold shadow-md">
                <Bot className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-[#f3f4f6] text-sm tracking-wide uppercase">{t.why3Title}</h3>
              <p className="text-slate-400 text-xs leading-relaxed max-w-xs mx-auto">{t.why3Desc}</p>
            </div>
          </div>
        </div>
      </section>

      {/* PORTFOLIO & PORTRAIT PHOTO GALLERY */}
      <section id="portfolio" className="py-20 px-6 bg-luxury-darker transition-colors duration-300">
        <div className="max-w-7xl mx-auto space-y-12">
          
          <div className="text-center space-y-4">
            <span className="px-3 py-1 bg-luxury-dark border border-luxury-gold/20 text-luxury-gold text-[10px] font-black tracking-widest uppercase rounded-full">
              PORTFÓLIO DE SUCESSO
            </span>
            <h2 className="text-3xl font-black tracking-tight text-white uppercase">
              Nossos Trabalhos Realizados
            </h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              Conheça alguns dos mais de 2.000 projetos em esquadrias de alumínio e vidros de segurança entregues na Região Metropolitana de Porto Alegre.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Gallery Item 1 */}
            <div className="group relative overflow-hidden bg-luxury-dark rounded-2xl shadow-md border border-luxury-border/60 hover:border-luxury-gold/30 transition-all duration-300 hover:scale-102">
              <div className="aspect-video w-full overflow-hidden bg-luxury-darker relative">
                <img 
                  src={heroImg} 
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500" 
                  alt="Residencial Alto Padrão - Porto Alegre"
                />
                <span className="absolute top-3 left-3 px-2 py-0.5 bg-luxury-gold text-luxury-darker font-mono text-[9px] font-bold rounded-md uppercase tracking-wider">
                  Residencial
                </span>
              </div>
              <div className="p-4 text-left">
                <h4 className="font-extrabold text-sm text-white group-hover:text-luxury-gold transition-colors duration-200">
                  Residencial Alto Padrão
                </h4>
                <p className="text-[10px] text-slate-450 mt-1">Porto Alegre - RS</p>
              </div>
            </div>

            {/* Gallery Item 2 */}
            <div className="group relative overflow-hidden bg-luxury-dark rounded-2xl shadow-md border border-luxury-border/60 hover:border-luxury-gold/30 transition-all duration-300 hover:scale-102">
              <div className="aspect-video w-full overflow-hidden bg-luxury-darker relative">
                <img 
                  src={facadeImg} 
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500" 
                  alt="Corporate Tower - Centro Histórico"
                />
                <span className="absolute top-3 left-3 px-2 py-0.5 bg-luxury-gold text-luxury-darker font-mono text-[9px] font-bold rounded-md uppercase tracking-wider">
                  Corporativo
                </span>
              </div>
              <div className="p-4 text-left">
                <h4 className="font-extrabold text-sm text-white group-hover:text-luxury-gold transition-colors duration-200">
                  Corporate Tower
                </h4>
                <p className="text-[10px] text-slate-450 mt-1">Centro Histórico - POA</p>
              </div>
            </div>

            {/* Gallery Item 3 */}
            <div className="group relative overflow-hidden bg-luxury-dark rounded-2xl shadow-md border border-luxury-border/60 hover:border-luxury-gold/30 transition-all duration-300 hover:scale-102">
              <div className="aspect-video w-full overflow-hidden bg-luxury-darker relative">
                <img 
                  src={bathImg} 
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500" 
                  alt="Box Premium Canoas - RS"
                />
                <span className="absolute top-3 left-3 px-2 py-0.5 bg-luxury-gold text-luxury-darker font-mono text-[9px] font-bold rounded-md uppercase tracking-wider">
                  Box de Luxo
                </span>
              </div>
              <div className="p-4 text-left">
                <h4 className="font-extrabold text-sm text-white group-hover:text-luxury-gold transition-colors duration-200">
                  Box e Divisórias
                </h4>
                <p className="text-[10px] text-slate-450 mt-1">Canoas - RS</p>
              </div>
            </div>

            {/* Gallery Item 4 */}
            <div className="group relative overflow-hidden bg-luxury-dark rounded-2xl shadow-md border border-luxury-border/60 hover:border-luxury-gold/30 transition-all duration-300 hover:scale-102">
              <div className="aspect-video w-full overflow-hidden bg-luxury-darker relative">
                <img 
                  src={pergolaImg} 
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500" 
                  alt="Coberturas e Pergolados Novo Hamburgo"
                />
                <span className="absolute top-3 left-3 px-2 py-0.5 bg-luxury-gold text-luxury-darker font-mono text-[9px] font-bold rounded-md uppercase tracking-wider">
                  Pergolado
                </span>
              </div>
              <div className="p-4 text-left">
                <h4 className="font-extrabold text-sm text-white group-hover:text-luxury-gold transition-colors duration-200">
                  Coberturas em Vidro
                </h4>
                <p className="text-[10px] text-slate-450 mt-1">Novo Hamburgo - RS</p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* AGENDAR VISITA TÉCNICA GRATUITA WITH REAL FIREBASE INTEGRATION */}
      <section id="agendar" className="py-20 px-6 bg-luxury-dark border-b border-luxury-border/30 transition-colors duration-300">
        <div className="max-w-4xl mx-auto">
          
          <div className="text-center space-y-4 mb-12">
            <span className="px-3 py-1 bg-luxury-darker border border-luxury-gold/20 text-luxury-gold text-[10px] font-black tracking-widest uppercase rounded-full">
              MEDIÇÃO LASER & PLANEJAMENTO
            </span>
            <h2 className="text-3xl font-black tracking-tight text-white uppercase">
              Agende sua Visita Técnica Gratuita
            </h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              Nossa equipe certificada irá até seu local em Porto Alegre e arredores para avaliar seu projeto, fazer a medição técnica exata e garantir um orçamento perfeito sem compromisso.
            </p>
          </div>

          {schSubmittedSuccess ? (
            <div className="p-8 bg-luxury-darker border border-luxury-border rounded-3xl text-center space-y-4 shadow-2xl shadow-black">
              <div className="w-16 h-16 bg-luxury-dark text-luxury-gold rounded-full flex items-center justify-center mx-auto border border-luxury-gold/35">
                <CheckCircle className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold text-white uppercase tracking-wider">
                Visita Agendada com Sucesso!
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                Seu agendamento técnico foi transmitido com sucesso ao painel. Nossa equipe entrará em contato comercial via WhatsApp ou e-mail de imediato para confirmar o dia exato.
              </p>
              <button
                onClick={() => setSchSubmittedSuccess(false)}
                className="px-5 py-2.5 bg-luxury-gold hover:bg-luxury-gold-dark text-luxury-darker rounded-xl text-xs font-bold uppercase tracking-wider transition shadow-md cursor-pointer"
              >
                Agendar Outra Visita
              </button>
            </div>
          ) : (
            <form onSubmit={handleVisitorScheduleVisit} className="bg-luxury-darker p-8 rounded-3xl border border-luxury-border shadow-2xl shadow-black/80 space-y-6 text-left transition-colors duration-300">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                <div>
                  <label className="block text-[10px] font-extrabold text-luxury-gold/90 uppercase mb-1.5 tracking-wider">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={schName}
                    onChange={(e) => setSchName(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-luxury-border bg-luxury-dark text-white rounded-lg focus:border-luxury-gold focus:ring-1 focus:ring-luxury-gold/50 outline-hidden"
                    placeholder="Seu nome"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-luxury-gold/90 uppercase mb-1.5 tracking-wider">
                    E-mail de Contato
                  </label>
                  <input
                    type="email"
                    value={schEmail}
                    onChange={(e) => setSchEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-luxury-border bg-luxury-dark text-white rounded-lg focus:border-luxury-gold focus:ring-1 focus:ring-luxury-gold/50 outline-hidden"
                    placeholder="seu@email.com"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-luxury-gold/90 uppercase mb-1.5 tracking-wider">
                    Telefone / WhatsApp *
                  </label>
                  <input
                    type="text"
                    required
                    value={schPhone}
                    onChange={(e) => setSchPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-luxury-border bg-luxury-dark text-white rounded-lg focus:border-luxury-gold focus:ring-1 focus:ring-luxury-gold/50 outline-hidden"
                    placeholder="(51) 99999-9999"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-luxury-gold/90 uppercase mb-1.5 tracking-wider">
                    Tipo de Serviço Preferencial
                  </label>
                  <select
                    value={schService}
                    onChange={(e) => setSchService(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs border border-luxury-border bg-luxury-dark text-white rounded-lg focus:border-luxury-gold focus:ring-1 focus:ring-luxury-gold/50 cursor-pointer outline-hidden"
                  >
                    <option value="Esquadrias Residenciais" className="bg-luxury-dark text-white">Esquadrias Residenciais (Janelas e Portas)</option>
                    <option value="Fachadas Corporativas" className="bg-luxury-dark text-white">Fachadas Corporativas (Pele de Vidro)</option>
                    <option value="Vidros Temperados e Laminados" className="bg-luxury-dark text-white">Vidros Temperados e Laminados</option>
                    <option value="Box para Banheiro" className="bg-luxury-dark text-white">Box para Banheiro</option>
                    <option value="Guarda-corpos e Corrimãos" className="bg-luxury-dark text-white">Guarda-corpos e Corrimãos</option>
                    <option value="Coberturas e Pergolados" className="bg-luxury-dark text-white">Coberturas e Pergolados</option>
                    <option value="Manutenção de Esquadrias" className="bg-luxury-dark text-white">Reparo / Manutenção de Vidros</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-extrabold text-luxury-gold/90 uppercase mb-1.5 tracking-wider">
                    Endereço Completo para Visita *
                  </label>
                  <input
                    type="text"
                    required
                    value={schAddress}
                    onChange={(e) => setSchAddress(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-luxury-border bg-luxury-dark text-white rounded-lg focus:border-luxury-gold focus:ring-1 focus:ring-luxury-gold/50 outline-hidden"
                    placeholder="Rua, número, bairro, cidade"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-luxury-gold/90 uppercase mb-1.5 tracking-wider">
                    Data De Preferência *
                  </label>
                  <input
                    type="date"
                    required
                    value={schDate}
                    onChange={(e) => setSchDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-luxury-border bg-luxury-dark text-white rounded-lg focus:border-luxury-gold focus:ring-1 focus:ring-luxury-gold/50 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-luxury-gold/90 uppercase mb-1.5 tracking-wider">
                    Horário Preferencial *
                  </label>
                  <select
                    value={schTime}
                    onChange={(e) => setSchTime(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs border border-luxury-border bg-luxury-dark text-white rounded-lg focus:border-luxury-gold focus:ring-1 focus:ring-luxury-gold/50 cursor-pointer outline-hidden"
                  >
                    <option value="08:00" className="bg-luxury-dark text-white">08:00 (Manhã)</option>
                    <option value="09:00" className="bg-luxury-dark text-white">09:00 (Manhã)</option>
                    <option value="10:00" className="bg-luxury-dark text-white">10:00 (Manhã)</option>
                    <option value="11:00" className="bg-luxury-dark text-white">11:00 (Manhã)</option>
                    <option value="14:00" className="bg-luxury-dark text-white">14:00 (Tarde)</option>
                    <option value="15:00" className="bg-luxury-dark text-white">15:00 (Tarde)</option>
                    <option value="16:00" className="bg-luxury-dark text-white">16:00 (Tarde)</option>
                    <option value="17:00" className="bg-luxury-dark text-white">17:00 (Tarde)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-extrabold text-luxury-gold/90 uppercase mb-1.5 tracking-wider">
                    Observações / Descrição Breve do Projeto
                  </label>
                  <textarea
                    value={schNotes}
                    onChange={(e) => setSchNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 text-xs border border-luxury-border bg-luxury-dark text-white rounded-lg focus:border-luxury-gold focus:ring-1 focus:ring-luxury-gold/50 outline-hidden"
                    placeholder="Descreva as medidas ou detalhes dos vidros/alumínio..."
                  />
                </div>

              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={schIsSubmitting}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-luxury-gold hover:bg-luxury-gold-dark text-luxury-darker rounded-2xl text-xs font-black tracking-widest uppercase shadow-md cursor-pointer transition disabled:opacity-50"
                >
                  {schIsSubmitting ? "Cadastrando Solicitação..." : "Agendar Visita Gratuita Agora"}
                </button>
              </div>
            </form>
          )}

        </div>
      </section>

      {/* 5. PUBLIC ESTIMATOR BUILDER ("Solicitar Orçamento" live interactive simulator) */}
      <section id="solicitar" className="py-20 px-6 bg-luxury-darker border-t border-luxury-border/30 transition-colors duration-300">
        <div className="max-w-4xl mx-auto">
          
          <div className="text-center space-y-4 mb-12">
            <span className="px-3 py-1 bg-luxury-dark border border-luxury-gold/20 text-luxury-gold text-[10px] font-black tracking-widest uppercase rounded-full">
              SISTEMA INTEGRADO DE ENTRADA DE ESTIMATIVAS
            </span>
            <h2 className="text-3xl font-black tracking-tight text-white uppercase">
              {t.ctaGetBudget}
            </h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              Simule seus itens abaixo. Ao enviar, nossa Inteligência Artificial registrará o orçamento e alertará o administrador do sistema para prosseguir de imediato.
            </p>
          </div>

          {visSubmittedSuccess ? (
            <div className="p-8 bg-luxury-darker border border-luxury-border rounded-3xl text-center space-y-4 shadow-2xl shadow-black">
              <div className="w-16 h-16 bg-luxury-dark text-luxury-gold rounded-full flex items-center justify-center mx-auto border border-luxury-gold/30">
                <CheckCircle className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold text-white uppercase tracking-wider">
                Solicitação Recebida com Sucesso!
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                A sua estimativa de orçamento foi registrada no Firestore com status <span className="font-bold underline text-luxury-gold">Pendente</span>. Nosso assistente de IA Anacleto e consultores fiscais darão o retorno imediato por e-mail.
              </p>
              <button
                onClick={() => setVisSubmittedSuccess(false)}
                className="px-5 py-2.5 bg-luxury-gold hover:bg-luxury-gold-dark text-luxury-darker rounded-xl text-xs font-black uppercase tracking-wider transition shadow-md cursor-pointer"
              >
                Simular Novo Orçamento
              </button>
            </div>
          ) : (
            <>
              {/* AI Custom Project Generator Assistant */}
              <div className="bg-luxury-dark/95 border-2 border-luxury-gold/30 p-6 rounded-3xl space-y-4 mb-6 shadow-2xl relative overflow-hidden transition-all text-left">
                <div className="absolute top-0 right-0 w-32 h-32 bg-luxury-gold/5 rounded-full blur-2xl pointer-events-none"></div>
                
                <div className="flex items-start gap-3">
                  <span className="p-2 bg-luxury-gold/10 text-luxury-gold rounded-xl shrink-0">
                    <Sparkles className="w-5 h-5 animate-pulse" />
                  </span>
                  <div className="text-left space-y-1">
                    <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                      {language === "es" ? "Asistente de Diseño Inteligente IA" : language === "en" ? "AI Smart Design & Spec Assistant" : "Assistente de Design Inteligente IA"}
                      <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-400/20 text-[9px] uppercase tracking-widest rounded-full font-bold font-mono">ONLINE</span>
                    </h3>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {language === "es" ? "Describa su obra libremente o use una plantilla de alta gama. Nuestro proyectista de IA generará los vanos, esquadrías y vidrios lógicos bajo normas NBR." : language === "en" ? "Describe your architectural project or use a luxury layout preset. Our technical AI model will design logical specs, materials, and hospitality standards instantly." : "Descreva sua obra livremente ou utilize um modelo de alto padrão pré-definido. Nosso engenheiro de IA formulará os vãos, esquadrias e vidros lógicos adequados às normas técnicas."}
                    </p>
                  </div>
                </div>

                {/* Quick High-End Preset templates */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleGenerateAiEstimatePreset(
                      language === "es" 
                        ? "Apartamento de alta gama frente al mar: 3 ventanas de corredera Suprema negras, 2 ventanas Gold bronce, mampara de baño Elegance"
                        : language === "en"
                          ? "High-end sea-view apartment: 3 black Suprema sliding windows, 2 bronze Gold doors, and 1 certified safety glass railing"
                          : "Apartamento de alto padrão frente mar: 3 portas de correr Suprema pretas, 2 janelas Gold bronze de correr, e guarda-corpo de vidro de segurança"
                    )}
                    disabled={visAiIsGenerating}
                    className="px-3 py-2 bg-luxury-darker hover:bg-luxury-gold/15 border border-luxury-gold/15 text-left text-[10px] text-slate-350 rounded-xl transition cursor-pointer flex flex-col justify-between group active:scale-95 disabled:opacity-50"
                  >
                    <span className="font-extrabold text-luxury-gold uppercase tracking-wider group-hover:text-white mb-1">🏢 Apt. Frente Mar</span>
                    <span className="text-[9px] line-clamp-2 text-slate-405 font-medium">Esquadrias de correr pretas Suprema com tratamento salino, vidros laminados e guarda-corpos.</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleGenerateAiEstimatePreset(
                      language === "es"
                        ? "Mansión moderna minimalista: fachada de muro cortina acristalado de 15m² con vidros de control solar, 4 vãos grandes de corredera Gold"
                        : language === "en"
                          ? "Modern minimalist villa: 15sqm glazing curtain wall (high thermal efficiency), 4 large sliding glass panes, and 1 glass canopy"
                          : "Vivenda Minimalista Completa: fachada pele de vidro (glazing) de 15m² de controle térmico, 3 grandes vãos de vidro duplo acústico, e cobertura de vidro laminado"
                    )}
                    disabled={visAiIsGenerating}
                    className="px-3 py-2 bg-luxury-darker hover:bg-luxury-gold/15 border border-luxury-gold/15 text-left text-[10px] text-slate-350 rounded-xl transition cursor-pointer flex flex-col justify-between group active:scale-95 disabled:opacity-50"
                  >
                    <span className="font-extrabold text-luxury-gold uppercase tracking-wider group-hover:text-white mb-1">🏡 Casa Minimalista</span>
                    <span className="text-[9px] line-clamp-2 text-slate-405 font-medium">Fachada Pele de Vidro glazing, isolamento acústico premium e vidros duplos de controle solar.</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleGenerateAiEstimatePreset(
                      language === "es"
                        ? "Área gourmet y piscina: cerramiento de terraza en vidrio templado de corredera de 8 metros, barandillas certificadas y mampara de ducha"
                        : language === "en"
                          ? "Gourmet deck & pool: sliding glass terrace doors of 8 meters, certified NBR structural handrails, and executive bath box"
                          : "Área Gourmet e Piscina: fechamento de sacada em vidro temperado de correr de 8 metros, guarda-corpos certificados NBR 14718 e box de banheiro design"
                    )}
                    disabled={visAiIsGenerating}
                    className="px-3 py-2 bg-luxury-darker hover:bg-luxury-gold/15 border border-luxury-gold/15 text-left text-[10px] text-slate-350 rounded-xl transition cursor-pointer flex flex-col justify-between group active:scale-95 disabled:opacity-50"
                  >
                    <span className="font-extrabold text-luxury-gold uppercase tracking-wider group-hover:text-white mb-1">🍹 Espaço Gourmet & Lazer</span>
                    <span className="text-[9px] line-clamp-2 text-slate-450 font-medium">Sacada integrada em vidro temperado 10mm, corrimão estrutural e ferragens em aço inoxidável.</span>
                  </button>
                </div>

                {/* Free-text input field for natural description */}
                <div className="pt-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={visAiPrompt}
                      onChange={(e) => setVisAiPrompt(e.target.value)}
                      placeholder={
                        language === "es" 
                          ? "Ej: Quiero acristalar una terraza de 6m con 3 ventanas de correr y barandilla..." 
                          : language === "en" 
                            ? "E.g., I want to glaze a 6m terrace with sliding glass panels and structural handrails..." 
                            : "Ex: Quero fechar uma sacada de 5 metros com portas de correr Suprema pretas e corrimão..."
                      }
                      className="flex-1 px-3 py-2 text-xs border border-luxury-border bg-luxury-darker text-white rounded-xl focus:border-luxury-gold focus:ring-1 focus:ring-luxury-gold/50 outline-hidden"
                      disabled={visAiIsGenerating}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleGenerateAiEstimatePreset();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleGenerateAiEstimatePreset()}
                      disabled={visAiIsGenerating || !visAiPrompt.trim()}
                      className="px-4 py-2 bg-luxury-gold hover:bg-luxury-gold-dark text-luxury-darker text-[10px] uppercase font-black tracking-wider rounded-xl transition cursor-pointer disabled:opacity-40 shrink-0 flex items-center gap-1.5 font-sans"
                    >
                      {visAiIsGenerating ? (
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-luxury-darker rounded-full animate-ping"></span>
                          Otimizando...
                        </span>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          Otimizar com IA
                        </>
                      )}
                    </button>
                  </div>
                  {visAiSuccessMsg && (
                    <p className="text-[10px] text-emerald-400 mt-2 font-semibold text-left">
                      {visAiSuccessMsg}
                    </p>
                  )}
                </div>
              </div>

              <form onSubmit={handleVisitorSubmitEstimate} className="bg-luxury-dark p-8 rounded-3xl border border-luxury-border shadow-2xl shadow-black/80 space-y-6 text-left transition-colors duration-300">
              
              {/* Visitor credentials block */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-extrabold text-luxury-gold/90 uppercase mb-1.5 tracking-wider">
                    {t.clientNameLabel} *
                  </label>
                  <input
                    type="text"
                    required
                    value={visName}
                    onChange={(e) => setVisName(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-luxury-border bg-luxury-darker text-white rounded-lg focus:border-luxury-gold focus:ring-1 focus:ring-luxury-gold/50 outline-hidden"
                    placeholder="Ex: Pedro Fernandes"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-luxury-gold/90 uppercase mb-1.5 tracking-wider">
                    {t.clientEmailLabel} *
                  </label>
                  <input
                    type="email"
                    required
                    value={visEmail}
                    onChange={(e) => setVisEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-luxury-border bg-luxury-darker text-white rounded-lg focus:border-luxury-gold focus:ring-1 focus:ring-luxury-gold/50 outline-hidden"
                    placeholder="exemplo@gmail.com"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-luxury-gold/90 uppercase mb-1.5 tracking-wider">
                    {t.clientNifLabel} *
                  </label>
                  <input
                    type="text"
                    required
                    value={visNif}
                    onChange={(e) => setVisNif(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-luxury-border bg-luxury-darker text-white rounded-lg focus:border-luxury-gold focus:ring-1 focus:ring-luxury-gold/50 outline-hidden"
                    placeholder="NIF / PT 123456789"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-luxury-gold/90 uppercase mb-1.5 tracking-wider">
                    Morada / Endereço Completo
                  </label>
                  <input
                    type="text"
                    value={visAddress}
                    onChange={(e) => setVisAddress(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-luxury-border bg-luxury-darker text-white rounded-lg focus:border-luxury-gold focus:ring-1 focus:ring-luxury-gold/50 outline-hidden"
                    placeholder="Av. Principal, Lisboa"
                  />
                </div>
              </div>

              {/* Dynamic Line builder */}
              <div className="border-t border-luxury-border pt-6 space-y-3">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="text-[10px] font-extrabold uppercase text-luxury-gold tracking-widest">
                    {t.itemsLabel}
                  </h3>
                  <button
                    type="button"
                    onClick={addEstimateLine}
                    className="text-[11px] font-black uppercase tracking-wider px-3 py-1.5 bg-luxury-darker hover:bg-[#1d1f26] text-luxury-gold border border-luxury-gold/20 rounded-lg transition cursor-pointer"
                  >
                    + Adicionar Serviço
                  </button>
                </div>

                {visCustomLines.map((line, idx) => (
                  <div key={line.id} className="flex flex-col sm:flex-row items-center gap-3 bg-luxury-darker p-3 rounded-xl border border-luxury-border/60">
                    <div className="flex-1 w-full text-white">
                      <select
                        value={line.description}
                        onChange={(e) => {
                          const selVal = e.target.value;
                          updateEstimateLine(line.id, "description", selVal);
                          updateEstimateLine(line.id, "price", 0);
                        }}
                        className="w-full px-3 py-2.5 text-xs bg-luxury-dark border border-luxury-border text-white rounded-lg focus:border-luxury-gold focus:ring-1 focus:ring-luxury-gold/50 cursor-pointer outline-hidden"
                      >
                        <option value="Janelas e Portas de Alumínio Customizadas (Linha Suprema/Gold)" className="bg-luxury-dark text-white">Janelas e Portas de Alumínio Customizadas (Linhas Suprema / Gold)</option>
                        <option value="Fachadas Pele de Vidro e Glazing de Alta Eficiência" className="bg-luxury-dark text-white">Fachadas Pele de Vidro e Glazing de Alta Eficiência</option>
                        <option value="Vidro Temperado e Laminado de Segurança Sob Medida" className="bg-luxury-dark text-white">Vidro Temperado e Laminado de Segurança (Divisórias, Portas)</option>
                        <option value="Box de Canto em Vidro Temperado 8mm Tratado" className="bg-luxury-dark text-white">Box para Banheiro em Vidro Temperado de Segurança</option>
                        <option value="Guarda-corpos e Corrimãos Certificados NBR 14718" className="bg-luxury-dark text-white">Guarda-corpos e Corrimãos Certificados NBR 14718</option>
                        <option value="Coberturas e Pergolados de Alumínio e Vidros de Controle" className="bg-luxury-dark text-white">Coberturas e Pergolados de Alumínio e Vidro</option>
                        <option value="Instalação Especializada e Limpeza Técnica" className="bg-luxury-dark text-white">Instalação Especializada e Limpeza Técnica Inclusa</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto text-xs font-semibold shrink-0">
                      <div className="flex items-center gap-1.5 bg-luxury-dark border border-luxury-border px-2.5 py-1.5 rounded-lg">
                        <span className="text-[10px] uppercase text-luxury-gold">Qtd / m²:</span>
                        <input
                          type="number"
                          min="1"
                          value={line.qty}
                          onChange={(e) => updateEstimateLine(line.id, "qty", parseInt(e.target.value) || 1)}
                          className="w-12 text-center bg-transparent border-0 text-white focus:ring-0 outline-hidden p-0 font-bold"
                          placeholder="Qtd"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => removeEstimateLine(line.id)}
                        className="text-rose-500 hover:text-rose-450 p-2 border border-luxury-border hover:bg-rose-950/30 rounded-lg transition cursor-pointer"
                        title="Remover Item"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total simulation banner in place of raw pricing calculations */}
              <div className="p-5 bg-luxury-darker border border-luxury-gold/25 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs">
                <div className="space-y-1 text-left">
                  <h4 className="font-extrabold text-luxury-gold flex items-center gap-2 uppercase tracking-wide">
                    <span>✨</span> Orçamento Personalizado sob Medida
                  </h4>
                  <p className="text-slate-400 leading-relaxed max-w-2xl">
                    Para garantir precisão e conformidade técnica rígida da ABNT, os layouts e quantitativos finais de esquadrias ou vidros são validados gratuitamente em sua residência ou empresa por nossa equipe técnica através de medição a laser exclusiva.
                  </p>
                </div>
                <div className="shrink-0 bg-luxury-dark px-3 py-2 rounded-xl text-luxury-gold font-extrabold border border-luxury-gold/30 uppercase tracking-widest text-[10px] shadow-sm">
                  Sob Consulta Técnica
                </div>
              </div>

              {/* Submit panel */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={visIsSubmitting}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-luxury-gold hover:bg-luxury-gold-dark text-luxury-darker rounded-2xl text-xs font-black tracking-widest uppercase shadow-md cursor-pointer transition disabled:opacity-50"
                >
                  {visIsSubmitting ? "Enviando estimativa..." : "Transmitir Orçamento Pendente →"}
                </button>
              </div>

            </form>
          </>
        )}

        </div>
      </section>

      {/* Footer copyright */}
      <footer className="mt-auto py-10 text-center border-t border-luxury-border bg-luxury-darker transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="font-black tracking-widest uppercase text-white font-sans">ANACLETO</span>
            <span>M.10 MULTILINGUAL SAAS</span>
          </div>
          <p>{t.footerRights}</p>
        </div>
      </footer>

      {/* Floating 10 languages Chatbot Virtual Assistant */}
      <Chatbot currentLanguage={language} t={t} />

      {/* Floating Localized WhatsApp Fast Contact */}
      <WhatsAppButton currentLanguage={language} />

    </div>
  );
}
