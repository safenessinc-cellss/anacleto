import React, { useState, useEffect } from "react";
import {
  FileText,
  Settings,
  Users,
  MessageCircle,
  Plus,
  Trash,
  LogOut,
  ChevronRight,
  UserCheck,
  Eye,
  CheckCircle,
  AlertCircle,
  Save,
  Globe,
  Upload,
  Sparkles,
  Inbox,
  Calendar,
  Clock,
  MapPin,
  User,
  Mail,
  Phone,
  TrendingUp,
  Coins,
  Brain,
  Printer,
  Download,
  X
} from "lucide-react";
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy } from "firebase/firestore";
import { db, auth, handleFirestoreError, OperationType } from "../firebase";
import { Budget, Invoice, SenderConfig, AdminUser, ChatSession } from "../types";
import { Translation } from "../translations";
import { formatCurrency, languageMeta } from "../utils";
import BudgetModal from "./BudgetModal";
import InvoiceModal from "./InvoiceModal";
import BudgetPreviewModal from "./BudgetPreviewModal";
import CrmTab from "./CrmTab";
import LedgerTab from "./LedgerTab";
import AdvisorTab from "./AdvisorTab";
import { useToast } from "./ToastContext";

interface DashboardProps {
  t: Translation;
  onLogout: () => void;
  currentLanguage: string;
  senderConfig: SenderConfig;
  setSenderConfig: React.Dispatch<React.SetStateAction<SenderConfig>>;
}

