import React, { useState, useEffect, useRef } from "react";
import { Compass, ExternalLink, Factory, FileText, LayoutDashboard, LogOut, Menu, Moon, Package, Settings, Sun, Wallet, X } from "lucide-react";
import { collection, onSnapshot, query, orderBy, doc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { db } from "../firebase";
import { Quote, Invoice, Company, TechnicalDrawing, SenderConfig } from "../types";
import DashboardOverview from "./dashboard/DashboardOverview";
import CrmModule from "./crm/CrmModule";
import QuotesModule from "./quotes/QuotesModule";
import InvoicesModule from "./invoices/InvoicesModule";
import AgendaModule from "./agenda/AgendaModule";
import SettingsModule from "./settings/SettingsModule";
import FinanceModule from "./finance/FinanceModule";
import FinancialAI from "./finance/FinancialAI";
import ThemeModule from "./settings/ThemeModule";
import AdminModule from "./admin/AdminModule";
import { Role, getRoleConfig, hasAccessToTab, NavigationTab as RoleNavTab } from "../utils/roles";
import CatalogModule from "./catalog/CatalogModule";
import RegistryModule from "./registry/RegistryModule";
import SupplierSuperCatalog from "./supplier-catalog/SupplierSuperCatalog";
import logoImg from "../assets/images/anacleto-logo-premium.svg";
import BusinessWorkspace from "./workspace/BusinessWorkspace";
import PostSaleModule from "./post-sale/PostSaleModule";
import DeliveryModule from "./deliveries/DeliveryModule";
import ProductionModule from "./production/ProductionModule";
import InventoryModule from "./inventory/InventoryModule";
import ProjectEngineeringModule from "./projects/ProjectEngineeringModule";

type NavigationTab = "dashboard" | "crm" | "quotes" | "invoices" | "technical_drawing" | "agenda" | "catalog" | "finance" | "settings" | "financial_ai" | "theme" | "admin" | "cadastro_items" | "products" | "services" | "payment_methods" | "measurement" | "contracts" | "cut_plan" | "profile_optimization" | "materials" | "reports" | "tipologias" | "projects" | "profile" | "suggestions" | "post_sale" | "deliveries" | "production" | "inventory";

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
  const isFullMenuRole = ["super_admin", "super_usuario", "ceo", "admin"].includes(effectiveRole);
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

  const navigationSections: Array<{
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    tabs: Array<{ id: NavigationTab; label: string }>;
  }> = [
    { id: "home", label: "Início", icon: LayoutDashboard, tabs: [{ id: "dashboard", label: "Painel" }] },
    { id: "commercial", label: "Comercial", icon: FileText, tabs: [
      { id: "quotes", label: "Orçamentos & Propostas" },
      { id: "crm", label: "Clientes (CRM)" },
      { id: "contracts", label: "Contratos" },
    ] },
    { id: "projects", label: "Projetos & Oficina CAD", icon: Compass, tabs: [
      { id: "projects", label: "Projetos" },
    ] },
    { id: "production", label: "Produção & Obras", icon: Factory, tabs: [
      { id: "production", label: "Ordens de Produção & Corte" },
      { id: "deliveries", label: "Entregas e Instalações" },
      { id: "agenda", label: "Agenda de Medição" },
      { id: "post_sale", label: "Qualidade & Pós-venda" },
      { id: "materials", label: "Materiais de Produção" },
    ] },
    { id: "catalog", label: "Catálogo & Estoque", icon: Package, tabs: [
      { id: "cadastro_items", label: "Catálogo de Fornecedores" },
      { id: "products", label: "Esquadrias" },
      { id: "catalog", label: "Produtos" },
      { id: "services", label: "Serviços" },
      { id: "inventory", label: "Estoque" },
      { id: "payment_methods", label: "Meios de Pagamento" },
    ] },
    { id: "finance", label: "Financeiro & Relatórios", icon: Wallet, tabs: [
      { id: "finance", label: "Financeiro" },
      { id: "reports", label: "Relatórios" },
      { id: "invoices", label: "Notas Fiscais" },
      { id: "financial_ai", label: "Assistente Financeiro" },
    ] },
  ];
  const settingTabOptions: Array<{ id: NavigationTab; label: string }> = [
    { id: "settings", label: "Configurações" },
    { id: "admin", label: "Equipe & Roles" },
    { id: "theme", label: "Aparência" },
    { id: "profile", label: "Meu Perfil" },
    { id: "suggestions", label: "Sugestões" },
  ];
  const settingsTabs = settingTabOptions.filter((tab) => tab.id !== "admin" || roleConfig.canManageUsers)
    .filter((tab) => canSeeNavigation(tab.id));
  const sectionForTab = (tab: NavigationTab) => {
    if (["settings", "admin", "theme", "profile", "suggestions"].includes(tab)) return "settings";
    return navigationSections.find((section) => section.tabs.some((item) => item.id === tab))?.id || "home";
  };
  const activeSectionId = sectionForTab(activeTab);
  const activeSection = navigationSections.find((section) => section.id === activeSectionId);
  const activeSectionTabs = activeSection?.tabs.filter((tab) =>
    canSeeNavigation(tab.id) || (activeSection.id === "projects" && canSeeNavigation("technical_drawing"))
  ) || settingsTabs;
  const selectNavigationTab = (tab: NavigationTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  const handleSelectCompanyForQuote = (comp: Company) => {
    setActiveTab("quotes");
  };

  return (
    <div className="min-h-screen bg-[#EEF2F6] text-slate-900 dark:bg-[#101827] dark:text-slate-100 flex flex-col lg:flex-row font-sans">
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between p-4 bg-slate-50/90 border-b border-slate-300/80 sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => logoInputRef.current?.click()} className="w-14 h-9 rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden p-0.5" title="Alterar logotipo">{customLogo ? <img src={customLogo} alt="Logotipo" className="w-full h-full object-contain" /> : <img src={logoImg} alt="Anacleto Esquadrias" className="w-full h-full object-contain" />}</button>
          <div>
            <h1 className="text-sm font-bold text-slate-900 tracking-wide uppercase">ANACLETO ESQUADRIAS</h1>
          </div>
        </div>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
          className="p-2 text-slate-600 hover:text-slate-900 rounded-lg border border-slate-200"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {mobileMenuOpen && <button aria-label="Fechar menu" onClick={() => setMobileMenuOpen(false)} className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden" />}

      {/* SIDEBAR (Desktop & Mobile Drawer) */}
      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen ${sidebarCollapsed ? "lg:w-[76px]" : "lg:w-64"} w-72 bg-slate-50/90 dark:bg-slate-950 border-r border-slate-300/80 dark:border-slate-800 z-50 flex flex-col justify-between transition-all duration-300 shadow-sm ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="p-4 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
          <div className={`flex items-center gap-3 pb-5 border-b border-slate-200 dark:border-slate-800 ${sidebarCollapsed ? "lg:justify-center" : ""}`}>
            <button type="button" onClick={() => logoInputRef.current?.click()} title="Alterar logotipo" className="w-11 h-11 shrink-0 rounded-xl overflow-hidden border border-slate-200 p-1 flex items-center justify-center">
              {customLogo ? <img src={customLogo} alt="Logotipo personalizado" className="h-full w-full object-contain" /> : <img src={logoImg} alt="Anacleto" className="h-full w-full object-contain" />}
            </button>
            <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" aria-label="Enviar logotipo" />
            {!sidebarCollapsed && <span className="text-xs font-bold tracking-wide text-slate-800 dark:text-white">ANACLETO ESQUADRIAS</span>}
          </div>

          <nav aria-label="Navegação principal" className="space-y-1">
            {navigationSections.filter((section) => section.tabs.some((tab) =>
              canSeeNavigation(tab.id) || (section.id === "projects" && canSeeNavigation("technical_drawing"))
            )).map((section) => {
              const Icon = section.icon;
              const selected = activeSectionId === section.id;
              const firstTab = section.tabs.find((tab) =>
                canSeeNavigation(tab.id) || (section.id === "projects" && canSeeNavigation("technical_drawing"))
              );
              if (!firstTab) return null;
              return <button key={section.id} type="button" onClick={() => selectNavigationTab(firstTab.id)} title={section.label} aria-label={section.label} aria-current={selected ? "page" : undefined}
                className={`w-full flex items-center ${sidebarCollapsed ? "justify-center px-2" : "gap-3 px-3"} py-2.5 rounded-xl text-sm font-medium transition ${selected ? "!bg-[#E8F0FE] !text-[#1557B0] dark:!bg-blue-900/30 dark:!text-blue-200" : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900"}`} style={selected ? { backgroundColor: "#E8F0FE", color: "#1557B0" } : undefined}>
                <Icon className="h-5 w-5 shrink-0" />{!sidebarCollapsed && <span className="truncate">{section.label}</span>}
              </button>;
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className={`p-3 border-t border-slate-200 dark:border-slate-800 space-y-2 ${sidebarCollapsed ? "flex flex-col items-center" : ""}`}>
          {settingsTabs.length > 0 && <button type="button" onClick={() => selectNavigationTab(settingsTabs[0].id)} title="Configurações, equipe e perfil" aria-label="Configurações, equipe e perfil" aria-current={activeSectionId === "settings" ? "page" : undefined}
            className={`flex items-center justify-center rounded-xl border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900 ${sidebarCollapsed ? "w-11" : "w-11"} ${activeSectionId === "settings" ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : ""}`}>
            <Settings className="h-5 w-5 shrink-0" />
          </button>}
          {onSwitchToPublicLanding && (
            <button
              onClick={onSwitchToPublicLanding}
              title="Ver Web Comercial" className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-xs font-bold text-blue-700 hover:text-blue-900 transition border border-blue-100 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-300 dark:hover:text-white dark:border-slate-800 ${sidebarCollapsed ? "w-11" : "w-full"}`}
            >
              <ExternalLink className="w-4 h-4 shrink-0 text-blue-500" />{!sidebarCollapsed && "Ver Web Comercial"}
            </button>
          )}

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

          <button type="button" onClick={() => setSidebarCollapsed((value) => !value)} className="hidden lg:flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 p-2 text-xs text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900" title={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}>
            <Menu className="h-4 w-4" />{!sidebarCollapsed && "Recolher menu"}
          </button>

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
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto bg-[#EEF2F6] dark:bg-[#101827]">
        <div className="max-w-7xl mx-auto rounded-[28px]">
          {activeSectionTabs.length > 1 && (
            <nav aria-label={`Abas de ${activeSection?.label || "configurações"}`} className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-700">
              {activeSectionTabs.map((tab) => (
                <button key={tab.id} type="button" onClick={() => selectNavigationTab(tab.id)} aria-current={activeTab === tab.id ? "page" : undefined}
                  className={`shrink-0 border-b-2 px-3 py-3 text-sm font-medium transition ${activeTab === tab.id ? "border-blue-600 text-blue-700 dark:text-blue-300" : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}>
                  {tab.label}
                </button>
              ))}
            </nav>
          )}
          {activeTab === "reports" && <BusinessWorkspace kind="reports" quotes={quotes} invoices={invoices} />}
          
          {activeTab === "projects" && <ProjectEngineeringModule language={language} senderConfig={senderConfig} />}
          {activeTab === "profile" && <BusinessWorkspace kind="profile" />}
          {activeTab === "suggestions" && <BusinessWorkspace kind="suggestions" />}
          {activeTab === "dashboard" && (
            <DashboardOverview
              quotes={quotes}
              invoices={invoices}
              drawings={drawings}
              senderConfig={senderConfig}
              canViewFinance={canSeeNavigation("finance")}
              canViewProduction={canSeeNavigation("production")}
              canViewInvoices={canSeeNavigation("invoices")}
              canViewQuotes={canSeeNavigation("quotes")}
              canViewDrawings={canSeeNavigation("technical_drawing")}
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
            <InvoicesModule language={language} senderConfig={senderConfig} canManageFinance={["super_admin", "super_usuario", "ceo", "admin", "financeiro"].includes(effectiveRole)} />
          )}

          {activeTab === "agenda" && (<AgendaModule language={language} />)}

          {activeTab === "catalog" && <CatalogModule />}
          {activeTab === "cadastro_items" && <div className="space-y-8"><RegistryModule kind="items" /><div className="border-t border-slate-200 pt-6 dark:border-slate-800"><SupplierSuperCatalog onNavigateQuotes={() => setActiveTab("quotes")} /></div></div>}
          {activeTab === "products" && <RegistryModule kind="products" />}
          {activeTab === "services" && <RegistryModule kind="services" />}
          {activeTab === "payment_methods" && <RegistryModule kind="payment_methods" />}
          {activeTab === "contracts" && <RegistryModule kind="contracts" />}
          {activeTab === "materials" && <RegistryModule kind="materials" />}

        {activeTab === "production" && <ProductionModule onNavigateDelivery={() => setActiveTab("deliveries")} onNavigateQuality={() => setActiveTab("post_sale")} onNavigateInvoice={() => setActiveTab("invoices")} />}
        {activeTab === "inventory" && <InventoryModule />}
        {activeTab === "deliveries" && <DeliveryModule />}
        {activeTab === "post_sale" && <PostSaleModule />}

         {activeTab === "finance" && (<FinanceModule language={language} senderConfig={senderConfig} canManageFinance={["super_admin", "super_usuario", "ceo", "admin", "financeiro"].includes(effectiveRole)} />)}

        {activeTab === "admin" && roleConfig.canManageUsers && (<AdminModule currentPerfile={effectiveRole} />)}
        {activeTab === "financial_ai" && (<FinancialAI language={language} />)}
        {activeTab === "theme" && (<ThemeModule />)}

        {activeTab === "settings" && (
            <SettingsModule language={language} senderConfig={senderConfig} setSenderConfig={setSenderConfig} />
          )}
        </div>
      </main>
    </div>
  );
}
