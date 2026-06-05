import React, { useState, useEffect } from "react";
import {
  Users,
  Tag,
  Award,
  Edit3,
  Save,
  Phone,
  Mail,
  MapPin,
  DollarSign,
  Activity,
  Calendar,
  FileText,
  PlusCircle,
  Eye,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Clock,
  Briefcase,
  Layers,
  TrendingUp,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { Budget, Invoice } from "../types";
import { db } from "../firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { formatCurrency } from "../utils";

interface CrmTabProps {
  budgets: Budget[];
  invoices: Invoice[];
  visits: any[];
  t: any;
  onPrefillBudget?: (client: { name: string; email: string; nif?: string; address?: string; }) => void;
  onPreviewBudget?: (budget: Budget) => void;
}

interface ClientProfile {
  email: string;
  name: string;
  nif: string;
  address: string;
  phone: string;
  totalDealsWorth: number;
  stage: "Lead" | "Medição Grátis" | "Em Negociação" | "Contrato Fechado" | "Cancelado";
  isVIP: boolean;
  notes: string;
}

export default function CrmTab({
  budgets,
  invoices,
  visits,
  t,
  onPrefillBudget,
  onPreviewBudget
}: CrmTabProps) {
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
  const [editingEmail, setEditingEmail] = useState<string | null>(null);

  // Edit form states
  const [tempName, setTempName] = useState("");
  const [tempPhone, setTempPhone] = useState("");
  const [tempNif, setTempNif] = useState("");
  const [tempAddress, setTempAddress] = useState("");
  const [tempNotes, setTempNotes] = useState("");
  const [tempStage, setTempStage] = useState<ClientProfile["stage"]>("Lead");
  const [tempIsVIP, setTempIsVIP] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Schedule in-place visit state
  const [vDate, setVDate] = useState("");
  const [vTime, setVTime] = useState("");
  const [vService, setVService] = useState("Vistoria Técnica de Esquadrias");
  const [vNotes, setVNotes] = useState("");
  const [isScheduling, setIsScheduling] = useState(false);

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [vipFilter, setVipFilter] = useState<string>("all");

  // Extract profiles from budgets, invoices, and visits in real-time
  useEffect(() => {
    const rawClientsMap: { [email: string]: ClientProfile } = {};

    // 1. Populate from visits (leads which did not purchase yet)
    visits.forEach((v) => {
      if (!v.email) return;
      const email = v.email.toLowerCase().trim();

      if (!rawClientsMap[email]) {
        rawClientsMap[email] = {
          email,
          name: v.name || "Interessado de Visita",
          nif: "Pendente",
          address: v.address || "Pendente",
          phone: v.phone || "",
          totalDealsWorth: 0,
          stage: v.status === "completed" ? "Em Negociação" : "Medição Grátis",
          isVIP: false,
          notes: "",
        };
      } else {
        if (v.phone && !rawClientsMap[email].phone) {
          rawClientsMap[email].phone = v.phone;
        }
        if (v.address && v.address !== "Pendente" && rawClientsMap[email].address === "Pendente") {
          rawClientsMap[email].address = v.address;
        }
      }
    });

    // 2. Populate / merge from budgets
    budgets.forEach((b) => {
      if (!b.clientEmail) return;
      const email = b.clientEmail.toLowerCase().trim();

      if (!rawClientsMap[email]) {
        rawClientsMap[email] = {
          email,
          name: b.clientName || "Cliente Desconhecido",
          nif: b.clientNif || "Sem NIF",
          address: b.clientAddress || "Sem Morada Registrada",
          phone: "",
          totalDealsWorth: 0,
          stage: b.status === "invoiced" ? "Contrato Fechado" : b.status === "accepted" ? "Em Negociação" : "Lead",
          isVIP: false,
          notes: "",
        };
      } else {
        if (b.clientName && rawClientsMap[email].name === "Interessado de Visita") {
          rawClientsMap[email].name = b.clientName;
        }
        if (b.clientNif && rawClientsMap[email].nif === "Pendente") {
          rawClientsMap[email].nif = b.clientNif;
        }
        if (b.clientAddress && rawClientsMap[email].address === "Pendente") {
          rawClientsMap[email].address = b.clientAddress;
        }
      }

      rawClientsMap[email].totalDealsWorth += b.total || 0;

      // Upgrade stages logically representation
      if (b.status === "invoiced") {
        rawClientsMap[email].stage = "Contrato Fechado";
      } else if (b.status === "accepted" && rawClientsMap[email].stage !== "Contrato Fechado") {
        rawClientsMap[email].stage = "Em Negociação";
      }
    });

    const profiles = Object.values(rawClientsMap);

    // Fetch enriched details like custom notes/VIP tags from Firebase companies_crm
    const loadEnrichedClientData = async () => {
      const enriched = await Promise.all(
        profiles.map(async (client) => {
          try {
            const clientRef = doc(db, "companies_crm", client.email);
            const snap = await getDoc(clientRef);
            if (snap.exists()) {
              const data = snap.data();
              return {
                ...client,
                name: data.name || client.name,
                phone: data.phone || client.phone || "",
                nif: data.nif || client.nif || "",
                address: data.address || client.address || "",
                stage: data.stage || client.stage,
                isVIP: data.isVIP ?? client.isVIP,
                notes: data.notes || "",
              };
            }
          } catch (err) {
            console.warn("Client enrich error:", err);
          }
          return client;
        })
      );
      // Sort clients by total deals worth descending
      enriched.sort((a, b) => b.totalDealsWorth - a.totalDealsWorth);
      setClients(enriched);
    };

    if (profiles.length > 0) {
      loadEnrichedClientData();
    } else {
      setClients([]);
    }
  }, [budgets, invoices, visits]);

  const handleStartEdit = (client: ClientProfile) => {
    setEditingEmail(client.email);
    setTempName(client.name);
    setTempPhone(client.phone);
    setTempNif(client.nif);
    setTempAddress(client.address);
    setTempNotes(client.notes);
    setTempStage(client.stage);
    setTempIsVIP(client.isVIP);
  };

  const handleSaveClientProfile = async (email: string) => {
    setIsSaving(true);
    try {
      const clientRef = doc(db, "companies_crm", email);
      await setDoc(
        clientRef,
        {
          name: tempName,
          phone: tempPhone,
          nif: tempNif,
          address: tempAddress,
          notes: tempNotes,
          stage: tempStage,
          isVIP: tempIsVIP,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      // Locally update client profile state
      setClients((prev) =>
        prev.map((c) =>
          c.email === email
            ? {
                ...c,
                name: tempName,
                phone: tempPhone,
                nif: tempNif,
                address: tempAddress,
                notes: tempNotes,
                stage: tempStage,
                isVIP: tempIsVIP,
              }
            : c
        )
      );
      setEditingEmail(null);
    } catch (err) {
      console.error(err);
      alert("Não foi possível salvar os dados do cliente.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateVisit = async (client: ClientProfile, e: React.FormEvent) => {
    e.preventDefault();
    if (!vDate || !vTime) {
      alert("Por favor, preencha a data e o horário.");
      return;
    }
    setIsScheduling(true);
    try {
      const visitId = "vst_" + Math.random().toString(36).substring(2);
      await setDoc(doc(db, "visits", visitId), {
        id: visitId,
        name: client.name,
        email: client.email,
        phone: client.phone || "Pendente",
        preferDate: vDate,
        preferTime: vTime,
        service: vService,
        notes: vNotes || "Agendado via central de relacionamento CRM.",
        status: "pending",
        createdAt: new Date().toISOString(),
      });
      setVDate("");
      setVTime("");
      setVNotes("");
      alert("Parabéns! Visita técnica de medição cadastrada com sucesso.");
    } catch (err) {
      console.error(err);
      alert("Falha ao cadastrar visita técnica.");
    } finally {
      setIsScheduling(false);
    }
  };

  const toggleExpand = (email: string) => {
    if (expandedEmail === email) {
      setExpandedEmail(null);
    } else {
      setExpandedEmail(email);
    }
  };

  // Stage styles map
  const stageStyles = {
    "Lead": "bg-blue-50 text-blue-650 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/40",
    "Medição Grátis": "bg-purple-50 text-purple-650 border-purple-200 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900/40",
    "Em Negociação": "bg-amber-50 text-amber-650 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/40",
    "Contrato Fechado": "bg-emerald-50 text-emerald-650 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40",
    "Cancelado": "bg-rose-50 text-rose-650 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/40",
  };

  // Stage statistics calculations
  const totalLeads = clients.length;
  const closedContracts = clients.filter((c) => c.stage === "Contrato Fechado").length;
  const inNegotiation = clients.filter((c) => c.stage === "Em Negociação").length;
  const activeVisitsCount = clients.filter((c) => c.stage === "Medição Grátis").length;
  const conversionRate = totalLeads > 0 ? Math.round((closedContracts / totalLeads) * 100) : 0;

  // Search & Filter filter
  const filteredClients = clients.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.nif.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStage = stageFilter === "all" || c.stage === stageFilter;
    const matchesVip =
      vipFilter === "all" || (vipFilter === "vip" && c.isVIP) || (vipFilter === "normal" && !c.isVIP);

    return matchesSearch && matchesStage && matchesVip;
  });

  return (
    <div className="space-y-6 text-left">
      
      {/* Header Banner - Futuristic command style */}
      <div className="relative overflow-hidden bg-slate-950 p-6 rounded-3xl border border-slate-800 shadow-[0_4px_30px_rgba(0,0,0,0.2)]">
        <div className="absolute top-0 right-0 w-96 h-96 bg-luxury-gold/5 blur-3xl rounded-full translate-x-20 -translate-y-20"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest text-luxury-gold">ANACLETO CRM CONTROL CENTER</span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
              <Users className="w-6 h-6 text-luxury-gold" />
              Diretório Unificado de Clientes & CRM
            </h2>
            <p className="text-xs text-slate-400 max-w-xl">
              Plataforma modular e preditiva de pipeline. Gerencie visitas de campo, orçamentos correspondentes e acompanhe o funil comercial integrando medições a contratos.
            </p>
          </div>
          <div className="shrink-0 bg-slate-900 border border-slate-805/50 px-4 py-2.5 rounded-2xl flex flex-col items-end font-mono">
            <span className="text-[10px] text-slate-405 font-bold uppercase tracking-widest">VOLUME DO FUNIL</span>
            <span className="text-xl font-black text-luxury-gold">
              {formatCurrency(clients.reduce((acc, c) => acc + c.totalDealsWorth, 0), "BRL")}
            </span>
          </div>
        </div>
      </div>

      {/* Modern Bento Stats Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="bg-slate-50 dark:bg-slate-950/45 p-4 rounded-2xl border border-slate-100 dark:border-slate-850 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">TOTAL DE CONTATOS</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">{totalLeads}</span>
            <span className="text-xs text-slate-400 font-semibold">perfis</span>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-950/45 p-4 rounded-2xl border border-slate-100 dark:border-slate-850 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">MEDIÇÕES TÉCNICAS</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-purple-600 dark:text-purple-400 font-mono">{activeVisitsCount}</span>
            <span className="text-xs text-slate-400 font-semibold">ativas</span>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-950/45 p-4 rounded-2xl border border-slate-100 dark:border-slate-850 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">EM NEGOCIAÇÃO</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-amber-500 font-mono">{inNegotiation}</span>
            <span className="text-xs text-slate-400 font-semibold">propostas</span>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-950/45 p-4 rounded-2xl border border-slate-100 dark:border-slate-850 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">CONTRATOS CRISTALIZADOS</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-emerald-500 font-mono">{closedContracts}</span>
            <span className="text-xs text-slate-400 font-semibold">ganhos</span>
          </div>
        </div>

        <div className="col-span-2 lg:col-span-1 bg-luxury-gold/5 dark:bg-luxury-gold/[0.03] p-4 rounded-2xl border border-luxury-gold/20 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-luxury-gold dark:text-luxury-gold uppercase tracking-widest block mb-1">CONVERSÃO COMERCIAL</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-luxury-gold font-mono">{conversionRate}%</span>
            <TrendingUp className="w-4 h-4 text-luxury-gold self-center" />
          </div>
        </div>
      </div>

      {/* Controls: Active Search, Filters, Stage pickers */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome, e-mail, telefone, NIF ou morada..."
            className="w-full px-4 py-2.5 text-xs bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-1 focus:ring-luxury-gold outline-hidden text-slate-900 dark:text-white"
          />
        </div>

        <div className="flex gap-2 shrink-0">
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-1 focus:ring-luxury-gold outline-hidden text-slate-900 dark:text-white"
          >
            <option value="all">Todas Etapas</option>
            <option value="Lead">Lead</option>
            <option value="Medição Grátis">Medição Grátis</option>
            <option value="Em Negociação">Em Negociação</option>
            <option value="Contrato Fechado">Contrato Fechado</option>
            <option value="Cancelado">Cancelado</option>
          </select>

          <select
            value={vipFilter}
            onChange={(e) => setVipFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-1 focus:ring-luxury-gold outline-hidden text-slate-900 dark:text-white"
          >
            <option value="all">Filtro VIP (Todos)</option>
            <option value="vip">Apenas VIP</option>
            <option value="normal">Clientes Comuns</option>
          </select>
        </div>
      </div>

      {/* Main interactive contacts ledger list */}
      {filteredClients.length === 0 ? (
        <div className="p-12 text-center border-2 border-dashed border-slate-100 dark:border-slate-850 bg-slate-50/20 dark:bg-slate-950/10 rounded-3xl">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500 font-semibold">Nenhum perfil de CRM localizado nos registros.</p>
          <p className="text-xs text-slate-400 mt-1">Experimente alterar os filtros de busca para liberar mais resultados.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredClients.map((client) => {
            const isEditing = editingEmail === client.email;
            const isExpanded = expandedEmail === client.email;

            // Gather associated details
            const clientBudgets = budgets.filter((b) => b.clientEmail?.toLowerCase().trim() === client.email.toLowerCase().trim());
            const clientInvoices = invoices.filter((i) => i.clientEmail?.toLowerCase().trim() === client.email.toLowerCase().trim());
            const clientVisits = visits.filter((v) => v.email?.toLowerCase().trim() === client.email.toLowerCase().trim() || (client.phone && v.phone === client.phone));

            return (
              <div
                key={client.email}
                className={`bg-white dark:bg-[#111216] rounded-2xl border transition-all duration-300 overflow-hidden ${
                  client.isVIP
                    ? "border-luxury-gold bg-luxury-gold/[0.01] hover:shadow-[0_8px_30px_rgba(197,168,80,0.06)]"
                    : isExpanded
                    ? "border-slate-300 dark:border-slate-700 shadow-md"
                    : "border-slate-100 dark:border-slate-850 hover:border-slate-200 dark:hover:border-slate-800"
                }`}
              >
                {/* Contact Card Header Summary */}
                <div
                  onClick={() => toggleExpand(client.email)}
                  className="p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 cursor-pointer select-none"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="font-extrabold text-slate-900 dark:text-white tracking-tight text-base truncate">
                        {client.name}
                      </h3>
                      {client.isVIP && (
                        <span className="flex items-center gap-0.5 px-2 py-0.5 bg-luxury-gold text-slate-950 font-black text-[9px] uppercase tracking-widest rounded-full">
                          <Award className="w-2.5 h-2.5" /> VIP
                        </span>
                      )}
                      
                      <span className={`px-2.5 py-0.5 font-bold text-[9px] uppercase tracking-wider rounded-md border ${stageStyles[client.stage] || ""}`}>
                        {client.stage}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-y-1 gap-x-4 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1.5 truncate">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" /> {client.email}
                      </span>
                      {client.phone && (
                        <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 shrink-0 font-semibold">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" /> {client.phone}
                        </span>
                      )}
                      {client.nif && client.nif !== "Pendente" && (
                        <span className="flex items-center gap-1.5 shrink-0">
                          <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" /> {client.nif}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Financial deals summaries */}
                  <div className="flex items-center gap-4 self-stretch md:self-auto justify-between border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 dark:border-slate-800 shrink-0">
                    <div className="text-left md:text-right">
                      <span className="block text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">PROPOSTAS</span>
                      <span className="text-base font-black text-luxury-gold font-mono">
                        {formatCurrency(client.totalDealsWorth, "BRL")}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500 shrink-0 pl-2">
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-luxury-gold animate-bounce" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400 hover:text-white transition" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded content slot */}
                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-slate-850 bg-slate-50/40 dark:bg-slate-950/[0.15] p-5 space-y-5 transition-all duration-300">
                    
                    {/* EDIT CORE MODULE OR READ PROFILE BLOCK */}
                    {isEditing ? (
                      <div className="p-4 bg-slate-100/50 dark:bg-slate-950/80 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-850 pb-2">
                          <h4 className="text-xs font-black text-luxury-gold uppercase tracking-widest flex items-center gap-1">
                            <Edit3 className="w-3.5 h-3.5" /> Editar Cadastro Comercial do Cliente
                          </h4>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nome Completo</label>
                            <input
                              type="text"
                              value={tempName}
                              onChange={(e) => setTempName(e.target.value)}
                              className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 text-slate-900 dark:text-white rounded-lg outline-hidden focus:ring-1 focus:ring-luxury-gold"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Telefone / Celular</label>
                            <input
                              type="text"
                              value={tempPhone}
                              onChange={(e) => setTempPhone(e.target.value)}
                              className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 text-slate-900 dark:text-white rounded-lg outline-hidden focus:ring-1 focus:ring-luxury-gold"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">CPF ou CNPJ</label>
                            <input
                              type="text"
                              value={tempNif}
                              onChange={(e) => setTempNif(e.target.value)}
                              className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 text-slate-900 dark:text-white rounded-lg outline-hidden focus:ring-1 focus:ring-luxury-gold"
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Endereço de Obra / Faturamento</label>
                            <input
                              type="text"
                              value={tempAddress}
                              onChange={(e) => setTempAddress(e.target.value)}
                              className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 text-slate-900 dark:text-white rounded-lg outline-hidden focus:ring-1 focus:ring-luxury-gold"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Status do Funil</label>
                            <select
                              value={tempStage}
                              onChange={(e) => setTempStage(e.target.value as any)}
                              className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 text-slate-900 dark:text-white rounded-lg outline-hidden focus:ring-1 focus:ring-luxury-gold"
                            >
                              <option value="Lead">Lead Inicial</option>
                              <option value="Medição Grátis">Medição de Campo</option>
                              <option value="Em Negociação">Negociação de Proposta</option>
                              <option value="Contrato Fechado">Contrato Cristalizado</option>
                              <option value="Cancelado">Oportunidade Perdida</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Anotações Internas & Requisitos Clientes (Ex: Vidros termoacústicos duplos)</label>
                          <textarea
                            rows={2}
                            value={tempNotes}
                            onChange={(e) => setTempNotes(e.target.value)}
                            placeholder="Adicione preferências técnicas da esquadria, caixilharia ideal ou notas sobre medição técnica."
                            className="w-full p-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl outline-hidden focus:ring-1 focus:ring-luxury-gold"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`vip-edit-${client.email}`}
                            checked={tempIsVIP}
                            onChange={(e) => setTempIsVIP(e.target.checked)}
                            className="w-4 h-4 cursor-pointer accent-luxury-gold"
                          />
                          <label htmlFor={`vip-edit-${client.email}`} className="text-xs font-bold text-luxury-gold cursor-pointer uppercase tracking-wider flex items-center gap-1">
                            <Award className="w-4 h-4" /> Tag Premium VIP Esquadrias
                          </label>
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-205 dark:border-slate-850">
                          <button
                            type="button"
                            onClick={() => setEditingEmail(null)}
                            className="px-3.5 py-1.5 text-xs text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveClientProfile(client.email)}
                            disabled={isSaving}
                            className="px-4 py-1.5 text-xs bg-luxury-gold text-slate-950 font-black rounded-lg transition cursor-pointer flex items-center gap-1 shadow-md hover:brightness-110"
                          >
                            <Save className="w-3.5 h-3.5" />
                            {isSaving ? "Cristalizando..." : "Confirmar Mudanças"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                        
                        {/* LEFT COLUMN (7 COLS): MEMOS & ACTIONS */}
                        <div className="lg:col-span-8 space-y-4">
                          <div className="bg-white dark:bg-[#15171d] p-4 rounded-xl border border-slate-100 dark:border-slate-800/80 space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                <Briefcase className="w-3.5 h-3.5 text-luxury-gold" /> DIRETRIZES TÉCNICAS INTERNAS
                              </span>
                              <button
                                type="button"
                                onClick={() => handleStartEdit(client)}
                                className="text-xs text-luxury-gold hover:underline font-bold flex items-center gap-1"
                              >
                                <Edit3 className="w-3 h-3" /> Editar Ficha do Cliente
                              </button>
                            </div>
                            
                            <p className="text-xs text-slate-700 dark:text-slate-350 italic bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg leading-relaxed">
                              {client.notes || "Sem diretrizes gravadas ainda. Clique em 'Editar Ficha do Cliente' para carregar exigências do vão livre, cor bronze/preta ou vidros de segurança exigidos."}
                            </p>
                          </div>

                          {/* ACTIONS STRIP */}
                          <div className="flex flex-wrap items-center gap-2">
                            {onPrefillBudget && (
                              <button
                                onClick={() => onPrefillBudget({
                                  name: client.name,
                                  email: client.email,
                                  nif: client.nif !== "Pendente" ? client.nif : "",
                                  address: client.address !== "Pendente" ? client.address : ""
                                })}
                                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-luxury-gold text-slate-950 text-xs font-black rounded-lg transition shadow-md hover:brightness-110 active:scale-98"
                              >
                                <PlusCircle className="w-4 h-4 text-slate-950" />
                                Criar Novo Orçamento de Obra
                              </button>
                            )}

                            <span className="text-xs text-slate-400 dark:text-slate-500 px-1 select-none">ou</span>

                            <a
                              href={`https://wa.me/${client.phone?.replace(/[^0-9]/g, "")}`}
                              target="_blank"
                              referrerPolicy="no-referrer"
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-emerald-500/30 dark:border-emerald-500/10 text-emerald-500 hover:bg-emerald-500/5 transition text-xs font-bold rounded-lg"
                            >
                              <Phone className="w-3.5 h-3.5" /> Direct WhatsApp
                            </a>
                          </div>
                        </div>

                        {/* RIGHT COLUMN (4 COLS): PIPELINE METRICS TIMELINE */}
                        <div className="lg:col-span-4 bg-slate-100/50 dark:bg-[#15171d]/60 p-4 rounded-xl border border-slate-100 dark:border-slate-800 text-xs text-slate-705 dark:text-slate-350 space-y-3">
                          <span className="text-[10px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest block border-b border-slate-200 dark:border-slate-800 pb-1.5">
                            CRISTALIZAÇÃO FUNIL DE VENDAS
                          </span>
                          
                          <div className="space-y-2 font-semibold">
                            <div className="flex justify-between items-center">
                              <span>Total emitido em propostas:</span>
                              <span className="font-bold text-slate-950 dark:text-white font-mono">{formatCurrency(client.totalDealsWorth, "BRL")}</span>
                            </div>

                            <div className="flex justify-between items-center">
                              <span>Orçamentos salvos:</span>
                              <span className="font-bold text-slate-900 dark:text-slate-200 font-mono">{clientBudgets.length}</span>
                            </div>

                            <div className="flex justify-between items-center">
                              <span>Visitas agendadas:</span>
                              <span className="font-bold text-slate-900 dark:text-slate-200 font-mono">{clientVisits.length}</span>
                            </div>

                            <div className="flex justify-between items-center">
                              <span>Contratos de Glazing faturados:</span>
                              <span className="font-bold text-emerald-550 dark:text-emerald-400 font-mono">{clientInvoices.length}</span>
                            </div>
                          </div>
                        </div>

                      </div>
                    )}

                    {/* TWO-CARDS WRAPPER FOR DEEP GRID LINKING (FINANCIALS vs SERVICES) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-3">
                      
                      {/* CARD A: PROPOSTAS FINANCEIRAS E CONTRATOS */}
                      <div className="bg-white dark:bg-[#141519] rounded-2xl border border-slate-100 dark:border-slate-800/60 p-4 space-y-4">
                        <div className="flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-850 pb-2">
                          <FileText className="w-4 h-4 text-luxury-gold" />
                          <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">
                            Propostas de Orçamento ({clientBudgets.length})
                          </h4>
                        </div>

                        {clientBudgets.length === 0 ? (
                          <p className="text-xs text-slate-405 italic py-6 text-center">Nenhum orçamento emitido para este endereço ainda.</p>
                        ) : (
                          <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                            {clientBudgets.map((b) => (
                              <div
                                key={b.id}
                                className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-850 text-xs"
                              >
                                <div className="space-y-0.5">
                                  <p className="font-bold text-slate-850 dark:text-slate-150 font-mono">{b.number}</p>
                                  <p className="text-[10px] text-slate-400">{b.date}</p>
                                </div>

                                <div className="flex items-center gap-2">
                                  <span className="font-black text-slate-900 dark:text-white font-mono">{formatCurrency(b.total, "BRL")}</span>
                                  {onPreviewBudget && (
                                    <button
                                      type="button"
                                      onClick={() => onPreviewBudget(b)}
                                      className="p-1 px-1.5 bg-luxury-gold/10 hover:bg-luxury-gold/20 text-luxury-gold rounded-md transition font-black text-[9px] uppercase tracking-wider flex items-center gap-0.5"
                                      title="Visualizar Proposta Profissional PDF"
                                    >
                                      <Eye className="w-3.5 h-3.5" /> PDF
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* CARD B: MEDIÇÃO VISIT E IN-PLACE SCHEDULING FORM */}
                      <div className="bg-white dark:bg-[#141519] rounded-2xl border border-slate-100 dark:border-slate-805 p-4 space-y-4">
                        
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-850 pb-2">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-4 h-4 text-purple-400" />
                            <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">
                              Visitas de Medição Laser ({clientVisits.length})
                            </h4>
                          </div>

                          <button
                            onClick={() => setExpandedEmail(client.email)} // refresh
                            className="text-[10px] text-purple-400 hover:underline font-bold"
                          >
                            Ver Próximas
                          </button>
                        </div>

                        {clientVisits.length === 0 ? (
                          <div className="text-center py-4 bg-slate-50 dark:bg-slate-900/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-800/60">
                            <p className="text-xs text-slate-500 font-medium">Nenhuma visita agendada para medição de campo.</p>
                          </div>
                        ) : (
                          <div className="max-h-32 overflow-y-auto space-y-2 pr-1">
                            {clientVisits.map((v: any) => (
                              <div
                                key={v.id}
                                className="p-2.5 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-100 dark:border-slate-850 text-xs flex justify-between items-center"
                              >
                                <div className="space-y-0.5">
                                  <p className="font-bold text-slate-900 dark:text-slate-200">{v.preferDate} · <span className="text-purple-400">{v.preferTime}</span></p>
                                  <p className="text-[10px] text-slate-400 truncate max-w-[180px]">{v.service}</p>
                                </div>
                                <span className="text-[9px] uppercase font-black tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400">
                                  {v.status === "confirmed" ? "Confirmada" : v.status === "completed" ? "Concluída" : v.status === "cancelled" ? "Cancelada" : "Pendente"}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* IN-PLACE VISITS FORM SECTION */}
                        <div className="border-t border-slate-100 dark:border-slate-850 pt-3">
                          <span className="text-[9px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest block mb-2">
                             AGENDAR VISITA COMERCIAL DE CAMPO
                          </span>

                          <form onSubmit={(e) => handleCreateVisit(client, e)} className="space-y-2.5">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[8px] font-black uppercase text-slate-400 dark:text-slate-500 mb-0.5">Data Preferida</label>
                                <input
                                  type="date"
                                  required
                                  value={vDate}
                                  onChange={(e) => setVDate(e.target.value)}
                                  className="w-full text-xs p-1.5 bg-slate-55 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-lg focus:ring-1 focus:ring-luxury-gold"
                                />
                              </div>

                              <div>
                                <label className="block text-[8px] font-black uppercase text-slate-400 dark:text-slate-500 mb-0.5">Janela Horário</label>
                                <input
                                  type="text"
                                  placeholder="Ex: 14:00 - 16:30"
                                  required
                                  value={vTime}
                                  onChange={(e) => setVTime(e.target.value)}
                                  className="w-full text-xs p-1.5 bg-slate-55 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-lg focus:ring-1 focus:ring-luxury-gold"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-2">
                              <div>
                                <label className="block text-[8px] font-black uppercase text-slate-400 dark:text-slate-500 mb-0.5">Serviço Técnico Desejado</label>
                                <select
                                  value={vService}
                                  onChange={(e) => setVService(e.target.value)}
                                  className="w-full text-xs p-1.5 bg-slate-55 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-lg focus:ring-1 focus:ring-luxury-gold"
                                >
                                  <option value="Vistoria Técnica de Esquadrias">Vistoria Geral de Vãos</option>
                                  <option value="Medição Laser Gold Premium">Medição Laser (Novo Vão)</option>
                                  <option value="Avaliação de Fachada Glazing">Avaliação Fachada Laminada</option>
                                  <option value="Pergolados & Coberturas">Medição Cobertura de Vidro</option>
                                </select>
                              </div>
                            </div>

                            <button
                              type="submit"
                              disabled={isScheduling}
                              className="w-full py-1.5 bg-purple-650 hover:bg-purple-750 text-white text-[10px] font-black rounded-lg transition uppercase tracking-widest cursor-pointer shadow-sm active:scale-99"
                            >
                              {isScheduling ? "Registrando Visita..." : "Confirmar Agendamento de Medição"}
                            </button>
                          </form>

                        </div>

                      </div>

                    </div>

                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
