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
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 z-50 flex flex-col items-center justify-center">
      <div className="text-center space-y-8 max-w-md px-6">
        
        {/* Título */}
        <div className="space-y-2">
          <h1 className="text-3xl font-black tracking-[0.3em] text-white uppercase">
            ANACLETO
          </h1>
          <p className="text-xs text-amber-400 tracking-[0.2em] font-medium uppercase">
            ESQUADRIAS DE ALUMÍNIO
          </p>
        </div>

        {/* VENTANA ANIMADA */}
        <div className="relative w-64 h-72 mx-auto bg-slate-800 rounded-xl shadow-2xl shadow-black/50 border-2 border-slate-600 overflow-hidden">
          
          {/* Marco exterior */}
          <div className="absolute inset-2 border-4 border-slate-500 rounded-lg bg-slate-900">
            
            {/* Perfiles internos - aparecen en paso 1 */}
            <div className={`absolute top-1/2 left-0 w-full h-3 bg-gradient-to-b from-slate-400 to-slate-500 transform -translate-y-1/2 transition-all duration-700 ${step >= 1 ? 'opacity-100' : 'opacity-0'}`}></div>
            <div className={`absolute left-1/2 top-0 w-3 h-full bg-gradient-to-r from-slate-400 to-slate-500 transform -translate-x-1/2 transition-all duration-700 ${step >= 1 ? 'opacity-100' : 'opacity-0'}`}></div>
            
            {/* Vidrio - aparece en paso 2 */}
            <div className={`absolute inset-[18px] transition-all duration-1000 ${showGlass ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
              <div className="w-full h-full bg-gradient-to-br from-cyan-400/20 to-blue-500/30 rounded-md backdrop-blur-sm border border-white/20 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1/2 h-full bg-gradient-to-r from-white/30 to-transparent transform skew-x-[-20deg]"></div>
                <div className="absolute bottom-0 right-0 w-1/3 h-1/2 bg-gradient-to-tl from-white/10 to-transparent"></div>
              </div>
            </div>
            
            {/* Tornillos - aparecen en paso 1 */}
            {showScrews && (
              <>
                <div className="absolute top-6 left-6 w-2.5 h-2.5 rounded-full bg-amber-500 shadow-md animate-pulse shadow-amber-500/50"></div>
                <div className="absolute top-6 right-6 w-2.5 h-2.5 rounded-full bg-amber-500 shadow-md animate-pulse shadow-amber-500/50"></div>
                <div className="absolute bottom-6 left-6 w-2.5 h-2.5 rounded-full bg-amber-500 shadow-md animate-pulse shadow-amber-500/50"></div>
                <div className="absolute bottom-6 right-6 w-2.5 h-2.5 rounded-full bg-amber-500 shadow-md animate-pulse shadow-amber-500/50"></div>
                <div className="absolute top-1/2 left-6 w-2.5 h-2.5 rounded-full bg-amber-500 shadow-md animate-pulse shadow-amber-500/50"></div>
                <div className="absolute top-1/2 right-6 w-2.5 h-2.5 rounded-full bg-amber-500 shadow-md animate-pulse shadow-amber-500/50"></div>
              </>
            )}
            
            {/* Manija - aparece en paso 3 */}
            {showHandle && (
              <div className="absolute right-8 top-1/2 transform -translate-y-1/2 animate-slide-in">
                <div className="w-10 h-3.5 bg-gradient-to-r from-slate-300 to-slate-400 rounded-full shadow-md"></div>
                <div className="w-2.5 h-7 bg-gradient-to-b from-slate-400 to-slate-500 rounded-full mx-auto mt-1 shadow-sm"></div>
              </div>
            )}
          </div>
          
          {/* Brillo animado */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent -translate-x-full animate-shimmer"></div>
          </div>
        </div>

        {/* Estado actual */}
        <div className="space-y-3">
          <div className="px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-full inline-block mx-auto backdrop-blur-sm">
            <p className="text-amber-400 text-xs font-black tracking-wider animate-pulse">
              {currentTexts[step]}
            </p>
          </div>
          
          {/* Barra de progreso */}
          <div className="w-full max-w-xs mx-auto">
            <div className="w-full bg-slate-700 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-amber-500 to-amber-400 h-full transition-all duration-500 ease-out rounded-full relative"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full shadow-lg"></div>
              </div>
            </div>
            <p className="text-slate-400 text-[10px] font-mono mt-2">
              {Math.floor(progress)}% completado
            </p>
          </div>
        </div>

        <p className="text-slate-500 text-[9px] font-mono flex items-center gap-1 justify-center">
          <span className="inline-block w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></span>
          Fabricación inteligente
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
