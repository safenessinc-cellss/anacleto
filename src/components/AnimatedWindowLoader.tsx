import React, { useState, useEffect } from "react";

interface AnimatedWindowLoaderProps {
  onFinish: () => void;
  currentLanguage: string;
}

export default function AnimatedWindowLoader({ onFinish, currentLanguage }: AnimatedWindowLoaderProps) {
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [showGlass, setShowGlass] = useState(false);
  const [showHandle, setShowHandle] = useState(false);
  const [showScrews, setShowScrews] = useState(false);

  const texts = {
    pt: ["CORTANDO PERFIS", "MONTANDO ESTRUTURA", "INSERINDO VIDRO", "INSTALANDO HERRAJES", "FINALIZANDO...", "PRONTO!"],
    es: ["CORTANDO PERFILES", "MONTANDO ESTRUCTURA", "INSERTANDO VIDRIO", "INSTALANDO HERRAJES", "FINALIZANDO...", "¡LISTO!"],
    en: ["CUTTING PROFILES", "ASSEMBLING STRUCTURE", "INSERTING GLASS", "INSTALLING HARDWARE", "FINALIZING...", "READY!"]
  };

  const currentTexts = texts[currentLanguage as keyof typeof texts] || texts.pt;

  useEffect(() => {
    const steps = [2000, 2500, 2500, 2000, 1500, 500];
    let currentStep = 0;

    const runSteps = () => {
      if (currentStep < steps.length) {
        setTimeout(() => {
          setStep(currentStep);
          setProgress(((currentStep + 1) / steps.length) * 100);
          
          if (currentStep >= 1) setShowScrews(true);
          if (currentStep >= 2) setShowGlass(true);
          if (currentStep >= 3) setShowHandle(true);
          
          currentStep++;
          runSteps();
        }, steps[currentStep]);
      } else {
        setTimeout(() => onFinish(), 500);
      }
    };

    runSteps();
  }, [onFinish]);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-black via-slate-900 to-black z-50 flex flex-col items-center justify-center">
      <div className="text-center space-y-8 max-w-md px-6">
        
        {/* Título en dorado */}
        <div className="space-y-2">
          <h1 className="text-3xl font-black tracking-[0.3em] text-white uppercase">
            ANACLETO
          </h1>
          <p className="text-xs text-luxury-gold tracking-[0.2em] font-medium uppercase">
            ESQUADRIAS DE ALUMÍNIO
          </p>
        </div>

        {/* VENTANA ANIMADA NEGRA CON DORADO */}
        <div className="relative w-64 h-72 mx-auto bg-black rounded-xl shadow-2xl shadow-luxury-gold/20 border-2 border-luxury-gold/50 overflow-hidden">
          
          {/* Marco exterior dorado */}
          <div className="absolute inset-2 border-4 border-luxury-gold/60 rounded-lg bg-black">
            
            {/* Perfiles internos dorados - aparecen en paso 1 */}
            <div className={`absolute top-1/2 left-0 w-full h-3 bg-gradient-to-b from-luxury-gold to-amber-600 transform -translate-y-1/2 transition-all duration-700 ${step >= 1 ? 'opacity-100' : 'opacity-0'}`}></div>
            <div className={`absolute left-1/2 top-0 w-3 h-full bg-gradient-to-r from-luxury-gold to-amber-600 transform -translate-x-1/2 transition-all duration-700 ${step >= 1 ? 'opacity-100' : 'opacity-0'}`}></div>
            
            {/* Vidrio premium con reflejo dorado - aparece en paso 2 */}
            <div className={`absolute inset-[18px] transition-all duration-1000 ${showGlass ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
              <div className="w-full h-full bg-gradient-to-br from-amber-400/10 to-luxury-gold/20 rounded-md backdrop-blur-sm border border-luxury-gold/40 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1/2 h-full bg-gradient-to-r from-luxury-gold/30 to-transparent transform skew-x-[-20deg]"></div>
                <div className="absolute bottom-0 right-0 w-1/3 h-1/2 bg-gradient-to-tl from-luxury-gold/15 to-transparent"></div>
              </div>
            </div>
            
            {/* Tornillos dorados - aparecen en paso 1 */}
            {showScrews && (
              <>
                <div className="absolute top-6 left-6 w-2.5 h-2.5 rounded-full bg-luxury-gold shadow-md animate-pulse shadow-luxury-gold/70"></div>
                <div className="absolute top-6 right-6 w-2.5 h-2.5 rounded-full bg-luxury-gold shadow-md animate-pulse shadow-luxury-gold/70"></div>
                <div className="absolute bottom-6 left-6 w-2.5 h-2.5 rounded-full bg-luxury-gold shadow-md animate-pulse shadow-luxury-gold/70"></div>
                <div className="absolute bottom-6 right-6 w-2.5 h-2.5 rounded-full bg-luxury-gold shadow-md animate-pulse shadow-luxury-gold/70"></div>
                <div className="absolute top-1/2 left-6 w-2.5 h-2.5 rounded-full bg-luxury-gold shadow-md animate-pulse shadow-luxury-gold/70"></div>
                <div className="absolute top-1/2 right-6 w-2.5 h-2.5 rounded-full bg-luxury-gold shadow-md animate-pulse shadow-luxury-gold/70"></div>
              </>
            )}
            
            {/* Manija dorada - aparece en paso 3 */}
            {showHandle && (
              <div className="absolute right-8 top-1/2 transform -translate-y-1/2 animate-slide-in">
                <div className="w-10 h-3.5 bg-gradient-to-r from-luxury-gold to-amber-500 rounded-full shadow-md shadow-luxury-gold/50"></div>
                <div className="w-2.5 h-7 bg-gradient-to-b from-luxury-gold to-amber-600 rounded-full mx-auto mt-1 shadow-sm"></div>
              </div>
            )}
          </div>
          
          {/* Brillo animado dorado */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-luxury-gold/10 to-transparent -translate-x-full animate-shimmer"></div>
          </div>
        </div>

        {/* Estado actual - Dorado */}
        <div className="space-y-3">
          <div className="px-4 py-2 bg-luxury-gold/10 border border-luxury-gold/30 rounded-full inline-block mx-auto backdrop-blur-sm">
            <p className="text-luxury-gold text-xs font-black tracking-wider animate-pulse">
              {currentTexts[step]}
            </p>
          </div>
          
          {/* Barra de progreso dorada */}
          <div className="w-full max-w-xs mx-auto">
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-luxury-gold to-amber-500 h-full transition-all duration-500 ease-out rounded-full relative"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full shadow-lg"></div>
              </div>
            </div>
            <p className="text-luxury-gold/70 text-[10px] font-mono mt-2">
              {Math.floor(progress)}% completado
            </p>
          </div>
        </div>

        <p className="text-slate-500 text-[9px] font-mono flex items-center gap-1 justify-center">
          <span className="inline-block w-1.5 h-1.5 bg-luxury-gold rounded-full animate-pulse"></span>
          Fabricación premium
        </p>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes slide-in {
          from { opacity: 0; transform: translateX(80px) translateY(-50%); }
          to { opacity: 1; transform: translateX(0) translateY(-50%); }
        }
        .animate-shimmer {
          animation: shimmer 1.5s infinite;
        }
        .animate-slide-in {
          animation: slide-in 0.4s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
