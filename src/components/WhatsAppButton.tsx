import React, { useState, useEffect } from "react";
import { MessageCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface WhatsAppButtonProps {
  currentLanguage: string;
}

const WHATSAPP_NUMBER = "5551998193931";

const LOCALIZED_MESSAGES: Record<string, string> = {
  pt: "Olá! Gostaria de falar com o atendimento da Anacleto Esquadrias para solicitar um orçamento.",
  es: "¡Hola! Me gustaría conversar con el servicio de atención de Anacleto Esquadrias para solicitar un presupuesto.",
  en: "Hello! I would like to chat with Anacleto Esquadrias support to request a custom quote.",
  fr: "Bonjour ! Je souhaite contacter le service client de Anacleto Esquadrias pour demander un devis.",
  de: "Hallo! Ich würde mich gerne an den Support von Anacleto Esquadrias wenden, um ein Angebot anzufordern.",
  it: "Ciao! Vorrei parlare con il servizio clienti di Anacleto Esquadrias per richiedere un preventivo.",
  zh: "您好！我想与 Anacleto Esquadrias 客服沟通以获取定制设计报价。",
  ja: "こんにちは！オーダーメイドの御見積に関して Anacleto Esquadrias のサポート窓口に問い合わせたいです。",
  ru: "Здравствуйте! Я хотел бы связаться со службой поддержки Anacleto Esquadrias, чтобы получить расчет стоимости.",
  ar: "مرحباً! أود التحدث مع خدمة عملاء Anacleto Esquadrias لطلب تقدير سعر مخصص."
};

const BUTTON_LABELS: Record<string, string> = {
  pt: "Atendimento WhatsApp",
  es: "Contacto WhatsApp",
  en: "WhatsApp Support",
  fr: "Support WhatsApp",
  de: "WhatsApp Kontakt",
  it: "Contatto WhatsApp",
  zh: "WhatsApp 咨询",
  ja: "WhatsApp 窓口",
  ru: "Поддержка WhatsApp",
  ar: "الدعم عبر واتساب"
};

export default function WhatsAppButton({ currentLanguage }: WhatsAppButtonProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    // Show a small animated helper tooltip after a short delay
    const timer = setTimeout(() => {
      setShowTooltip(true);
    }, 6000);
    return () => clearTimeout(timer);
  }, []);

  const languageKey = LOCALIZED_MESSAGES[currentLanguage] ? currentLanguage : "pt";
  const rawMessage = LOCALIZED_MESSAGES[languageKey];
  const encodedText = encodeURIComponent(rawMessage);
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedText}`;
  const label = BUTTON_LABELS[languageKey] || BUTTON_LABELS.pt;

  return (
    <div className="fixed bottom-24 right-6 z-40 flex flex-col items-end print:hidden">
      {/* Dynamic Hover / Dynamic Timer Tooltip */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.8, x: 20 }}
            className="mb-2 mr-1 bg-white dark:bg-slate-900 border border-emerald-500/30 text-slate-800 dark:text-slate-100 text-[11px] font-bold px-3 py-2 rounded-xl shadow-2xl relative flex items-center gap-2 max-w-[200px]"
          >
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping shrink-0" />
            <p className="leading-tight text-left">{label}</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowTooltip(false);
              }}
              className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white transition cursor-pointer font-black text-xs"
              aria-label="Remove tooltip"
            >
              ×
            </button>
            {/* Tooltip speech arrow */}
            <div className="absolute right-5 bottom-[-5px] w-2.5 h-2.5 bg-white dark:bg-slate-900 border-r border-b border-emerald-500/30 rotate-45" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Circle Button */}
      <motion.a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={() => setShowTooltip(true)}
        whileHover={{ scale: 1.1, translateY: -2 }}
        whileTap={{ scale: 0.95 }}
        className="bg-emerald-500 hover:bg-emerald-600 text-white p-3.5 rounded-full shadow-3xl flex items-center justify-center transition-all duration-300 relative group cursor-pointer border border-emerald-400/20"
        aria-label={label}
        id="whatsapp-floating-btn"
      >
        <MessageCircle className="w-6 h-6 animate-pulse group-hover:animate-none fill-white/10" />
        
        {/* Slidout Label on Hover for desktop/tablet screens */}
        <span className="max-w-0 overflow-hidden group-hover:max-w-[180px] transition-all duration-500 ease-out text-xs font-bold font-sans whitespace-nowrap pl-0 group-hover:pl-2.5">
          {label}
        </span>

        {/* Pulse circular effect behind */}
        <span className="absolute inset-0 rounded-full bg-emerald-400 opacity-20 animate-ping group-hover:animate-none -z-10" />
      </motion.a>
    </div>
  );
}
