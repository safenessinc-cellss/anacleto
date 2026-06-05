import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, Send, X, Bot, User, Sparkles, Calendar, BadgePercent, Shield, TrendingUp, HelpCircle, Sliders } from "lucide-react";
import { ChatMessage } from "../types";
import { Translation } from "../translations";
import { db } from "../firebase";
import { doc, updateDoc, setDoc, arrayUnion } from "firebase/firestore";

interface ChatbotProps {
  currentLanguage: string;
  t: Translation;
}

export default function Chatbot({ currentLanguage, t }: ChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showNudge, setShowNudge] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Salesperson adaptive messages & promotions based on active language
  const salesBoard = {
    es: {
      botGreeting: "¡Hola! Bienvenido a Anacleto Esquadrias de Lujo. Soy su asesor y vendedor especializado en sistemas de aberturas de aluminio de alta gama y vidrios templados. ¿Cómo puedo apoyarle a diseñar el espacio de sus sueños hoy?",
      promoTitle: "🎁 SÚPER OFERTA DEL MES",
      promoText: "¡Cierre su proyecto este mes y reciba tratamiento antimanchas de alta performance para su mampara de baño y medición láser 100% GRATUITA!",
      ctaTitle: "Seleccione una opción para iniciar el asesoramiento inmediato:",
      nudgeText: "¿Buscando aberturas de aluminio o vidrios? ¡Permítame ayudarle! 🪟",
      actions: [
        {
          label: "📏 Visita y Medición Láser Gratis",
          prompt: "Me gustaría agendar una medición láser gratuita y visita técnica de un experto en mi domicilio para planificar mis aberturas.",
          icon: <Calendar className="w-4 h-4 text-amber-500" />
        },
        {
          label: "🪟 Ventanas y Puertas Premium (Gold/Suprema)",
          prompt: "¿Qué opciones de puertas correderas, maxim-ar y ventanas acústicas premium en aluminio Suprema/Gold ofrecen y cuáles son sus ventajas?",
          icon: <Sliders className="w-4 h-4 text-blue-500" />
        },
        {
          label: "🚿 Mamparas de Baño y Vidrios Templados",
          prompt: "Quiero diseñar una mampara de baño (box de baño) templada a medida con perfiles de acero o aluminio premium, ¿qué diseños tienen?",
          icon: <Shield className="w-4 h-4 text-emerald-500" />
        },
        {
          label: "🖥️ ¿Cómo Simular un Presupuesto con IA?",
          prompt: "¿Cómo puedo usar vuestro simulador inteligente para calcular un presupuesto preliminar de vidrios y esquadrías?",
          icon: <Sparkles className="w-4 h-4 text-purple-500" />
        }
      ]
    },
    pt: {
      botGreeting: "Olá! Seja muito bem-vindo à Anacleto Esquadrias de Luxo. Sou seu consultor técnico e vendedor especialista em esquadrias de alumínio premium, fachadas estruturais e vidros certificados. Como posso apoiar você no projeto dos seus sonhos hoje?",
      promoTitle: "🎁 SUPER OFERTA DO MÊS",
      promoText: "Feche seu projeto residencial este mês e ganhe vedação premium contra ventos e tratamento antimanchas no box de vidro 100% GRATUITOS!",
      ctaTitle: "Selecione uma de nossas opções abaixo para iniciar o atendimento comercial imediato com nossa IA:",
      nudgeText: "Dúvidas ou Orçamento? Fale comigo agora! 🪟",
      actions: [
        {
          label: "📏 Visita e Medição Laser Grátis",
          prompt: "Olá! Gostaria de agendar uma medição a laser gratuita e visita técnica de um especialista na minha obra para planejarmos as esquadrias.",
          icon: <Calendar className="w-4 h-4 text-amber-500" />
        },
        {
          label: "🪟 Portas e Janelas Premium (Gold/Suprema)",
          prompt: "Gostaria de conhecer os diferenciais de portas de correr, maxim-ars e janelas acústicas nas linhas Suprema e Gold de alumínio.",
          icon: <Sliders className="w-4 h-4 text-blue-500" />
        },
        {
          label: "🚿 Box de Banheiro e Vidros Temperados",
          prompt: "Gostaria de planejar um box de banheiro sob medida em vidro temperado certificado e ferragens de alta durabilidade.",
          icon: <Shield className="w-4 h-4 text-emerald-500" />
        },
        {
          label: "🖥️ Como usar o Simulador de Projeto via IA?",
          prompt: "Como funciona o simulador inteligente para obter uma estimativa de preços de esquadrias e vidros para minha casa?",
          icon: <Sparkles className="w-4 h-4 text-purple-500" />
        }
      ]
    },
    en: {
      botGreeting: "Greetings! Welcome to Anacleto Luxury Glazing. I am your specialized sales and design consultant for high-end aluminum openings, structural glazing facades, and safety glass solutions. How can I transform your building concepts today?",
      promoTitle: "🎁 SUPER DEAL OF THE WEEK",
      promoText: "Construct your home project with us this month and receive free elite acoustic seals and glass smudge treatments + 100% FREE on-site laser measurements!",
      ctaTitle: "Select a topic below to instantly connect with our AI sales adviser:",
      nudgeText: "Need a Quote or Laser Measurement? Chat with me! 🪟",
      actions: [
        {
          label: "📏 Schedule 100% Free Laser Inspection",
          prompt: "Hello! I would like to schedule a free on-site laser measurement and professional design consult for my building.",
          icon: <Calendar className="w-4 h-4 text-amber-500" />
        },
        {
          label: "🪟 Premium Aluminum Doors & Windows (Gold)",
          prompt: "What high-durability sliding doors, pivot doors, and certified windows do you manufacture in Suprema and Gold series?",
          icon: <Sliders className="w-4 h-4 text-blue-500" />
        },
        {
          label: "🚿 Safety Shower Boxes & Custom Partitions",
          prompt: "I am looking for high-end custom shower boxes, custom vanity mirrors, and safety tempered glass partitions.",
          icon: <Shield className="w-4 h-4 text-emerald-500" />
        },
        {
          label: "🖥️ Guide me through the Smart AI Estimator",
          prompt: "Guide me on how to use your interactive smart estimator tool to draft a preliminary budget.",
          icon: <Sparkles className="w-4 h-4 text-purple-500" />
        }
      ]
    }
  };

  const getSalesLang = () => {
    if (currentLanguage === "es") return salesBoard.es;
    if (currentLanguage === "en") return salesBoard.en;
    return salesBoard.pt;
  };

  const currentBoard = getSalesLang();

  // Initialize and update greeting messages dynamically based on active language
  useEffect(() => {
    setMessages([
      {
        id: "initial",
        role: "assistant",
        text: currentBoard.botGreeting,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  }, [currentLanguage]);

  // Show a gorgeous floating greeting nudge speech bubble above the icon to encourage user interaction
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowNudge(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // Handle unique ChatSession on Firestore for admin auditing
  useEffect(() => {
    if (!sessionId) {
      const activeSessionId = localStorage.getItem("anacleto_chat_session_id") || "session_" + Math.random().toString(36).substring(2);
      localStorage.setItem("anacleto_chat_session_id", activeSessionId);
      setSessionId(activeSessionId);
    }
  }, [sessionId]);

  const sendMessageText = async (textToSend: string) => {
    const txt = textToSend.trim();
    if (!txt || isLoading) return;

    // Reset nudge as conversation has actively started
    setShowNudge(false);

    const userMessage: ChatMessage = {
      id: "msg_" + Date.now(),
      role: "user",
      text: txt,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    let currentHistory: ChatMessage[] = [];
    setMessages((prev) => {
      currentHistory = [...prev, userMessage];
      return currentHistory;
    });

    setIsLoading(true);

    // Boot firestore session dynamically first
    try {
      await setDoc(
        doc(db, "chat_sessions", sessionId),
        {
          id: sessionId,
          language: currentLanguage,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: [
            {
              role: "assistant",
              text: currentBoard.botGreeting,
              timestamp: new Date().toISOString(),
            },
          ],
        },
        { merge: true }
      );
    } catch (err) {
      console.warn("Could not bootstrap chat_session merge: ", err);
    }

    // Submit user message to firestore chat audit history
    try {
      await updateDoc(doc(db, "chat_sessions", sessionId), {
        messages: arrayUnion({
          role: "user",
          text: txt,
          timestamp: new Date().toISOString(),
        }),
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn("Firestore user message logging disabled: ", err);
    }

    try {
      // Call secure server API route (Gemini API server-side bridge)
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: txt,
          language: currentLanguage,
          history: currentHistory.slice(0, -1).map((m) => ({
            role: m.role,
            text: m.text,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Não foi possível alcançar o assistente de inteligência artificial.");
      }

      const data = await response.json();
      const assistantReply = data.response;

      const botMessage: ChatMessage = {
        id: "bot_" + Date.now(),
        role: "assistant",
        text: assistantReply,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, botMessage]);

      // Sync assistant replies back to firestore logs
      try {
        await updateDoc(doc(db, "chat_sessions", sessionId), {
          messages: arrayUnion({
            role: "assistant",
            text: assistantReply,
            timestamp: new Date().toISOString(),
          }),
          updatedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.warn("Firestore assistant log error: ", err);
      }
    } catch (err: any) {
      console.error(err);
      const errMessage: ChatMessage = {
        id: "err_" + Date.now(),
        role: "assistant",
        text: currentLanguage === "es"
          ? "Disculpe, ocurrió un error de conexión con mí terminal comercial. Por favor intente una vez más."
          : currentLanguage === "en"
          ? "Apologies, I had a small connection timeout. Please re-send your message."
          : "Desculpe, meu canal de vendas demorou a responder. Por favor, envie sua pergunta novamente.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const txt = inputText.trim();
    if (!txt || isLoading) return;
    setInputText("");
    await sendMessageText(txt);
  };

  const handlePresetTrigger = (prompt: string) => {
    sendMessageText(prompt);
  };

  // Preset queries at bottom
  const presetQueries = [
    { pt: "Como funciona o agendamento?", es: "¿Cómo funciona el agendamiento?", en: "How does scheduling work?" },
    { pt: "Como solicitar medição grátis?", es: "¿Cómo agendar medición gratis?", en: "How to book free measurement?" },
    { pt: "Qual a garantia das esquadrias?", es: "¿Cuál es la garantía de los marcos?", en: "What is the warranty policy?" }
  ];

  return (
    <>
      {/* Floating Messenger Icon Button & Elegant Speech Bubble Nudge */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end">
          {showNudge && (
            <div className="mb-3 mr-2 bg-slate-900 border border-luxury-gold text-white text-xs px-3.5 py-2.5 rounded-2xl shadow-2xl max-w-[260px] animate-bounce relative flex items-center gap-2">
              <Bot className="w-4 h-4 text-luxury-gold shrink-0" />
              <p className="text-left font-medium leading-relaxed">{currentBoard.nudgeText}</p>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowNudge(false);
                }}
                className="absolute -top-1 -right-1 p-0.5 bg-slate-850 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
              <div className="absolute right-6 bottom-[-6px] w-3 h-3 bg-slate-900 border-r border-b border-luxury-gold rotate-45" />
            </div>
          )}
          
          <button
            onClick={() => {
              setIsOpen(true);
              setShowNudge(false);
            }}
            className="bg-luxury-gold hover:bg-luxury-gold-dark text-slate-950 p-4 rounded-full shadow-3xl flex items-center justify-center transition-all duration-300 transform hover:scale-110 active:scale-95 group focus:outline-hidden cursor-pointer relative"
            aria-label="Assistente comercial de inteligência artificial"
            id="chatbot-trigger-btn"
          >
            <MessageSquare className="w-6 h-6 animate-pulse group-hover:animate-none" />
            <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-500 ease-out text-xs font-bold font-sans whitespace-nowrap pl-0 group-hover:pl-2">
              Anacleto Seller
            </span>
            <span className="absolute -top-1 -right-1 bg-emerald-400 p-1 rounded-full border-2 border-white dark:border-slate-900">
              <Sparkles className="w-2.5 h-2.5 text-slate-950" />
            </span>
          </button>
        </div>
      )}

      {/* Floating Chat UI box */}
      {isOpen && (
        <div
          className="fixed bottom-6 right-6 z-50 w-full max-w-[370px] sm:max-w-[400px] h-[550px] bg-white dark:bg-slate-950 rounded-2xl shadow-3xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden transition-all duration-300 animate-in fade-in slide-in-from-bottom-5"
          id="chatbot-floating-window"
        >
          {/* Chat Header styled as a Luxury Business Vendor Interface */}
          <div className="bg-slate-950 p-4 text-white flex items-center justify-between shadow-md border-b border-luxury-gold/30">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-white/10 rounded-lg relative">
                <Bot className="w-5 h-5 text-luxury-gold" />
                <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-400 rounded-full ring-2 ring-slate-950" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-sm tracking-tight text-white">Anacleto Consultor IA</h3>
                  <span className="text-[9px] bg-luxury-gold/20 text-luxury-gold px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                    Vendas
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-medium">Online • Respostas Instantâneas</p>
              </div>
            </div>
            
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
              aria-label="Close Chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages Stream Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-900/40">
            {messages.map((msg, i) => (
              <React.Fragment key={msg.id}>
                <div
                  className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "justify-start"}`}
                >
                  {/* Avatar Icon */}
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                      msg.role === "user" ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" : "bg-white dark:bg-slate-850 text-emerald-500 border border-slate-100 dark:border-slate-800"
                    }`}
                  >
                    {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4 text-luxury-gold" />}
                  </div>

                  {/* Bubble message */}
                  <div className="space-y-0.5 max-w-[75%]">
                    <div
                      className={`p-3 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap text-left shadow-xs ${
                        msg.role === "user"
                          ? "bg-luxury-gold text-slate-950 font-black rounded-tr-none"
                          : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none border border-slate-100 dark:border-slate-850"
                      }`}
                    >
                      {msg.text}
                    </div>
                    <span className="block text-[9px] text-slate-400 font-medium px-1 pt-0.5 text-right">
                      {msg.timestamp}
                    </span>
                  </div>
                </div>

                {/* PROACTIVE SALESBOARD BOARD WITH CARDS: Shown directly inside the chat body after the greeting message */}
                {i === 0 && messages.length <= 2 && (
                  <div className="ml-9 p-3 rounded-xl border border-luxury-gold/30 bg-white dark:bg-slate-900 space-y-3.5 shadow-sm text-left animate-in fade-in duration-500">
                    {/* Exclusive Promo Header */}
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5">
                      <div className="flex items-center gap-1.5 mb-1">
                        <BadgePercent className="w-4 h-4 text-amber-500 shrink-0" />
                        <h4 className="text-xs font-bold text-amber-600 dark:text-amber-400 tracking-tight">
                          {currentBoard.promoTitle}
                        </h4>
                      </div>
                      <p className="text-[10.5px] text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                        {currentBoard.promoText}
                      </p>
                    </div>

                    <div>
                      <h4 className="text-[11px] font-bold text-slate-800 dark:text-slate-250 mb-2 leading-tight">
                        {currentBoard.ctaTitle}
                      </h4>
                      <div className="grid grid-cols-1 gap-2">
                        {currentBoard.actions.map((act, index) => (
                          <button
                            key={index}
                            onClick={() => sendMessageText(act.prompt)}
                            className="w-full p-2.5 bg-slate-50 dark:bg-slate-850 hover:bg-luxury-gold/15 hover:border-luxury-gold/50 rounded-lg border border-slate-150 dark:border-slate-800 transition text-left text-[11px] flex items-center gap-2.5 font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white cursor-pointer group"
                          >
                            <span className="bg-white dark:bg-slate-800 p-1 rounded-md shadow-xs group-hover:scale-110 transition-transform">
                              {act.icon}
                            </span>
                            <span className="flex-1 whitespace-nowrap overflow-hidden text-ellipsis">
                              {act.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </React.Fragment>
            ))}
            
            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex gap-2.5 justify-start">
                <div className="w-7 h-7 rounded-lg bg-white dark:bg-slate-850 flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-800 text-luxury-gold">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl rounded-tl-none border border-slate-100 dark:border-slate-850 shadow-xs max-w-[75%]">
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick preset queries */}
          <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-850 flex gap-1.5 overflow-x-auto no-scrollbar scroll-smooth">
            {presetQueries.map((q, idx) => {
              const query = currentLanguage === "es" ? q.es : currentLanguage === "en" ? q.en : q.pt;
              return (
                <button
                  key={idx}
                  onClick={() => handlePresetTrigger(query)}
                  className="shrink-0 text-[10px] font-semibold px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-350 hover:bg-slate-100 hover:text-luxury-gold dark:hover:text-luxury-gold rounded-full border border-slate-200 dark:border-slate-750 transition cursor-pointer whitespace-nowrap"
                >
                  {query}
                </button>
              );
            })}
          </div>

          {/* Chat Form Footer */}
          <form
            onSubmit={handleSendMessage}
            className="p-3 border-t border-slate-150 dark:border-slate-850 bg-white dark:bg-slate-950 flex gap-2 items-center"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={t.chatPlaceholder}
              className="flex-1 px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg focus:outline-hidden focus:ring-1 focus:ring-luxury-gold"
            />
            <button
              type="submit"
              disabled={isLoading || !inputText.trim()}
              className="p-2 bg-luxury-gold hover:bg-luxury-gold-dark text-slate-950 font-black rounded-lg transition disabled:opacity-50 cursor-pointer"
              aria-label="Send Message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
