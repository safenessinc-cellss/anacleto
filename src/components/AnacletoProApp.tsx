import React, { useState, useEffect } from "react";
import { Building, Calendar, ChevronRight, Compass, ExternalLink, FileCheck, FileText, Globe, LayoutDashboard, LogOut, Menu, Moon, Package, Settings, Shield, ShieldCheck, Sparkles, Sun, Wallet, X } from "lucide-react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
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
import AdminModule from "./admin/AdminModule";
import { Role, getRoleConfig, hasAccessToTab, NavigationTab as RoleNavTab } from "../utils/roles";
import CatalogModule from "./catalog/CatalogModule";
import logoImg from "../assets/images/anacleto_logo_1780594599493.png";

type NavigationTab = "dashboard" | "crm" | "quotes" | "invoices" | "technical_drawing" | "agenda" | "catalog" | "finance" | "settings";

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
  const roleConfig = getRoleConfig(userRole);
  const [activeTab, setActiveTab] = useState<NavigationTab>("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Firestore Shared Collections State
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [drawings, setDrawings] = useState<TechnicalDrawing[]>([]);

  // 0. Esperar a que el usuario esté autenticado antes de escuchar Firestore
  const [authReady, setAuthReady] = useState(false);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      console.log("🔐 onAuthStateChanged fired:", u ? `user=${u.email}` : "NO USER");
      setAuthReady(!!u);
    });
    return () => unsub();
  }, []);

  // 1. Listen for Quotes (solo cuando authReady === true)
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

  // 2. Listen for Invoices (solo cuando authReady === true)
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

  // 4. Listen for Technical Drawings (solo cuando authReady)
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

  // Navigation Items Required in Prompt
  const navItems = [
        { id: "dashboard" as NavigationTab, label: "Dashboard", icon: LayoutDashboard, badge: null },
    { id: "crm" as NavigationTab, label: "CRM (Empresas)", icon: Building, badge: companies.length },
    { id: "quotes" as NavigationTab, label: "Orçamentos", icon: FileText, badge: quotes.length },
    { id: "invoices" as NavigationTab, label: "Faturas", icon: FileCheck, badge: invoices.length },
    { id: "technical_drawing" as NavigationTab, label: "Desenho Técnico", icon: Compass, badge: "AI CAD" },
    { id: "agenda" as NavigationTab, label: "Agenda", icon: Calendar, badge: null },
    { id: "catalog" as NavigationTab, label: "Catálogo", icon: Package, badge: null },
    { id: "finance" as NavigationTab, label: "Financeiro", icon: Wallet, badge: null },
    { id: "settings" as NavigationTab, label: "Configuração", icon: Settings, badge: null },
    { id: "admin" as NavigationTab, label: "Administración", icon: Shield, badge: roleConfig.canManageUsers ? "ROLES" : null },
  ].filter((item) => hasAccessToTab(userRole, item.id as RoleNavTab));
  
  // (el array original tenía la estructura "[ ... ]" - ahora filtramos por rol)
  const _unused = [  ];

  const handleSelectCompanyForQuote = (comp: Company) => {
    setActiveTab("quotes");
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col lg:flex-row font-sans">
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-black text-white tracking-widest uppercase">ANACLETO PRO</h1>
            <p className="text-[9px] text-amber-400 font-mono">Enterprise Suite</p>
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
        className={`fixed lg:sticky top-0 left-0 h-screen w-72 bg-[#0b0e17] border-r border-slate-800/80 z-50 flex flex-col justify-between transition-transform duration-300 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="p-6 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-3.5 pb-6 border-b border-slate-800/80">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-700 p-0.5 shadow-lg shadow-amber-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-[#0b0e17] rounded-[14px] flex items-center justify-center">
                <span className="text-base font-black text-amber-400">A</span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-base font-black tracking-[0.2em] text-white uppercase">ANACLETO</h1>
                <span className="px-1.5 py-0.2 bg-amber-500 text-slate-950 font-black text-[9px] rounded-md tracking-wider">
                  PRO
                </span>
              </div>
              <p className="text-[9px] text-slate-400 tracking-wider font-mono uppercase mt-0.5">
                Presupuestos • CAD • Facturas
              </p>
            </div>
          </div>

          {/* Navigation Items */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 px-3 block mb-2">
              Menú Principal
            </span>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition ${
                    isActive
                      ? "bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20"
                      : "text-slate-400 hover:text-white hover:bg-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? "text-slate-950" : "text-amber-400"}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== null && (
                    <span
                      className={`text-[9px] font-mono px-2 py-0.5 rounded-md ${
                        isActive
                          ? "bg-slate-950 text-amber-400 font-bold"
                          : "bg-slate-900 text-slate-400 border border-slate-800"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick AI CAD Promotion Pill */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-900 border border-amber-500/20 space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider">
                Motor Gemini 2.5
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-tight">
              Genera dibujos 2D y despiece tipo puzzle con cotas en milisegundos.
            </p>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-800/80 space-y-2">
          {onSwitchToPublicLanding && (
            <button
              onClick={onSwitchToPublicLanding}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-bold text-slate-300 hover:text-white transition border border-slate-800"
            >
              <ExternalLink className="w-3.5 h-3.5 text-amber-400" /> Ver Web Comercial
            </button>
          )}

          {/* Selector de idioma */}
          {onLanguageChange && (
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5">
              <span className="text-sm">🌐</span>
              <select
                value={language}
                onChange={(e) => onLanguageChange(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="pt">🇵🇹 PT</option>
                <option value="es">🇪🇸 ES</option>
                <option value="en">🇬🇧 EN</option>
              </select>
            </div>
          )}

          {onLogout && (
            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs text-slate-500 hover:text-rose-400 transition"
            >
              <LogOut className="w-3.5 h-3.5" /> Cerrar Sesión
            </button>
          )}
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
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

        {activeTab === "finance" && (<FinanceModule language={language} />)}

        {activeTab === "admin" && roleConfig.canManageUsers && (<AdminModule currentRole={userRole} />)}

        {activeTab === "settings" && (
            <SettingsModule language={language} senderConfig={senderConfig} setSenderConfig={setSenderConfig} />
          )}
        </div>
      </main>
    </div>
  );
}
