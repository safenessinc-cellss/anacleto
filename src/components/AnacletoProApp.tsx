import React, { useState, useEffect, useRef } from "react";
import { Building, Calendar, ChevronRight, Compass, ExternalLink, FileCheck, FileText, Globe, LayoutDashboard, LogOut, Menu, Moon, Package, Settings, Shield, ShieldCheck, Sparkles, Sun, Wallet, X, Palette } from "lucide-react";
import { collection, onSnapshot, query, orderBy, doc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { db } from "../firebase";
import { Quote, Invoice, Company, TechnicalDrawing, SenderConfig } from "../types";
import DashboardOverview from "./dashboard/DashboardOverview";
import CrmModule from "./crm/CrmModule";
import QuotesModule from "./quotes/QuotesModule";
import InvoicesModule from "./invoices/InvoicesModule";
import TechnicalDrawingModule from "./technical-drawing/TechnicalDrawingModule";
import AgendaModule from "./agenda/AgendaModule";
import SettingsModule from "./settings/SettingsModule";
import FinanceModule from "./finance/FinanceModule";
import FinancialAI from "./finance/FinancialAI";
import ThemeModule from "./settings/ThemeModule";
import AdminModule from "./admin/AdminModule";
import { Role, getRoleConfig, hasAccessToTab, NavigationTab as RoleNavTab } from "../utils/roles";
import PayrollModule from "./hr/PayrollModule";
import CatalogModule from "./catalog/CatalogModule";
import RegistryModule from "./registry/RegistryModule";
import SupplierSuperCatalog from "./supplier-catalog/SupplierSuperCatalog";
import logoImg from "../assets/images/anacleto-logo-premium.svg";
import BusinessWorkspace from "./workspace/BusinessWorkspace";

type NavigationTab = "dashboard" | "crm" | "quotes" | "invoices" | "technical_drawing" | "agenda" | "catalog" | "finance" | "settings" | "financial_ai" | "theme" | "admin" | "cadastro_items" | "products" | "services" | "payment_methods" | "measurement" | "contracts" | "cut_plan" | "profile_optimization" | "materials" | "payroll" | "reports" | "tipologias" | "projects" | "profile" | "suggestions";

interface AnacletoProAppProps {
  senderConfig: SenderConfig;
  setSenderConfig: React.Dispatch<React.SetStateAction<SenderConfig>>;
  onSwitchToPublicLanding?: () => void;
  onLogout?: () => void;
  language?: string;
  onLanguageChange?: (lang: string) => void;
  userRole?: Role;
}

export default function AnacletoProApp({
  senderConfig,
  setSenderConfig,
  onSwitchToPublicLanding,
  onLogout,
  language = "pt",
  onLanguageChange,
  userRole = "usuario",
}: AnacletoProAppProps) {
  const [signedInEmail, setSignedInEmail] = useState(auth.currentUser?.email?.toLowerCase() || "");
  const effectiveRole: Role = signedInEmail === "safeness.c.a@gmail.com" ? "super_admin" : userRole;
  const roleConfig = getRoleConfig(effectiveRole);
  const [activeTab, setActiveTab] = useState<NavigationTab>("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [customLogo, setCustomLogo] = useState<string>(() => { try { return localStorage.getItem("anacleto_custom_logo") || ""; } catch { return ""; } });
  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; if (!file.type.startsWith("image/")) { window.alert("Selecione um arquivo de imagem."); return; } if (file.size > 2 * 1024 * 1024) { window.alert("A imagem deve ter no máximo 2 MB."); return; } const reader = new FileReader(); reader.onload = () => { const value = String(reader.result || ""); setCustomLogo(value); try { localStorage.setItem("anacleto_custom_logo", value); } catch { window.alert("Imagem grande demais para salvar neste navegador."); } }; reader.readAsDataURL(file); event.target.value = ""; };
  const [isDark, setIsDark] = useState(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  );
  const toggleThemeQuick = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    localStorage.setItem("anacleto_theme_mode", next ? "dark" : "light");
  };

  // Firestore Shared Collections State
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [drawings, setDrawings] = useState<TechnicalDrawing[]>([]);
  const [userPermissions, setUserPermissions] = useState<string[] | null>(null);
  const isFullMenuRole = effectiveRole === "super_admin" || effectiveRole === "super_usuario" || effectiveRole === "ceo";
  const canSeeNavigation = (id: string) => isFullMenuRole || (userPermissions ? userPermissions.includes(id) : hasAccessToTab(effectiveRole, id as RoleNavTab));
  // A autenticação precisa ser inicializada antes de qualquer efeito que a consulte.
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const email = signedInEmail || auth.currentUser?.email?.toLowerCase();
    if (!email || isFullMenuRole) { setUserPermissions(null); return; }
    const unsub = onSnapshot(doc(db, "admins", email), (snap) => {
      const data = snap.data();
      setUserPermissions(Array.isArray(data?.permissions) ? data.permissions : null);
    }, () => setUserPermissions(null));
    return () => unsub();
  }, [userRole, authReady, signedInEmail, isFullMenuRole]);

  // 0. Aguarda a autenticação antes de iniciar a escuta do Firestore
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      console.log("🔐 onAuthStateChanged fired:", u ? `user=${u.email}` : "NO USER");
      setSignedInEmail(u?.email?.toLowerCase() || "");
      setAuthReady(!!u);
    });
    return () => unsub();
  }, []);

  // 1. Escuta os orçamentos somente após a autenticação
  useEffect(() => {
    console.log("📊 Quotes listener - authReady:", authReady);
    if (!authReady) return;
    console.log("✅ Quotes listener ACTIVADO (usuario autenticado)");
    const unsub = onSnapshot(
      query(collection(db, "quotes"), orderBy("createdAt", "desc")),
      (snap) => {
        const list: Quote[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Quote));
        setQuotes(list);
      },
      (err) => console.warn("Quotes listener:", err)
    );
    return () => unsub();
  }, [authReady]);

  // 2. Escuta as faturas somente após a autenticação
  useEffect(() => {
    if (!authReady) return;
    const unsub = onSnapshot(
      query(collection(db, "invoices"), orderBy("createdAt", "desc")),
      (snap) => {
        const list: Invoice[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Invoice));
        setInvoices(list);
      },
      (err) => console.warn("Invoices listener:", err)
    );
    return () => unsub();
  }, [authReady]);

  // 3. Listen for Companies (CRM)
  useEffect(() => {
    if (!authReady) return;
    const unsub = onSnapshot(
      query(collection(db, "companies"), orderBy("createdAt", "desc")),
      (snap) => {
        const list: Company[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Company));
        setCompanies(list);
      },
      (err) => console.warn("Companies listener:", err)
    );
    return () => unsub();
  }, [authReady]);

  // 4. Escuta os desenhos técnicos somente após a autenticação
  useEffect(() => {
    if (!authReady) return;
    const unsub = onSnapshot(
      query(collection(db, "technical_drawings"), orderBy("createdAt", "desc")),
      (snap) => {
        const list: TechnicalDrawing[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as TechnicalDrawing));
        setDrawings(list);
      },
      (err) => console.warn("Drawings listener:", err)
    );
    return () => unsub();
  }, [authReady]);

  // Navegação organizada como no fluxo de trabalho de esquadrias.
  const [cadastrosOpen, setCadastrosOpen] = useState(true);
  const [gestaoOpen, setGestaoOpen] = useState(true);
  const homeItems = [
    { id: "dashboard" as NavigationTab, label: "Início", icon: LayoutDashboard, badge: null },
  ];
  const cadastroItems = [
    { id: "crm" as NavigationTab, label: "Clientes", icon: Building, badge: companies.length },
    { id: "cadastro_items" as NavigationTab, label: "Itens", icon: Package, badge: null },
    { id: "products" as NavigationTab, label: "Produtos", icon: Package, badge: null },

    { id: "services" as NavigationTab, label: "Serviços", icon: Settings, badge: null },
  ];
  const gestaoItems = [
    { id: "quotes" as NavigationTab, label: "Orçamentos", icon: FileText, badge: quotes.length },
    { id: "measurement" as NavigationTab, label: "Ficha de Medição", icon: Calendar, badge: null },
    { id: "contracts" as NavigationTab, label: "Contratos", icon: FileCheck, badge: null },
    { id: "cut_plan" as NavigationTab, label: "Plano de Corte", icon: Compass, badge: null },
    { id: "profile_optimization" as NavigationTab, label: "Aproveitamento de Perfis", icon: Package, badge: null },
    { id: "materials" as NavigationTab, label: "Lista de Materiais", icon: Package, badge: null },
    { id: "payroll" as NavigationTab, label: "Folha de Pagamento", icon: Wallet, badge: "RH" },
  ];

  const visibleGestaoItems = gestaoItems.filter((item) => isFullMenuRole || item.id !== "payroll" && hasAccessToTab(effectiveRole, item.id as RoleNavTab));
  const utilityItems = [
    { id: "reports" as NavigationTab, label: "Relatórios de Vendas e Custos", icon: Wallet, badge: "BI" },
    { id: "tipologias" as NavigationTab, label: "Tipologias", icon: Package, badge: null },
    { id: "projects" as NavigationTab, label: "Projetos", icon: Compass, badge: null },
    { id: "agenda" as NavigationTab, label: "Agenda", icon: Calendar, badge: null },
    { id: "finance" as NavigationTab, label: "Financeiro", icon: Wallet, badge: null },
    { id: "financial_ai" as NavigationTab, label: "IA Financeira", icon: Sparkles, badge: "NOVO" },
    { id: "technical_drawing" as NavigationTab, label: "Desenho Técnico 2D", icon: Compass, badge: "CAD" },
    { id: "admin" as NavigationTab, label: "Administração", icon: Shield, badge: roleConfig.canManageUsers ? "ROLES" : null },
    { id: "suggestions" as NavigationTab, label: "Sugestões", icon: Sparkles, badge: null },
    { id: "theme" as NavigationTab, label: "Aparência", icon: Palette, badge: null },
    { id: "profile" as NavigationTab, label: "Meu Perfil", icon: Building, badge: null },
    { id: "settings" as NavigationTab, label: "Configurações", icon: Settings, badge: null },
  ].filter((item) => hasAccessToTab(effectiveRole, item.id as RoleNavTab));

  const handleSelectCompanyForQuote = (comp: Company) => {
    setActiveTab("quotes");
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 dark:bg-[#101827] dark:text-slate-100 flex flex-col lg:flex-row font-sans">
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => logoInputRef.current?.click()} className="w-14 h-9 rounded-lg bg-slate-950 border border-amber-500/30 flex items-center justify-center overflow-hidden p-0.5" title="Alterar logotipo">{customLogo ? <img src={customLogo} alt="Logotipo" className="w-full h-full object-contain" /> : <img src={logoImg} alt="Anacleto Esquadrias" className="w-full h-full object-contain" />}</button>
          <div>
            <h1 className="text-sm font-black text-white tracking-widest uppercase">ANACLETO ESQUADRIAS</h1>
            <p className="text-[9px] text-amber-400 font-mono">Vidraçaria e esquadrias de alumínio</p>
          </div>
        </div>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-slate-300 hover:text-white rounded-lg bg-slate-800"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* SIDEBAR (Desktop & Mobile Drawer) */}
      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen ${sidebarCollapsed ? "lg:w-[88px]" : "lg:w-72"} w-72 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 z-50 flex flex-col justify-between transition-all duration-300 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="p-4 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
          <div className={`hidden lg:flex ${sidebarCollapsed ? "justify-center" : "justify-end"}`}><button onClick={() => setSidebarCollapsed(v => !v)} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-700 transition" title={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}><Menu className="h-4 w-4"/></button></div>
          {/* Brand Logo & Title */}
          <div className={`flex items-center gap-3.5 pb-6 border-b border-slate-200 dark:border-slate-800 ${sidebarCollapsed ? "lg:justify-center" : ""}`}>
            <button type="button" onClick={() => logoInputRef.current?.click()} title="Alterar logotipo" className="group relative w-24 h-16 shrink-0 rounded-xl overflow-hidden bg-slate-950 border border-amber-500/30 p-1 shadow-lg shadow-amber-500/10 flex items-center justify-center">
              <div className="w-full h-full bg-white dark:bg-slate-900 rounded-[14px] flex items-center justify-center overflow-hidden">
                {customLogo ? <img src={customLogo} alt="Logotipo personalizado" className="h-full w-full object-contain" /> : <img src={logoImg} alt="Anacleto" className="h-full w-full object-contain" />}
              </div><span className="absolute inset-0 hidden group-hover:flex items-center justify-center bg-black/60 text-[9px] font-bold text-white">ALTERAR</span>
            </button>
            <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" aria-label="Enviar logotipo" />
            {!sidebarCollapsed && <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-base font-black tracking-[0.12em] text-slate-900 dark:text-white uppercase">ANACLETO ESQUADRIAS</h1>
                <span className="px-1.5 py-0.2 bg-amber-500 text-slate-950 font-black text-[9px] rounded-md tracking-wider">
                  PRO
                </span>
              </div>
              <p className="text-[9px] text-slate-400 tracking-wider font-mono uppercase mt-0.5">
                Orçamentos • Desenhos • Faturas
              </p>
            </div>}
          </div>

          {/* Navigation grouped by the user's reference screenshots */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              {!sidebarCollapsed && <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-3 block mb-2">Principal</span>}
              {homeItems.filter((item) => canSeeNavigation(item.id)).map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return <button key={item.label} onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); }}
                  title={item.label} aria-label={item.label} className={`w-full flex items-center ${sidebarCollapsed ? "justify-center px-2" : "justify-between px-3.5"} py-3 rounded-2xl text-xs font-bold transition ${isActive ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-slate-600 dark:text-slate-300 hover:text-blue-700 dark:hover:text-white hover:bg-blue-50 dark:hover:bg-slate-900"}`}>
                  <span className={`flex items-center ${sidebarCollapsed ? "justify-center" : "gap-3"}`}><Icon className={`w-5 h-5 shrink-0 ${isActive ? "text-white" : "text-blue-500"}`} />{!sidebarCollapsed && <span>{item.label}</span>}</span>
                </button>;
              })}
            </div>
            <div className="space-y-1">
              {!sidebarCollapsed && <button onClick={() => setCadastrosOpen(!cadastrosOpen)} aria-expanded={cadastrosOpen}
                className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-blue-700">
                <span>Cadastros</span><ChevronRight className={`w-3.5 h-3.5 transition-transform ${cadastrosOpen ? "rotate-90" : ""}`} />
              </button>}
              {(sidebarCollapsed || cadastrosOpen) && cadastroItems.filter((item) => canSeeNavigation(item.id)).map((item, index) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return <button key={item.label} onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); }}
                  title={item.label} aria-label={item.label} className={`w-full flex items-center ${sidebarCollapsed ? "justify-center px-2" : "justify-between px-3.5"} py-2.5 rounded-xl text-xs font-semibold transition ${isActive ? "bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-600/10 dark:text-blue-300 dark:border-blue-500/20" : "text-slate-500 hover:text-blue-700 hover:bg-blue-50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-900"}`}>
                  <span className={`flex items-center ${sidebarCollapsed ? "justify-center" : "gap-3"}`}><Icon className="w-5 h-5 shrink-0 text-blue-500" />{!sidebarCollapsed && <span>{item.label}</span>}</span>
                  {!sidebarCollapsed && item.badge !== null && <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">{item.badge}</span>}
                </button>;
              })}
            </div>
            <div className="space-y-1">
              {!sidebarCollapsed && <button onClick={() => setGestaoOpen(!gestaoOpen)} aria-expanded={gestaoOpen}
                className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-blue-700">
                <span>Gestão</span><ChevronRight className={`w-3.5 h-3.5 transition-transform ${gestaoOpen ? "rotate-90" : ""}`} />
              </button>}
              {(sidebarCollapsed || gestaoOpen) && visibleGestaoItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return <button key={item.label} onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); }}
                  title={item.label} aria-label={item.label} className={`w-full flex items-center ${sidebarCollapsed ? "justify-center px-2" : "justify-between px-3.5"} py-2.5 rounded-xl text-xs font-semibold transition ${isActive ? "bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-600/10 dark:text-blue-300 dark:border-blue-500/20" : "text-slate-500 hover:text-blue-700 hover:bg-blue-50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-900"}`}>
                  <span className={`flex items-center ${sidebarCollapsed ? "justify-center" : "gap-3"}`}><Icon className="w-5 h-5 shrink-0 text-blue-500" />{!sidebarCollapsed && <span>{item.label}</span>}</span>
                  {!sidebarCollapsed && item.badge !== null && <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">{item.badge}</span>}
                </button>;
              })}
            </div>
            <div className={`space-y-1 pt-2 border-t border-slate-200 dark:border-slate-800 ${sidebarCollapsed ? "mt-2" : ""}`}>
              {utilityItems.filter((item) => canSeeNavigation(item.id)).map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return <button key={item.label} onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); }}
                  title={item.label} aria-label={item.label} className={`w-full flex items-center ${sidebarCollapsed ? "justify-center px-2" : "justify-between px-3.5"} py-2.5 rounded-xl text-xs font-semibold transition ${isActive ? "bg-blue-100 text-blue-800 dark:bg-blue-600/10 dark:text-blue-300" : "text-slate-500 hover:text-blue-700 hover:bg-blue-50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-900"}`}>
                  <span className={`flex items-center ${sidebarCollapsed ? "justify-center" : "gap-3"}`}><Icon className="w-5 h-5 shrink-0 text-blue-500" />{!sidebarCollapsed && <span>{item.label}</span>}</span>
                  {!sidebarCollapsed && item.badge !== null && <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">{item.badge}</span>}
                </button>;
              })}
            </div>
          </div>

          {/* Quick AI CAD Promotion Pill */}
          {!sidebarCollapsed && <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50 via-white to-yellow-50 border border-blue-100 dark:from-blue-950 dark:via-slate-900 dark:to-slate-900 dark:border-blue-900 space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] font-black uppercase text-blue-600 dark:text-amber-400 tracking-wider">
                Motor Gemini 2.5
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-tight">
              Genera dibujos 2D y despiece tipo puzzle con cotas en milisegundos.
            </p>
          </div>}
        </div>

        {/* Sidebar Footer */}
        <div className={`p-3 border-t border-slate-200 dark:border-slate-800 space-y-2 ${sidebarCollapsed ? "flex flex-col items-center" : ""}`}>
          {onSwitchToPublicLanding && (
            <button
              onClick={onSwitchToPublicLanding}
              title="Ver Web Comercial" className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-xs font-bold text-blue-700 hover:text-blue-900 transition border border-blue-100 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-300 dark:hover:text-white dark:border-slate-800 ${sidebarCollapsed ? "w-11" : "w-full"}`}
            >
              <ExternalLink className="w-4 h-4 shrink-0 text-blue-500" />{!sidebarCollapsed && "Ver Web Comercial"}
            </button>
          )}

          {/* Selector de idioma */}
          <button
            onClick={toggleThemeQuick}
            className="p-2.5 rounded-xl bg-blue-50 dark:bg-slate-800 border border-blue-100 dark:border-slate-700 hover:bg-blue-100 dark:hover:bg-slate-700 transition"
            title={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {onLanguageChange && (
            <div className={`flex items-center gap-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 ${sidebarCollapsed ? "justify-center w-11" : ""}`}>
              <span className="text-sm">🌐</span>
              {!sidebarCollapsed && <select
                value={language}
                onChange={(e) => onLanguageChange(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="pt">🇵🇹 PT</option>
                <option value="es">🇪🇸 ES</option>
                <option value="en">🇬🇧 EN</option>
              </select>}
            </div>
          )}

          {onLogout && (
            <button
              onClick={onLogout}
              title="Sair da conta" className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs text-slate-500 hover:text-rose-500 hover:bg-rose-50 transition ${sidebarCollapsed ? "w-11" : "w-full"}`}
            >
              <LogOut className="w-4 h-4" />{!sidebarCollapsed && "Sair da conta"}
            </button>
          )}
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto bg-slate-50 dark:bg-[#101827]">
        <div className="max-w-7xl mx-auto rounded-[28px]">
          {activeTab === "reports" && <BusinessWorkspace kind="reports" quotes={quotes} invoices={invoices} />}
          {activeTab === "tipologias" && <BusinessWorkspace kind="tipologias" />}
          {activeTab === "projects" && <BusinessWorkspace kind="projects" />}
          {activeTab === "profile" && <BusinessWorkspace kind="profile" />}
          {activeTab === "suggestions" && <BusinessWorkspace kind="suggestions" />}
          {activeTab === "dashboard" && (
            <DashboardOverview
              quotes={quotes}
              invoices={invoices}
              companies={companies}
              drawings={drawings}
              senderConfig={senderConfig}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === "crm" && (
            <CrmModule language={language}
              companies={companies}
              onSelectCompanyForQuote={handleSelectCompanyForQuote}
            />
          )}

          {activeTab === "quotes" && (
            <QuotesModule language={language}
              senderConfig={senderConfig}
              companies={companies}
              onConvertToInvoice={() => setActiveTab("invoices")}
            />
          )}

          {activeTab === "invoices" && (
            <InvoicesModule language={language} senderConfig={senderConfig} />
          )}

          {activeTab === "agenda" && (<AgendaModule language={language} />)}

        {activeTab === "technical_drawing" && (
            <TechnicalDrawingModule language={language} senderConfig={senderConfig} />
          )}

          {activeTab === "catalog" && (<CatalogModule />)}
          {activeTab === "cadastro_items" && <div className="space-y-8"><RegistryModule kind="items" /><div className="border-t border-slate-200 pt-6 dark:border-slate-800"><SupplierSuperCatalog onNavigateQuotes={() => setActiveTab("quotes")} /></div></div>}
          {activeTab === "products" && <RegistryModule kind="products" />}
          {activeTab === "services" && <RegistryModule kind="services" />}
          {activeTab === "payment_methods" && <RegistryModule kind="payment_methods" />}
          {activeTab === "measurement" && <RegistryModule kind="measurement" />}
          {activeTab === "contracts" && <RegistryModule kind="contracts" />}
          {activeTab === "cut_plan" && <RegistryModule kind="cut_plan" />}
          {activeTab === "profile_optimization" && <RegistryModule kind="profile_optimization" />}
          {activeTab === "materials" && <RegistryModule kind="materials" />}

        {activeTab === "finance" && (<FinanceModule language={language} />)}
        {activeTab === "payroll" && (isFullMenuRole || hasAccessToTab(effectiveRole, "payroll")) && (<PayrollModule />)}

        {activeTab === "admin" && roleConfig.canManageUsers && (<AdminModule currentPerfile={effectiveRole} />)}
        {activeTab === "financial_ai" && (<FinancialAI />)}
        {activeTab === "theme" && (<ThemeModule />)}

        {activeTab === "settings" && (
            <SettingsModule language={language} senderConfig={senderConfig} setSenderConfig={setSenderConfig} />
          )}
        </div>
      </main>
    </div>
  );
}