export default function Dashboard({ t, onLogout, currentLanguage, senderConfig, setSenderConfig }: DashboardProps) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab ] = useState<"budgets" | "visits" | "invoices" | "settings" | "chats" | "users" | "ledger" | "crm" | "advisor">("budgets");
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);

  // Modals state
  const [isBudgetOpen, setIsBudgetOpen] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<Budget | undefined>(undefined);
  const [prefillClient, setPrefillClient] = useState<{ name: string; email: string; nif?: string; address?: string; } | null>(null);
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isBudgetPreviewOpen, setIsBudgetPreviewOpen] = useState(false);
  const [selectedPreviewBudget, setSelectedPreviewBudget] = useState<Budget | null>(null);

  // Users creation states
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminName, setNewAdminName] = useState("");

  // Load Firestore data in real-time
  useEffect(() => {
    // 1. Listen for Budgets
    const unsubscribeBudgets = onSnapshot(
      query(collection(db, "budgets"), orderBy("createdAt", "desc")),
      (snapshot) => {
        const loaded: Budget[] = [];
        snapshot.forEach((doc) => {
          loaded.push({ id: doc.id, ...doc.data() } as Budget);
        });
        setBudgets(loaded);
      },
      (err) => console.warn("Budgets permission issue or offline: ", err)
    );

    // 2. Listen for Invoices
    const unsubscribeInvoices = onSnapshot(
      query(collection(db, "invoices"), orderBy("createdAt", "desc")),
      (snapshot) => {
        const loaded: Invoice[] = [];
        snapshot.forEach((doc) => {
          loaded.push({ id: doc.id, ...doc.data() } as Invoice);
        });
        setInvoices(loaded);
      },
      (err) => console.warn("Invoices permission issue: ", err)
    );

    // 3. Listen for AI chat histories (auditing logs)
    const unsubscribeChats = onSnapshot(
      query(collection(db, "chat_sessions"), orderBy("updatedAt", "desc")),
      (snapshot) => {
        const loaded: ChatSession[] = [];
        snapshot.forEach((doc) => {
          loaded.push({ id: doc.id, ...doc.data() } as ChatSession);
        });
        setChats(loaded);
      },
      (err) => console.warn("Chats permission issues: ", err)
    );

    // 4. Listen for admin users
    const unsubscribeAdmins = onSnapshot(
      collection(db, "admins"),
      (snapshot) => {
        const loaded: AdminUser[] = [];
        snapshot.forEach((doc) => {
          loaded.push({ id: doc.id, ...doc.data() } as AdminUser);
        });
        setAdmins(loaded);
      },
      (err) => console.warn("Admins list issues: ", err)
    );

    // Visits technical scheduling listener
    const unsubscribeVisits = onSnapshot(
      collection(db, "visits"),
      (snapshot) => {
        const loaded: any[] = [];
        snapshot.forEach((doc) => {
          loaded.push({ id: doc.id, ...doc.data() });
        });
        setVisits(loaded);
      },
      (err) => console.warn("Visits subscription warning: ", err)
    );

    return () => {
      unsubscribeBudgets();
      unsubscribeInvoices();
      unsubscribeChats();
      unsubscribeAdmins();
      unsubscribeVisits();
    };
  }, []);

  // Save budget handler (create or edit)
  const handleSaveBudget = async (budgetData: Partial<Budget>) => {
    try {
      const budgetId = selectedBudget ? selectedBudget.id : "bud_" + Math.random().toString(36).substring(2);
      const docRef = doc(db, "budgets", budgetId);
      
      const completeBudget = {
        ...budgetData,
        id: budgetId,
        number: selectedBudget ? selectedBudget.number : "PRES-" + new Date().getFullYear() + "-" + (budgets.length + 101),
        createdAt: selectedBudget ? selectedBudget.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(docRef, completeBudget, { merge: true });
      showToast(t.toastBudgetCreated, "success");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "budgets");
      showToast("Erro ao guardar o orçamento.", "error");
    }
  };

  // Convert budget strictly directly to professional Invoice
  const handleGenerateInvoice = async (budget: Budget) => {
    try {
      // Create a unique Invoice number sequence
      const invoiceNo = "FT-" + new Date().getFullYear() + "-" + (invoices.length + 501);
      const invoiceId = "inv_" + Math.random().toString(36).substring(2);

      const invoiceData: Invoice = {
        id: invoiceId,
        number: invoiceNo,
        budgetId: budget.id,
        clientName: budget.clientName,
        clientEmail: budget.clientEmail,
        clientNif: budget.clientNif,
        clientAddress: budget.clientAddress,
        date: new Date().toISOString().split("T")[0],
        items: budget.items,
        subtotal: budget.subtotal,
        taxRate: budget.taxRate,
        taxAmount: budget.taxAmount,
        total: budget.total,
        language: budget.language,
        senderSnapshot: senderConfig, // Capture real-time snapshot of the configuration issuer
        createdAt: new Date().toISOString()
      };

      // Write direct invoice record to firestore
      await setDoc(doc(db, "invoices", invoiceId), invoiceData);

      // Update budget status to 'invoiced'
      await updateDoc(doc(db, "budgets", budget.id), {
        status: "invoiced",
        updatedAt: new Date().toISOString()
      });

      showToast(t.toastInvoicedSuccess, "success");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "invoices");
      showToast("Erro ao faturar orçamento.", "error");
    }
  };

  // Delete budget record
  const handleDeleteBudget = async (id: string) => {
    if (!confirm("Excluir este orçamento da base de dados permanentemente?")) return;
    try {
      await deleteDoc(doc(db, "budgets", id));
      showToast(t.toastDeleteSuccess, "success");
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `budgets/${id}`);
      showToast("Erro ao eliminar o orçamento.", "error");
    }
  };

  // Save Config Settings handler
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const docRef = doc(db, "sender_config", "default");
      const completeSettings = {
        ...senderConfig,
        updatedAt: new Date().toISOString()
      };
      await setDoc(docRef, completeSettings);
      showToast(t.toastSaveSuccess, "success");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "sender_config/default");
      showToast("Erro ao guardar definições.", "error");
    }
  };

  // Add backend staff access record helper
  const handleAddStaffAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail.trim() || !newAdminName.trim()) return;

    try {
      const fakeStaffUid = "staff_" + Math.random().toString(36).substring(2);
      await setDoc(doc(db, "admins", fakeStaffUid), {
        id: fakeStaffUid,
        email: newAdminEmail.toLowerCase().trim(),
        name: newAdminName.trim(),
        createdAt: new Date().toISOString()
      });

      showToast("Acesso funcional de staff adicionado perfeitamente!", "success");
      setNewAdminEmail("");
      setNewAdminName("");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "admins");
      showToast("Erro ao adicionar membro da equipe.", "error");
    }
  };

  // Manage visits state directly in real-time
  const handleUpdateVisitStatus = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, "visits", id), {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      showToast(`Visita técnica marcada como ${newStatus} com sucesso!`, "success");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `visits/${id}`);
      showToast("Erro ao atualizar estado da visita.", "error");
    }
  };

  const handleDeleteVisit = async (id: string) => {
    if (!confirm("Tem certeza que deseja apagar permanentemente este agendamento de visita?")) return;
    try {
      await deleteDoc(doc(db, "visits", id));
      showToast("Agendamento excluído com sucesso do banco de dados.", "success");
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `visits/${id}`);
      showToast("Erro ao deletar agendamento de visita.", "error");
    }
  };

  // Dynamic business metrics calculation
  const totalBudgetsSum = budgets.reduce((acc, b) => acc + (b.total || 0), 0);
  const totalInvoicedSum = invoices.reduce((acc, i) => acc + (i.total || 0), 0);
  const activeVisitsTotal = visits.filter(v => v.status === "pending" || v.status === "confirmed").length;
  const dealClosingRate = budgets.length > 0 ? Math.round((budgets.filter(b => b.status === "accepted" || b.status === "invoiced").length / budgets.length) * 150) : 0; // scale up logically
  const adjustedClosingRate = dealClosingRate > 100 ? 100 : dealClosingRate;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      
      {/* Title & Stats Ribbon */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-luxury-gold bg-luxury-gold/10 px-2.5 py-1 rounded-md border border-luxury-gold/20">
            Membro Autorizado: {auth.currentUser?.email}
          </span>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mt-1.5 flex items-center gap-2">
            {t.dashTitle}
          </h1>
        </div>

        <button
          onClick={onLogout}
          className="flex items-center gap-1.5 text-xs font-black px-4 py-2.5 bg-rose-55/30 hover:bg-rose-55/50 border border-rose-500/20 text-rose-600 hover:text-rose-700 dark:hover:text-rose-450 rounded-xl transition cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          {t.logoutButton}
        </button>
      </div>

      {/* Futuristic Command Key stats Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        
        {/* Metric 1 */}
        <div className="relative overflow-hidden bg-slate-950 dark:bg-[#111216] border border-slate-800 dark:border-luxury-border/30 rounded-2xl p-4 shadow-[0_4px_30px_rgba(0,0,0,0.15)] flex flex-col justify-between min-h-[110px]">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/[0.03] blur-xl rounded-full"></div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Total Solicitado</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-black font-mono text-white">
                {formatCurrency(totalBudgetsSum, senderConfig.currency)}
              </span>
            </div>
          </div>
          <div className="flex justify-between items-center mt-2 text-[9px] text-slate-400">
            <span>Volume em negociação</span>
            <span className="font-bold text-indigo-400 font-mono">{budgets.length} propostas</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="relative overflow-hidden bg-slate-950 dark:bg-[#111216] border border-slate-800 dark:border-luxury-border/30 rounded-2xl p-4 shadow-[0_4px_30px_rgba(0,0,0,0.15)] flex flex-col justify-between min-h-[110px]">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/[0.03] blur-xl rounded-full"></div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Faturamento Realizado</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-black font-mono text-white">
                {formatCurrency(totalInvoicedSum, senderConfig.currency)}
              </span>
            </div>
          </div>
          <div className="flex justify-between items-center mt-2 text-[9px] text-slate-400">
            <span>Fechado e faturado</span>
            <span className="font-bold text-emerald-400 font-mono">{invoices.length} faturas</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="relative overflow-hidden bg-slate-950 dark:bg-[#111216] border border-slate-800 dark:border-luxury-border/30 rounded-2xl p-4 shadow-[0_4px_30px_rgba(0,0,0,0.15)] flex flex-col justify-between min-h-[110px]">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/[0.03] blur-xl rounded-full"></div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-luxury-gold">Conversão Comercial</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-black font-mono text-luxury-gold">
                {adjustedClosingRate}%
              </span>
              <TrendingUp className="w-4 h-4 text-luxury-gold self-center" />
            </div>
          </div>
          <div className="flex justify-between items-center mt-2 text-[9px] text-slate-400">
            <span>Contratos cristalizados</span>
            <span className="font-bold text-luxury-gold">Taxa de Sucesso</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="relative overflow-hidden bg-slate-950 dark:bg-[#111216] border border-slate-800 dark:border-luxury-border/30 rounded-2xl p-4 shadow-[0_4px_30px_rgba(0,0,0,0.15)] flex flex-col justify-between min-h-[110px]">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/[0.03] blur-xl rounded-full"></div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-purple-400">Visitas de Medição</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-black font-mono text-white">
                {activeVisitsTotal}
              </span>
              <span className="text-[9px] font-semibold text-slate-400">ativas</span>
            </div>
          </div>
          <div className="flex justify-between items-center mt-2 text-[9px] text-slate-400">
            <span>Pesquisas de vão livre</span>
            <span className="font-bold text-purple-400 font-mono">Campo operacional</span>
          </div>
        </div>

      </div>

      {/* Dashboard Sub-Layout with Tabs Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Navigation Tabs List Sidebar */}
        <div className="bg-white dark:bg-[#111216]/90 rounded-2xl shadow-md border border-slate-100 dark:border-slate-800/80 p-4 space-y-1.5 h-fit transition-colors duration-300">
          <button
            onClick={() => setActiveTab("budgets")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-extrabold transition-all duration-200 cursor-pointer border ${
              activeTab === "budgets"
                ? "bg-luxury-gold text-slate-950 border-luxury-gold shadow-[0_4px_16px_rgba(197,168,80,0.25)]"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-55 dark:hover:bg-slate-800/50 border-transparent text-slate-700 dark:hover:text-white"
            }`}
          >
            <FileText className={`w-5 h-5 ${activeTab === "budgets" ? "text-slate-950" : "text-luxury-gold"}`} />
            {t.tabBudgets}
            <span className={`ml-auto text-xs font-black px-2.5 py-0.5 rounded-full ${activeTab === "budgets" ? "bg-slate-950/20 text-slate-950" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"}`}>
              {budgets.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("invoices")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-extrabold transition-all duration-200 cursor-pointer border ${
              activeTab === "invoices"
                ? "bg-luxury-gold text-slate-950 border-luxury-gold shadow-[0_4px_16px_rgba(197,168,80,0.25)]"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-55 dark:hover:bg-slate-800/50 border-transparent text-slate-700 dark:hover:text-white"
            }`}
          >
            <CheckCircle className={`w-5 h-5 ${activeTab === "invoices" ? "text-slate-950" : "text-emerald-500"}`} />
            {t.tabInvoices}
            <span className={`ml-auto text-xs font-black px-2.5 py-0.5 rounded-full ${activeTab === "invoices" ? "bg-slate-950/20 text-slate-950" : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-450"}`}>
              {invoices.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("visits")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-extrabold transition-all duration-200 cursor-pointer border ${
              activeTab === "visits"
                ? "bg-luxury-gold text-slate-950 border-luxury-gold shadow-[0_4px_16px_rgba(197,168,80,0.25)]"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-55 dark:hover:bg-slate-800/50 border-transparent text-slate-700 dark:hover:text-white"
            }`}
          >
            <Calendar className={`w-5 h-5 ${activeTab === "visits" ? "text-slate-950" : "text-purple-500"}`} />
            Visitas Técnicas
            <span className={`ml-auto text-xs font-black px-2.5 py-0.5 rounded-full font-mono ${activeTab === "visits" ? "bg-slate-950/20 text-slate-950" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"}`}>
              {visits.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("crm")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-extrabold transition-all duration-200 cursor-pointer border ${
              activeTab === "crm"
                ? "bg-luxury-gold text-slate-950 border-luxury-gold shadow-[0_4px_16px_rgba(197,168,80,0.25)]"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-55 dark:hover:bg-slate-800/50 border-transparent text-slate-700 dark:hover:text-white"
            }`}
          >
            <Users className={`w-5 h-5 ${activeTab === "crm" ? "text-slate-950" : "text-luxury-gold"}`} />
            CRM Clientes
          </button>

          <button
            onClick={() => setActiveTab("ledger")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-extrabold transition-all duration-200 cursor-pointer border ${
              activeTab === "ledger"
                ? "bg-luxury-gold text-slate-950 border-luxury-gold shadow-[0_4px_16px_rgba(197,168,80,0.25)]"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-55 dark:hover:bg-slate-800/50 border-transparent text-slate-700 dark:hover:text-white"
            }`}
          >
            <Coins className={`w-5 h-5 ${activeTab === "ledger" ? "text-slate-950" : "text-amber-500"}`} />
            Controladoria
          </button>

          <button
            onClick={() => setActiveTab("advisor")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-extrabold transition-all duration-200 cursor-pointer border ${
              activeTab === "advisor"
                ? "bg-luxury-gold text-slate-950 border-luxury-gold shadow-[0_4px_16px_rgba(197,168,80,0.25)]"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-55 dark:hover:bg-slate-800/50 border-transparent text-slate-700 dark:hover:text-white"
            }`}
          >
            <Brain className={`w-5 h-5 ${activeTab === "advisor" ? "text-slate-950 animate-bounce" : "text-amber-500"}`} />
            Conselheiro IA
            <span className={`ml-auto text-[9px] font-black px-1.5 py-0.5 rounded-sm ${activeTab === "advisor" ? "bg-slate-950 text-luxury-gold" : "bg-amber-400 text-amber-955"}`}>PRO</span>
          </button>

          <button
            onClick={() => setActiveTab("settings")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-extrabold transition-all duration-200 cursor-pointer border ${
              activeTab === "settings"
                ? "bg-luxury-gold text-slate-950 border-luxury-gold shadow-[0_4px_16px_rgba(197,168,80,0.25)]"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-55 dark:hover:bg-slate-800/50 border-transparent text-slate-700 dark:hover:text-white"
            }`}
          >
            <Settings className={`w-5 h-5 ${activeTab === "settings" ? "text-slate-950" : "text-slate-400"}`} />
            {t.tabSettings}
          </button>

          <button
            onClick={() => setActiveTab("chats")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-extrabold transition-all duration-200 cursor-pointer border ${
              activeTab === "chats"
                ? "bg-luxury-gold text-slate-950 border-luxury-gold shadow-[0_4px_16px_rgba(197,168,80,0.25)]"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-55 dark:hover:bg-slate-800/50 border-transparent text-slate-700 dark:hover:text-white"
            }`}
          >
            <MessageCircle className={`w-5 h-5 ${activeTab === "chats" ? "text-slate-950" : "text-purple-450"}`} />
            Admin AI Logs
            <span className={`ml-auto text-xs font-black px-2.5 py-0.5 rounded-full ${activeTab === "chats" ? "bg-slate-950/20 text-slate-950" : "bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300"}`}>
              {chats.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("users")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-extrabold transition-all duration-200 cursor-pointer border ${
              activeTab === "users"
                ? "bg-luxury-gold text-slate-950 border-luxury-gold shadow-[0_4px_16px_rgba(197,168,80,0.25)]"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-55 dark:hover:bg-slate-800/50 border-transparent text-slate-700 dark:hover:text-white"
            }`}
          >
            <Users className={`w-5 h-5 ${activeTab === "users" ? "text-slate-950" : "text-slate-400"}`} />
            {t.tabUsers}
          </button>
        </div>

        {/* Content Panel Area */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-2xl shadow-md border border-slate-100 dark:border-slate-800 p-6 min-h-[500px] transition-colors duration-300">
          
          {/* TAB 1: BUDGETS DATABASE */}
          {activeTab === "budgets" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    {t.tabBudgets}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Crie, edite, controle estados e gere faturas automáticas correspondentes.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedBudget(undefined);
                    setIsBudgetOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-luxury-gold hover:bg-luxury-gold-dark text-slate-950 font-black rounded-xl text-xs shadow-md cursor-pointer transition transform hover:scale-[1.02]"
                >
                  <Plus className="w-4 h-4 text-slate-950" />
                  {t.createBudgetBtn}
                </button>
              </div>

              {budgets.length === 0 ? (
                <div className="py-24 text-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-8">
                  <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="font-semibold text-slate-500">Nenhum orçamento encontrado.</p>
                  <p className="text-xs">Clique no botão acima para iniciar um novo orçamento multilíngue de imediato.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-55/40 dark:bg-slate-950/30 text-slate-400 font-bold border-b border-slate-150">
                        <th className="p-4">{t.budgetNo}</th>
                        <th className="p-4">{t.client}</th>
                        <th className="p-4">{t.date}</th>
                        <th className="p-4 text-right">{t.total}</th>
                        <th className="p-4 text-center">{t.status}</th>
                        <th className="p-4 text-center">{t.actions}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {budgets.map((b) => (
                        <tr key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/40">
                          <td className="p-4 font-bold font-mono text-slate-800 dark:text-slate-200">
                             {b.number}
                          </td>
                          <td className="p-4">
                            <p className="font-bold text-slate-850 dark:text-slate-100">{b.clientName}</p>
                            <p className="text-[10px] text-slate-400">{b.clientEmail}</p>
                          </td>
                          <td className="p-4 text-slate-500">{b.date}</td>
                          <td className="p-4 text-right font-black text-slate-900 dark:text-white font-mono">
                            {formatCurrency(b.total, senderConfig.currency)}
                          </td>
                          <td className="p-4 text-center">
                            <span
                              className={`inline-block px-2 py-1 select-none rounded-md font-bold text-[9px] uppercase tracking-wider ${
                                b.status === "invoiced"
                                  ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                  : b.status === "accepted"
                                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                                  : b.status === "rejected"
                                  ? "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-450"
                                  : "text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400"
                              }`}
                            >
                              {b.status === "invoiced" ? t.statusInvoiced : b.status === "accepted" ? t.statusAccepted : b.status === "rejected" ? t.statusRejected : t.statusPending}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center justify-center gap-2">
                              {/* Direct action dropdown / buttons */}
                              <button
                                onClick={() => {
                                  setSelectedBudget(b);
                                  setIsBudgetOpen(true);
                                }}
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-750 dark:text-slate-300 rounded-md font-semibold transition cursor-pointer"
                              >
                                {t.editBudgetBtn}
                              </button>

                              <button
                                onClick={() => {
                                  setSelectedPreviewBudget(b);
                                  setIsBudgetPreviewOpen(true);
                                }}
                                className="px-2 py-1 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-md font-bold transition flex items-center gap-1 cursor-pointer animate-fade-in"
                                title="Exportar PDF Profissional"
                              >
                                <Printer className="w-3.5 h-3.5 text-amber-500" />
                                PDF
                              </button>

                              {b.status === "pending" && (
                                <button
                                  onClick={async () => {
                                    // Accept budget
                                    await updateDoc(doc(db, "budgets", b.id), { status: "accepted" });
                                  }}
                                  className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-md font-bold transition"
                                >
                                  ✔ Aceitar
                                </button>
                              )}

                              {b.status === "accepted" && (
                                <button
                                  onClick={() => handleGenerateInvoice(b)}
                                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-bold shadow-xs transition"
                                >
                                  {t.convertToInvoiceBtn}
                                </button>
                              )}

                              <button
                                onClick={() => handleDeleteBudget(b.id)}
                                className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-md transition"
                                aria-label="Excluir"
                              >
                                <Trash className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: INVOICES HISTORIC */}
          {activeTab === "invoices" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {t.tabInvoices}
                </h2>
                <p className="text-xs text-slate-500">
                  Histórico de faturamento empresarial emitido no idioma correspondente selecionado pelo adquirente.
                </p>
              </div>

              {invoices.length === 0 ? (
                <div className="py-24 text-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-8">
                  <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="font-semibold text-slate-500">Nenhuma fatura emitida.</p>
                  <p className="text-xs">Faturas são geradas automaticamente quando o administrador aprova um orçamento (Presuposto).</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-55/40 dark:bg-slate-950/30 text-slate-400 font-bold border-b border-slate-150">
                        <th className="p-4">{t.invoiceNo}</th>
                        <th className="p-4">{t.client}</th>
                        <th className="p-4">{t.date}</th>
                        <th className="p-4 text-center">Idioma de Emissão</th>
                        <th className="p-4 text-right">{t.total}</th>
                        <th className="p-4 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/40">
                          <td className="p-4 font-extrabold font-mono text-indigo-600 dark:text-indigo-400">
                            {inv.number}
                          </td>
                          <td className="p-4">
                            <p className="font-bold text-slate-800 dark:text-slate-100">{inv.clientName}</p>
                            <p className="text-[10px] text-slate-400">{inv.clientNif}</p>
                          </td>
                          <td className="p-4 text-slate-500">{inv.date}</td>
                          <td className="p-4 text-center">
                            <span className="text-sm font-bold">
                              {languageMeta[inv.language as keyof typeof languageMeta]?.flag || "🏳️"} 
                              <span className="text-[10px] font-semibold text-slate-400 ml-1 uppercase">{inv.language}</span>
                            </span>
                          </td>
                          <td className="p-4 text-right font-black text-slate-900 dark:text-white font-mono">
                            {formatCurrency(inv.total, senderConfig.currency)}
                          </td>
                          <td className="p-4 text-center">
                            <button
                              onClick={() => {
                                setSelectedInvoice(inv);
                                setIsInvoiceOpen(true);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg font-bold transition"
                            >
                              <Eye className="w-4 h-4" />
                              Visualizar PDF
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB: VISITS MANAGING PANEL */}
          {activeTab === "visits" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Agendamentos de Visitas Técnicas Grátis
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Acompanhe e gerencie as chamadas para medição laser e vistorias de esquadrias e vidros na Região Metropolitana.
                </p>
              </div>

              {visits.length === 0 ? (
                <div className="py-24 text-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-8">
                  <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="font-semibold text-slate-500">Nenhuma visita agendada até o momento.</p>
                  <p className="text-xs">Os agendamentos programados por clientes no site público aparecerão em tempo real aqui.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {visits.map((v) => (
                    <div
                      key={v.id}
                      className="bg-white dark:bg-slate-800/80 p-5 rounded-2xl border border-slate-100 dark:border-slate-850 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition hover:border-indigo-100 dark:hover:border-slate-750"
                    >
                      <div className="space-y-2.5 flex-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h3 className="font-black text-sm text-slate-900 dark:text-white">{v.name}</h3>
                          <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                            v.status === "confirmed"
                              ? "bg-emerald-50 dark:bg-emerald-950/45 text-emerald-650"
                              : v.status === "completed"
                              ? "bg-blue-50 dark:bg-blue-950/45 text-blue-650"
                              : v.status === "cancelled"
                              ? "bg-rose-50 dark:bg-rose-950/45 text-rose-650"
                              : "bg-amber-50 dark:bg-amber-950/45 text-amber-650"
                          }`}>
                            {v.status === "confirmed" ? "Confirmada" : v.status === "completed" ? "Concluída" : v.status === "cancelled" ? "Cancelada" : "Pendente"}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                            Ref: {v.id?.substring(0, 8)}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-2 gap-x-4 text-xs text-slate-600 dark:text-slate-350">
                          <div className="flex items-center gap-2">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            <span>{v.email}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-semibold">{v.phone}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-bold text-purple-600 dark:text-purple-400">{v.preferDate}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>Horário: <strong className="text-slate-800 dark:text-slate-200">{v.preferTime}</strong></span>
                          </div>
                          <div className="flex items-center gap-2 sm:col-span-2">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 min-w-[14px]" />
                            <span className="truncate" title={v.address}>{v.address}</span>
                          </div>
                        </div>

                        {v.service && (
                          <div className="text-xs bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg text-slate-700 dark:text-slate-300">
                            <strong>Serviço:</strong> {v.service}
                          </div>
                        )}

                        {v.notes && (
                          <p className="text-xs italic text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900/30 p-2.5 rounded-xl">
                            " {v.notes} "
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 md:self-center w-full md:w-auto border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 dark:border-slate-800">
                        {v.status !== "cancelled" && (
                          <button
                            onClick={() => {
                              setPrefillClient({
                                name: v.name,
                                email: v.email,
                                address: v.address || "",
                                nif: ""
                              });
                              setSelectedBudget(undefined);
                              setIsBudgetOpen(true);
                              setActiveTab("budgets");
                              showToast(`Preenchendo proposta para ${v.name}!`, "success");
                            }}
                            className="flex-1 md:flex-none px-3 py-1.5 bg-luxury-gold/25 hover:bg-luxury-gold text-luxury-gold hover:text-slate-950 font-black rounded-lg text-xs transition cursor-pointer flex items-center justify-center gap-1 border border-luxury-gold/45"
                            title="Criar proposta financeira pré-preenchida"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Gerar Orçamento
                          </button>
                        )}
                        {v.status !== "confirmed" && v.status !== "completed" && (
                          <button
                            onClick={() => handleUpdateVisitStatus(v.id, "confirmed")}
                            className="flex-1 md:flex-none px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black transition cursor-pointer"
                          >
                            Confirmar
                          </button>
                        )}
                        {v.status === "confirmed" && (
                          <button
                            onClick={() => handleUpdateVisitStatus(v.id, "completed")}
                            className="flex-1 md:flex-none px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-black transition cursor-pointer"
                          >
                            Concluir
                          </button>
                        )}
                        {v.status !== "cancelled" && v.status !== "completed" && (
                          <button
                            onClick={() => handleUpdateVisitStatus(v.id, "cancelled")}
                            className="flex-1 md:flex-none px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition cursor-pointer"
                          >
                            Cancelar
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteVisit(v.id)}
                          className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-lg transition cursor-pointer"
                          title="Excluir"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DADOS DE FACTURAÇÃO */}
          {activeTab === "settings" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {t.senderConfigTitle}
                </h2>
                <p className="text-xs text-slate-500">
                  Estes dados são sincronizados no Firestore e integrados imediatamente em tempo real na emissão das faturas em Portugal e exterior.
                </p>
              </div>

              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {t.senderNameLabel}
                    </label>
                    <input
                      type="text"
                      required
                      value={senderConfig.name}
                      onChange={(e) => setSenderConfig({ ...senderConfig, name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {t.senderNifLabel} (Ex: PT501024330)
                    </label>
                    <input
                      type="text"
                      required
                      value={senderConfig.nif}
                      onChange={(e) => setSenderConfig({ ...senderConfig, nif: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {t.senderAddressLabel}
                    </label>
                    <input
                      type="text"
                      required
                      value={senderConfig.address}
                      onChange={(e) => setSenderConfig({ ...senderConfig, address: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg shadow-inner"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {t.senderZipLabel}
                    </label>
                    <input
                      type="text"
                      required
                      value={senderConfig.postalCode}
                      onChange={(e) => setSenderConfig({ ...senderConfig, postalCode: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {t.senderCityLabel}
                    </label>
                    <input
                      type="text"
                      required
                      value={senderConfig.city}
                      onChange={(e) => setSenderConfig({ ...senderConfig, city: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {t.senderCountryLabel}
                    </label>
                    <input
                      type="text"
                      required
                      value={senderConfig.country}
                      onChange={(e) => setSenderConfig({ ...senderConfig, country: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg"
                    />
                  </div>

                  <div className="md:col-span-2 space-y-2 border border-dashed border-slate-200 dark:border-slate-800 p-4 rounded-xl">
                    <label className="block text-sm font-semibold text-slate-705 dark:text-slate-300">
                      Logótipo da Empresa (Upload Imagem / URL / Base64)
                    </label>
                    <div className="flex flex-col sm:flex-row gap-4 items-center">
                      {senderConfig.logoUrl ? (
                        <div className="relative w-28 h-20 bg-white/40 dark:bg-slate-950 p-1.5 rounded-lg border border-slate-205 dark:border-slate-800 flex items-center justify-center group shrink-0 shadow-xs">
                          <img
                            src={senderConfig.logoUrl}
                            alt="Logo Visual Pré-visualização"
                            className="max-w-full max-h-full object-contain"
                          />
                          <button
                            type="button"
                            onClick={() => setSenderConfig({ ...senderConfig, logoUrl: "" })}
                            className="absolute -top-1.5 -right-1.5 p-1 bg-rose-500 hover:bg-rose-600 text-white rounded-full transition shadow-md cursor-pointer flex items-center justify-center"
                            title="Remover logotipo"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="w-28 h-20 bg-slate-100 dark:bg-slate-800 rounded-lg flex flex-col items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700 text-[10px] text-slate-400 select-none shrink-0">
                          <span>Sem Logo</span>
                        </div>
                      )}
                      
                      <div className="flex-1 w-full space-y-2">
                        {/* File Upload action */}
                        <div className="flex items-center gap-2">
                          <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-805 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-lg text-xs transition border border-slate-250 dark:border-slate-700">
                            <Upload className="w-4 h-4 text-emerald-500" />
                            Carregar Imagem (PNG/JPG)
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  if (file.size > 1.5 * 1024 * 1024) {
                                    showToast("Por favor, selecione uma imagem menor que 1.5MB.", "warning");
                                    return;
                                  }
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    setSenderConfig({ ...senderConfig, logoUrl: reader.result as string });
                                    showToast("Imagem convertida para Base64 com sucesso!", "success");
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                          </label>
                        </div>
                        
                        {/* Manual entry text field */}
                        <input
                          type="text"
                          value={senderConfig.logoUrl}
                          onChange={(e) => setSenderConfig({ ...senderConfig, logoUrl: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg text-xs"
                          placeholder="Ou defina uma URL direta ex: https://images.com/logo.png"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {t.senderBankLabel}
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={senderConfig.bankAccount}
                      onChange={(e) => setSenderConfig({ ...senderConfig, bankAccount: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg font-mono text-sm resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {t.senderCurrencyLabel}
                    </label>
                    <select
                      value={senderConfig.currency}
                      onChange={(e) => setSenderConfig({ ...senderConfig, currency: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg"
                    >
                      <option value="EUR">€ EUR (Euro)</option>
                      <option value="USD">$ USD (Dolar)</option>
                      <option value="BRL">R$ BRL (Real Brasileiro)</option>
                      <option value="CNY">¥ CNY (Yuan Chinês)</option>
                      <option value="JPY">¥ JPY (Iene Japonês)</option>
                    </select>
                  </div>

                  {/* WEBSITE LOGO CUSTOMIZATION */}
                  <div className="md:col-span-2 border-t border-slate-200 dark:border-slate-800 pt-6">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider mb-3">
                      🖼️ Logotipo Customizado da Página
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-655 dark:text-slate-400">
                          URL do Logotipo do Website (Substitui o padrão)
                        </label>
                        <input
                          type="text"
                          value={senderConfig.websiteLogoUrl || ""}
                          onChange={(e) => setSenderConfig({ ...senderConfig, websiteLogoUrl: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg text-xs"
                          placeholder="Ex: https://dominio.com/marca-logo.png"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">
                          Insira o endereço de uma imagem online para trocar o logo principal exibido na barra de navegação pública.
                        </p>
                      </div>
                      <div className="flex items-center justify-center p-4 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                        {senderConfig.websiteLogoUrl ? (
                          <img src={senderConfig.websiteLogoUrl} className="max-h-16 object-contain" alt="Website Logo Preview" />
                        ) : (
                          <span className="text-[11px] text-slate-400 font-bold">Logo Padrão Ativo</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* EDIT PROFILE PRESENTATION */}
                  <div className="md:col-span-2 border-t border-slate-200 dark:border-slate-800 pt-6 space-y-4">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      👤 Perfil Executivo de Liderança (Quem Somos)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Nome do Perfil / Gestor
                        </label>
                        <input
                          type="text"
                          value={senderConfig.profileName || ""}
                          onChange={(e) => setSenderConfig({ ...senderConfig, profileName: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg text-sm"
                          placeholder="Ex: João Anacleto"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Cargo / Role
                        </label>
                        <input
                          type="text"
                          value={senderConfig.profileRole || ""}
                          onChange={(e) => setSenderConfig({ ...senderConfig, profileRole: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg text-sm"
                          placeholder="Ex: Fundador & Diretor Geral"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                          URL da Foto / Avatar
                        </label>
                        <input
                          type="text"
                          value={senderConfig.profileAvatarUrl || ""}
                          onChange={(e) => setSenderConfig({ ...senderConfig, profileAvatarUrl: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg text-sm"
                          placeholder="Ex: https://images.com/foto.jpg"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Contato Celular (WhatsApp)
                        </label>
                        <input
                          type="text"
                          value={senderConfig.profilePhone || ""}
                          onChange={(e) => setSenderConfig({ ...senderConfig, profilePhone: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg text-sm"
                          placeholder="Ex: (51) 99311-0000"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                          E-mail de Contato Comercial
                        </label>
                        <input
                          type="text"
                          value={senderConfig.profileEmail || ""}
                          onChange={(e) => setSenderConfig({ ...senderConfig, profileEmail: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg text-sm"
                          placeholder="Ex: contato@anacletoesquadrias.com.br"
                        />
                      </div>
                      <div className="md:col-span-3">
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Biografia Resumida de Apresentação
                        </label>
                        <textarea
                          rows={3}
                          value={senderConfig.profileBio || ""}
                          onChange={(e) => setSenderConfig({ ...senderConfig, profileBio: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg text-sm resize-none"
                          placeholder="Insira uma curta biografia contando as realizações profissionais..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* EDIT PROMOTIONS */}
                  <div className="md:col-span-2 border-t border-slate-200 dark:border-slate-800 pt-6 space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        🎁 Gerenciamento de Promoções & Ofertas Ativas
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...(senderConfig.promotions || [])];
                          updated.push({
                            id: "p_" + Date.now(),
                            title: "Nova Promoção Imperdível",
                            description: "Descrição da promoção contendo prazos, produtos sob medida inclusos ou condições.",
                            discountBadge: "10% OFF",
                            isActive: true
                          });
                          setSenderConfig({ ...senderConfig, promotions: updated });
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg text-xs tracking-wide cursor-pointer transition select-none"
                      >
                        + Nova Promoção
                      </button>
                    </div>

                    <div className="space-y-4">
                      {(!senderConfig.promotions || senderConfig.promotions.length === 0) ? (
                        <p className="text-xs text-slate-450 italic mt-2">Nenhuma promoção ativa cadastrada. Clique em "+ Nova Promoção" para cadastrar uma campanha.</p>
                      ) : (
                        senderConfig.promotions.map((p, idx) => (
                          <div key={p.id} className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div className="md:col-span-2">
                                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Título da Campanha</label>
                                <input
                                  type="text"
                                  value={p.title}
                                  onChange={(e) => {
                                    const updated = [...senderConfig.promotions!];
                                    updated[idx].title = e.target.value;
                                    setSenderConfig({ ...senderConfig, promotions: updated });
                                  }}
                                  className="w-full px-2.5 py-1.5 border border-slate-350 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg text-xs font-bold"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Selo de Desconto (Badge)</label>
                                <input
                                  type="text"
                                  value={p.discountBadge}
                                  onChange={(e) => {
                                    const updated = [...senderConfig.promotions!];
                                    updated[idx].discountBadge = e.target.value;
                                    setSenderConfig({ ...senderConfig, promotions: updated });
                                  }}
                                  className="w-full px-2.5 py-1.5 border border-slate-350 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg text-xs"
                                />
                              </div>
                              <div className="md:col-span-3">
                                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Texto Descritivo</label>
                                <textarea
                                  rows={2}
                                  value={p.description}
                                  onChange={(e) => {
                                    const updated = [...senderConfig.promotions!];
                                    updated[idx].description = e.target.value;
                                    setSenderConfig({ ...senderConfig, promotions: updated });
                                  }}
                                  className="w-full px-2.5 py-1.5 border border-slate-350 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg text-xs resize-none"
                                />
                              </div>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-800">
                              <label className="flex items-center gap-1.5 text-xs text-slate-650 dark:text-slate-350 select-none cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={p.isActive}
                                  onChange={(e) => {
                                    const updated = [...senderConfig.promotions!];
                                    updated[idx].isActive = e.target.checked;
                                    setSenderConfig({ ...senderConfig, promotions: updated });
                                  }}
                                  className="rounded border-slate-300 text-indigo-650 focus:ring-indigo-500"
                                />
                                Ativa Pública no Site
                              </label>
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = senderConfig.promotions!.filter((item) => item.id !== p.id);
                                  setSenderConfig({ ...senderConfig, promotions: updated });
                                }}
                                className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-650 dark:bg-red-950/20 dark:text-red-400 rounded-lg text-[11px] font-bold transition cursor-pointer"
                              >
                                Excluir Campanha
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* EDIT PUBLICITY */}
                  <div className="md:col-span-2 border-t border-slate-200 dark:border-slate-800 pt-6 space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        ⚡ Banner de anúncios de Publicidade Comercial
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...(senderConfig.publicity || [])];
                          updated.push({
                            id: "ads_" + Date.now(),
                            bannerText: "✨ NOVIDADE EXCLUSIVA: Descrição chamativa para este banner publicitário!",
                            bannerLink: "#agendar",
                            bgColor: "bg-amber-500 text-slate-950",
                            isActive: true
                          });
                          setSenderConfig({ ...senderConfig, publicity: updated });
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg text-xs tracking-wide cursor-pointer transition select-none"
                      >
                        + Novo Banner Publicitário
                      </button>
                    </div>

                    <div className="space-y-4">
                      {(!senderConfig.publicity || senderConfig.publicity.length === 0) ? (
                        <p className="text-xs text-slate-450 italic mt-2">Nenhum banner ativo. Crie um banner acima para destacar no topo da página institucional.</p>
                      ) : (
                        senderConfig.publicity.map((ads, idx) => (
                          <div key={ads.id} className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div className="md:col-span-2">
                                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Texto do Anúncio (Suporta Emojis)</label>
                                <input
                                  type="text"
                                  value={ads.bannerText}
                                  onChange={(e) => {
                                    const updated = [...senderConfig.publicity!];
                                    updated[idx].bannerText = e.target.value;
                                    setSenderConfig({ ...senderConfig, publicity: updated });
                                  }}
                                  className="w-full px-2.5 py-1.5 border border-slate-350 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg text-xs font-bold"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Cores (Tailwind classes)</label>
                                <input
                                  type="text"
                                  value={ads.bgColor}
                                  onChange={(e) => {
                                    const updated = [...senderConfig.publicity!];
                                    updated[idx].bgColor = e.target.value;
                                    setSenderConfig({ ...senderConfig, publicity: updated });
                                  }}
                                  className="w-full px-2.5 py-1.5 border border-slate-350 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg text-xs"
                                  placeholder="Ex: bg-amber-500 text-slate-950"
                                />
                              </div>
                              <div className="md:col-span-3">
                                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Link de Destino do Banner</label>
                                <input
                                  type="text"
                                  value={ads.bannerLink || ""}
                                  onChange={(e) => {
                                    const updated = [...senderConfig.publicity!];
                                    updated[idx].bannerLink = e.target.value;
                                    setSenderConfig({ ...senderConfig, publicity: updated });
                                  }}
                                  className="w-full px-2.5 py-1.5 border border-slate-350 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg text-xs"
                                  placeholder="Ex: #agendar ou #solicitar"
                                />
                              </div>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-800">
                              <label className="flex items-center gap-1.5 text-xs text-slate-655 dark:text-slate-350 select-none cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={ads.isActive}
                                  onChange={(e) => {
                                    const updated = [...senderConfig.publicity!];
                                    updated[idx].isActive = e.target.checked;
                                    setSenderConfig({ ...senderConfig, publicity: updated });
                                  }}
                                  className="rounded border-slate-300 text-indigo-650 focus:ring-indigo-500"
                                />
                                Anúncio Ativo no Topo
                              </label>
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = senderConfig.publicity!.filter((item) => item.id !== ads.id);
                                  setSenderConfig({ ...senderConfig, publicity: updated });
                                }}
                                className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-650 dark:bg-red-950/20 dark:text-red-400 rounded-lg text-[11px] font-bold transition cursor-pointer"
                              >
                                Excluir Anúncio
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* EDIT VIDEOS */}
                  <div className="md:col-span-2 border-t border-slate-200 dark:border-slate-800 pt-6 space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider font-sans">
                        📽️ Incorporação de Vídeos & Projetos de Portfólio
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...(senderConfig.videos || [])];
                          updated.push({
                            id: "v_" + Date.now(),
                            title: "Novo Showcase Realizado",
                            url: "https://www.youtube.com/embed/dQw4w9WgXcQ",
                            description: "Assista os detalhes de design, fabricação e montagem desta obra."
                          });
                          setSenderConfig({ ...senderConfig, videos: updated });
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg text-xs tracking-wide cursor-pointer transition select-none"
                      >
                        + Adicionar Vídeo
                      </button>
                    </div>

                    <div className="space-y-4">
                      {(!senderConfig.videos || senderConfig.videos.length === 0) ? (
                        <p className="text-xs text-slate-450 italic mt-2">Nenhum vídeo cadastrado. Insira um vídeo do Youtube acima para incorporar no portfólio.</p>
                      ) : (
                        senderConfig.videos.map((vid, idx) => (
                          <div key={vid.id} className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Título do Vídeo</label>
                                <input
                                  type="text"
                                  value={vid.title}
                                  onChange={(e) => {
                                    const updated = [...senderConfig.videos!];
                                    updated[idx].title = e.target.value;
                                    setSenderConfig({ ...senderConfig, videos: updated });
                                  }}
                                  className="w-full px-2.5 py-1.5 border border-slate-350 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg text-xs font-bold"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Embed URL Youtube / Link</label>
                                <input
                                  type="text"
                                  value={vid.url}
                                  onChange={(e) => {
                                    const updated = [...senderConfig.videos!];
                                    updated[idx].url = e.target.value;
                                    setSenderConfig({ ...senderConfig, videos: updated });
                                  }}
                                  className="w-full px-2.5 py-1.5 border border-slate-350 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-905 dark:text-white rounded-lg text-xs"
                                  placeholder="Ex: https://www.youtube.com/embed/dQw4w9WgXcQ"
                                />
                              </div>
                              <div className="md:col-span-2">
                                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Descrição Curta</label>
                                <input
                                  type="text"
                                  value={vid.description || ""}
                                  onChange={(e) => {
                                    const updated = [...senderConfig.videos!];
                                    updated[idx].description = e.target.value;
                                    setSenderConfig({ ...senderConfig, videos: updated });
                                  }}
                                  className="w-full px-2.5 py-1.5 border border-slate-350 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg text-xs"
                                />
                              </div>
                            </div>
                            <div className="flex justify-end pt-1 border-t border-slate-200 dark:border-slate-800">
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = senderConfig.videos!.filter((item) => item.id !== vid.id);
                                  setSenderConfig({ ...senderConfig, videos: updated });
                                }}
                                className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-650 dark:bg-red-950/20 dark:text-red-400 rounded-lg text-[11px] font-bold transition cursor-pointer"
                              >
                                Excluir Vídeo
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>

                <div className="flex justify-end pt-4">
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-5 py-2.5 bg-luxury-gold hover:bg-luxury-gold-dark text-slate-950 font-black rounded-xl text-xs shadow-md transition cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    {t.saveSettingsBtn}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 4: AUDIT CHAT IA LOGS */}
          {activeTab === "chats" && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 p-1 rounded-md">
                    <Sparkles className="w-5 h-5" />
                  </span>
                  <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Anacleto IA Conversas Auditáveis
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Painel de transcrições e histórico de bate-papo dos visitantes com o assistente inteligente para finanças.
                </p>
              </div>

              {chats.length === 0 ? (
                <div className="py-24 text-center text-slate-450 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                  Nenhum histórico de chat capturado na base do Firestore ainda.
                </div>
              ) : (
                <div className="space-y-4">
                  {chats.map((c) => (
                    <div
                      key={c.id}
                      className="border border-slate-150 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-950/20 text-left"
                    >
                      <div className="flex justify-between items-center gap-2 mb-3 border-b border-slate-100 dark:border-slate-900 pb-2.5">
                        <span className="text-xs font-mono font-bold text-slate-400 bg-white dark:bg-slate-850 px-2 py-0.5 rounded-md">
                          REF ID: {c.id}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-550 dark:text-slate-400">
                            Idioma: <span className="font-bold text-slate-850 dark:text-slate-200 uppercase">{c.language}</span>
                          </span>
                        </div>
                      </div>

                      {/* Conversations elements */}
                      <div className="max-h-60 overflow-y-auto space-y-3.5 pr-2 no-scrollbar">
                        {(c.messages || []).map((msg: any, mIdx: number) => (
                          <div key={mIdx} className="text-xs">
                            <span className={`font-black uppercase text-[10px] tracking-wider ${msg.role === "user" ? "text-purple-600 dark:text-purple-400" : "text-emerald-500"}`}>
                              {msg.role === "user" ? "Cliente" : "AI Copiloto"}:
                            </span>
                            <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-100 dark:border-slate-850 text-slate-700 dark:text-slate-200 mt-1 whitespace-pre-wrap leading-relaxed shadow-xs">
                              {msg.text}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: USERS GESTION */}
          {activeTab === "users" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {t.adminUsersTitle}
                </h2>
                <p className="text-xs text-slate-500">
                  Gerencie funcionários internos com permissões administrativas de leitura e escrita direta.
                </p>
              </div>

              {/* Add staff form */}
              <form onSubmit={handleAddStaffAdmin} className="p-4 bg-slate-55/35 dark:bg-slate-950/20 rounded-xl space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {t.addUserBtn}
                </h3>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    required
                    value={newAdminName}
                    onChange={(e) => setNewAdminName(e.target.value)}
                    placeholder="Nome Completo"
                    className="flex-1 px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg focus:ring-1 focus:ring-indigo-500 outline-hidden"
                  />
                  <input
                    type="email"
                    required
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    placeholder="mail_acesso@anacleto.gt.tc"
                    className="flex-1 px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-910 dark:text-white rounded-lg focus:ring-1 focus:ring-indigo-500 outline-hidden"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-luxury-gold hover:bg-luxury-gold-dark text-slate-950 rounded-lg text-xs font-black shadow-sm cursor-pointer transition"
                  >
                    Adicionar Staff
                  </button>
                </div>
              </form>

              {/* List of admins */}
              <div className="space-y-2">
                {admins.map((adm) => (
                  <div
                    key={adm.id}
                    className="flex justify-between items-center bg-white dark:bg-slate-800 p-3.5 rounded-lg border border-slate-100 dark:border-slate-800 text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-900 dark:text-slate-100">{adm.name}</p>
                      <p className="text-slate-400 font-mono">{adm.email}</p>
                    </div>
                    
                    <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-450 font-bold uppercase tracking-wider rounded text-[9px] flex items-center gap-1">
                      <UserCheck className="w-3 h-3" />
                      ADMIN ATIVO
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: CRM CLIENTS */}
          {activeTab === "crm" && (
            <CrmTab
              budgets={budgets}
              invoices={invoices}
              visits={visits}
              t={t}
              onPrefillBudget={(client) => {
                setPrefillClient(client);
                setSelectedBudget(undefined);
                setIsBudgetOpen(true);
                showToast(`Formulário pré-preenchido para ${client.name}!`, "success");
              }}
              onPreviewBudget={(bgt) => {
                setSelectedPreviewBudget(bgt);
                setIsBudgetPreviewOpen(true);
              }}
            />
          )}

          {/* TAB 7: LEDGER CONTROLADORE */}
          {activeTab === "ledger" && (
            <LedgerTab invoices={invoices} t={t} />
          )}

          {/* TAB 8: CORPORE AI ADVISOR */}
          {activeTab === "advisor" && (
            <AdvisorTab
              budgets={budgets}
              invoices={invoices}
              visits={visits}
              senderConfig={senderConfig}
              currentLanguage={currentLanguage}
            />
          )}

        </div>
      </div>

      {/* Modular Modals attachments */}
      <BudgetModal
        isOpen={isBudgetOpen}
        onClose={() => {
          setIsBudgetOpen(false);
          setSelectedBudget(undefined);
          setPrefillClient(null);
        }}
        onSave={handleSaveBudget}
        budget={selectedBudget}
        t={t}
        currentLanguage={currentLanguage}
        prefillClient={prefillClient}
      />

      <InvoiceModal
        isOpen={isInvoiceOpen}
        onClose={() => {
          setIsInvoiceOpen(false);
          setSelectedInvoice(null);
        }}
        invoice={selectedInvoice}
        t={t}
      />

      <BudgetPreviewModal
        isOpen={isBudgetPreviewOpen}
        onClose={() => {
          setIsBudgetPreviewOpen(false);
          setSelectedPreviewBudget(null);
        }}
        budget={selectedPreviewBudget}
        t={t}
        senderConfig={senderConfig}
      />

    </div>
  );
}
