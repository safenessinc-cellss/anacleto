import React, { useState } from "react";
import { Sparkles, Terminal, ArrowRight, Brain, AlertTriangle, Send, Landmark, HelpCircle } from "lucide-react";
import { Budget, Invoice, SenderConfig } from "../types";
import Markdown from "react-markdown";

interface AdvisorTabProps {
  budgets: Budget[];
  invoices: Invoice[];
  visits: any[];
  senderConfig: SenderConfig;
  currentLanguage: string;
}

export default function AdvisorTab({ budgets, invoices, visits, senderConfig, currentLanguage }: AdvisorTabProps) {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // Formulates dynamic contextual payload based on real live metrics
  const triggerAiAdvisor = async (customPrompt?: string) => {
    const queryText = customPrompt || prompt;
    if (!queryText.trim()) return;

    setIsGenerating(true);
    setResponse("");

    // Calculate live business stats
    const totalBudgetsCount = budgets.length;
    const totalInvoicesCount = invoices.length;
    const totalInvoicedSum = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
    const totalPendingVisits = visits.length;

    const statsPayload = {
      totalBudgets: totalBudgetsCount,
      totalInvoices: totalInvoicesCount,
      totalInvoicedAmount: totalInvoicedSum,
      pendingVisits: totalPendingVisits,
      companyName: senderConfig.name || "Esquadrias Anacleto",
      city: senderConfig.city || "Lisboa",
      country: senderConfig.country || "Portugal",
      currency: senderConfig.currency || "EUR",
    };

    try {
      const res = await fetch("/api/ai-business-advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: queryText,
          companyStats: statsPayload,
          language: currentLanguage,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setResponse(data.advice || "Sem dados de conselho disponíveis.");
        if (!customPrompt) {
          setPrompt("");
        }
      } else {
        setResponse("Erro: O servidor da IA Anacleto encontrou uma anomalia ao analisar os balanços corporativos.");
      }
    } catch (err) {
      console.error(err);
      setResponse("Erro: Falha na conexão com os microsserviços da Gemini IA.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6 text-left">
      {/* Header Banner */}
      <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 border-b border-indigo-10/20 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-850 dark:text-slate-100 flex items-center gap-2">
            <Brain className="w-5 h-5 text-luxury-gold" />
            Conselheiro Corporativo Estratégico IA
          </h2>
          <p className="text-xs text-slate-400">
            Analise dados gerenciais em tempo real, tire dúvidas de conformidade com normas (NBR/ABNT/EN) e simule estratégias com Inteligência Artificial.
          </p>
        </div>
        <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 font-extrabold text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-md border border-amber-205/30">
          <Sparkles className="w-3.5 h-3.5" /> Gemini Pro active
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column: AI triggers & instructions */}
        <div className="space-y-4 lg:col-span-1">
          <div className="p-4 bg-slate-50 dark:bg-slate-950/45 border border-slate-150 dark:border-slate-800 rounded-2xl">
            <h3 className="text-xs font-black uppercase text-slate-600 dark:text-slate-300 tracking-wider mb-3">Modelos de Decisões do Diretor</h3>
            
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => triggerAiAdvisor("Faça uma auditoria de desempenho comercial nos nossos números. Calcule nossa taxa de conversão (Faturas pagas / Orçamentos gerados), analise o ticket médio e dê 3 sugestões ágeis para aumentar as vendas.")}
                disabled={isGenerating}
                className="w-full text-left p-3 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-800/80 transition-all duration-200 text-xs font-semibold flex flex-col justify-between group cursor-pointer disabled:opacity-50 shadow-xs"
              >
                <span className="text-luxury-gold dark:text-luxury-gold mb-1 flex items-center gap-1 uppercase tracking-wider text-[10.5px] font-black">📈 Auditoria de Desempenho</span>
                <span className="text-slate-400 font-medium text-[10px] leading-relaxed">Avalia taxas de conversão de faturamento, tamanho médio das propostas e metas.</span>
              </button>

              <button
                type="button"
                onClick={() => triggerAiAdvisor("Escreva uma proposta técnica-comercial altamente persuasiva focada nas qualidades acústicas e térmicas das esquadrias Suprema e Gold. Descreva os gatilhos sob a ótica de engenharia acústica para valorizar nosso produto perante arquitetos exigentes.")}
                disabled={isGenerating}
                className="w-full text-left p-3 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-800/80 transition-all duration-200 text-xs font-semibold flex flex-col justify-between group cursor-pointer disabled:opacity-50 shadow-xs"
              >
                <span className="text-luxury-gold dark:text-luxury-gold mb-1 flex items-center gap-1 uppercase tracking-wider text-[10.5px] font-black">🔒 Pitch de Vendas Acústico</span>
                <span className="text-slate-400 font-medium text-[10px] leading-relaxed">Gera roteiros estruturados ressaltando vedação com gaxetas EPDM e atenuação de dB.</span>
              </button>

              <button
                type="button"
                onClick={() => triggerAiAdvisor("Como otimizar os desperdícios de corte e estocagem de perfis de alumínio e placas de vidro na fábrica para economizar 10% de custos neste trimestre?")}
                disabled={isGenerating}
                className="w-full text-left p-3 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-800/80 transition-all duration-200 text-xs font-semibold flex flex-col justify-between group cursor-pointer disabled:opacity-50 shadow-xs"
              >
                <span className="text-luxury-gold dark:text-luxury-gold mb-1 flex items-center gap-1 uppercase tracking-wider text-[10.5px] font-black">⚙️ Controle de Perdas na Fábrica</span>
                <span className="text-slate-400 font-medium text-[10px] leading-relaxed">Sugere processos de otimização de plano de corte linear e estocagem segura para o gerente de fábrica.</span>
              </button>

              <button
                type="button"
                onClick={() => triggerAiAdvisor("Explique os coeficientes de pressão do vento exigidos na norma de esquadrias NBR 10821 nas diferentes regiões e andares de alta edificação para garantir que nossos engenheiros não cometam erros de segurança nos vidros.")}
                disabled={isGenerating}
                className="w-full text-left p-3 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-800/80 transition-all duration-200 text-xs font-semibold flex flex-col justify-between group cursor-pointer disabled:opacity-50 shadow-xs"
              >
                <span className="text-luxury-gold dark:text-luxury-gold mb-1 flex items-center gap-1 uppercase tracking-wider text-[10.5px] font-black">📐 Consultoria Normas NBR 10821</span>
                <span className="text-slate-400 font-medium text-[10px] leading-relaxed">Informações cruciais sobre cargas de vento, estanqueidade à água e integridade estrutural.</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right column: Interactive prompt and markdown response screen */}
        <div className="space-y-4 lg:col-span-2 flex flex-col">
          
          {/* Active stats overview fed to AI */}
          <div className="p-3 bg-luxury-gold/5 border border-luxury-gold/25 dark:border-luxury-gold/30 rounded-xl text-[10.5px] text-luxury-gold flex items-center gap-3">
            <Terminal className="w-5 h-5 shrink-0 animate-pulse text-luxury-gold" />
            <div>
              <span className="font-bold uppercase block tracking-wider">Metadados de Contexto Alimentados</span>
              <p className="text-slate-500 text-[10px]">
                Enviando automaticamente: {budgets.length} Orçamentos • {invoices.length} Faturas Ativas • {visits.length} Medições em Andamento.
              </p>
            </div>
          </div>

          {/* Prompt writer */}
          <div className="flex gap-2 font-sans">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Digite aqui sua pergunta estratégica específica de fábrica ou mercado..."
              className="flex-1 px-4 py-2 text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl focus:border-luxury-gold focus:ring-1 focus:ring-luxury-gold outline-hidden"
              disabled={isGenerating}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  triggerAiAdvisor();
                }
              }}
            />
            <button
              type="button"
              onClick={() => triggerAiAdvisor()}
              disabled={isGenerating || !prompt.trim()}
              className="px-4 py-2 bg-luxury-gold hover:bg-luxury-gold-dark text-slate-950 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              {isGenerating ? (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></span>
                  Processando...
                </span>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Analisar
                </>
              )}
            </button>
          </div>

          {/* AI Advisor Response panel */}
          <div className="flex-1 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800/80 p-5 overflow-auto max-h-[450px] min-h-[300px] relative transition-colors">
            {isGenerating && (
              <div className="absolute inset-0 bg-slate-50/70 dark:bg-slate-950/70 flex flex-col justify-center items-center gap-3">
                <div className="w-10 h-10 border-4 border-luxury-gold border-t-transparent rounded-full animate-spin"></div>
                <div className="text-xs text-slate-500 font-bold uppercase tracking-widest animate-pulse">Consultando Redes Neurais...</div>
              </div>
            )}

            {!response && !isGenerating ? (
              <div className="h-full flex flex-col justify-center items-center text-center p-8 space-y-3">
                <HelpCircle className="w-10 h-10 text-slate-350" />
                <h4 className="font-extrabold text-slate-800 dark:text-slate-300 uppercase tracking-wider text-xs">Terminal de Aconselhamento Ativo</h4>
                <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                  Escolha um dos modelos rápidos de auditoria à esquerda ou faça sua própria pergunta personalizada no console de comando de IA acima.
                </p>
              </div>
            ) : (
              <div className="markdown-body dark:prose-invert text-xs text-slate-800 dark:text-slate-200 leading-relaxed space-y-3 text-left">
                <Markdown>{response}</Markdown>
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
