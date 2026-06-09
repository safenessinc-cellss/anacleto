import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, Sparkles, Sliders, ShieldCheck } from "lucide-react";

interface WindowBuilderLoaderProps {
  currentLanguage: string;
  onFinish: () => void;
}

const LOADER_TRANSLATIONS: Record<string, {
  brand: string;
  subtitle: string;
  steps: string[];
  complete: string;
}> = {
  pt: {
    brand: "ANACLETO",
    subtitle: "ESQUADRIAS DE LUXO & VIDROS",
    steps: [
      "Extrudando perfis de alumínio premium Suprema/Gold...",
      "Formatando vidros lapidados de alta performance...",
      "Aplicando borrachas de vedação acústica EPDM...",
      "Instalando puxadores de luxo e ferragens de inox...",
      "Ajustando calibragem a laser e polimento final..."
    ],
    complete: "CONCLUÍDO COM SUCESSO!"
  },
  es: {
    brand: "ANACLETO",
    subtitle: "ABERTURAS DE LUJO Y CRISTALES",
    steps: [
      "Extruyendo perfiles de aluminio premium Suprema/Gold...",
      "Construyendo paneles térmicos con vidrios templados...",
      "Colocando sellos elásticos y gomas acústicas EPDM...",
      "Instalando cerraduras y jaladores de lujo a medida...",
      "Ajustando calibración láser y pulido final de lujo..."
    ],
    complete: "¡CONCLUIDO CON ÉXITO!"
  },
  en: {
    brand: "ANACLETO",
    subtitle: "LUXURY FRAMEWORKS & GLAZING",
    steps: [
      "Extruding premium aluminum high-grade profiles...",
      "Tempering high-durability thermal crystal glass...",
      "Installing elite sound insulation EPDM gaskets...",
      "Assembling stainless luxury gold pull bars and locks...",
      "Running final precise laser inspection & alignment..."
    ],
    complete: "SUCCESSFULLY COMPLETED!"
  }
};

export default function WindowBuilderLoader({ currentLanguage, onFinish }: WindowBuilderLoaderProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  // Get localized strings
  const langKey = LOADER_TRANSLATIONS[currentLanguage] ? currentLanguage : "pt";
  const localized = LOADER_TRANSLATIONS[langKey];

  // Manage steps sequence & progress simulation
  useEffect(() => {
    const totalDuration = 4500; // 4.5 seconds for premium storytelling
    const updateInterval = 50;
    const increment = (100 / (totalDuration / updateInterval));

    const progressTimer = setInterval(() => {
      setProgress((prev) => {
        const next = prev + increment;
        if (next >= 100) {
          clearInterval(progressTimer);
          return 100;
        }
        return next;
      });
    }, updateInterval);

    // Timeline steps timing
    const stepInterval = totalDuration / localized.steps.length;
    const stepTimer = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < localized.steps.length - 1) {
          return prev + 1;
        }
        clearInterval(stepTimer);
        return prev;
      });
    }, stepInterval);

    // End timer
    const finishTimer = setTimeout(() => {
      onFinish();
    }, totalDuration + 500);

    return () => {
      clearInterval(progressTimer);
      clearInterval(stepTimer);
      clearTimeout(finishTimer);
    };
  }, [localized, onFinish]);

  // SVG parameters for window animation
  // Main frame outline, inner split lines, glass pane overlays
  const stepExtrude = currentStep >= 0;
  const stepGlass = currentStep >= 1;
  const stepSeals = currentStep >= 2;
  const stepHandle = currentStep >= 3;
  const stepLaser = currentStep >= 4;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-white overflow-hidden font-sans select-none">
      {/* Background radial soft light flares */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-luxury-gold/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-[300px] h-[300px] bg-amber-500/5 rounded-full blur-[90px] pointer-events-none" />

      <div className="w-full max-w-md px-6 text-center z-10 flex flex-col items-center">
        
        {/* Elite Brand Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-8"
        >
          <h2 className="text-3xl font-black tracking-[0.25em] text-white font-sans flex items-center justify-center gap-2">
            {localized.brand}
            <span className="text-luxury-gold text-2xl font-normal">.</span>
          </h2>
          <p className="text-[10px] tracking-[0.3em] text-luxury-gold/80 font-bold uppercase mt-1">
            {localized.subtitle}
          </p>
        </motion.div>

        {/* Dynamic 3D-Like Glass & Aluminum Window Blueprint Construction Canvas */}
        <div className="relative w-64 h-64 bg-slate-900/30 border border-slate-800/50 rounded-2xl p-4 flex items-center justify-center shadow-2xl backdrop-blur-md mb-8 overflow-hidden group">
          
          {/* Subtle blueprint background grid lines */}
          <div className="absolute inset-0 grid grid-cols-6 grid-rows-6 opacity-30 pointer-events-none">
            {Array.from({ length: 36 }).map((_, i) => (
              <div key={i} className="border-[0.5px] border-slate-800/40" />
            ))}
          </div>

          {/* SVG Frame Builder Engine */}
          <svg className="w-48 h-48 drop-shadow-lg overflow-visible" viewBox="0 0 200 200" fill="none">
            
            {/* Step 1: Aluminum Frame Frame extrusion drawing */}
            <AnimatePresence>
              {stepExtrude && (
                <motion.rect
                  x="10"
                  y="10"
                  width="180"
                  height="180"
                  rx="6"
                  stroke="#d4af37" // Luxury Gold Color
                  strokeWidth="6"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 1.5, ease: "easeInOut" }}
                />
              )}
            </AnimatePresence>

            {/* Inner vertical separator profile bar */}
            <AnimatePresence>
              {stepExtrude && (
                <motion.line
                  x1="100"
                  y1="10"
                  x2="100"
                  y2="190"
                  stroke="#d4af37"
                  strokeWidth="6"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ delay: 0.4, duration: 1 }}
                />
              )}
            </AnimatePresence>

            {/* Step 2: Glass Panel inserts loaded with glint reflections */}
            <AnimatePresence>
              {stepGlass && (
                <>
                  {/* Left glass panel with backdrop blur effect simulating heavy glass */}
                  <motion.rect
                    x="16"
                    y="16"
                    width="81"
                    height="168"
                    fill="rgba(14, 165, 233, 0.15)"
                    stroke="rgba(14, 165, 233, 0.4)"
                    strokeWidth="1.5"
                    initial={{ scaleY: 0, opacity: 0 }}
                    animate={{ scaleY: 1, opacity: 1 }}
                    transition={{ duration: 1, ease: "backOut" }}
                  />

                  {/* Right glass panel */}
                  <motion.rect
                    x="103"
                    y="16"
                    width="81"
                    height="168"
                    fill="rgba(14, 165, 233, 0.15)"
                    stroke="rgba(14, 165, 233, 0.4)"
                    strokeWidth="1.5"
                    initial={{ scaleY: 0, opacity: 0 }}
                    animate={{ scaleY: 1, opacity: 1 }}
                    transition={{ delay: 0.2, duration: 1, ease: "backOut" }}
                  />

                  {/* Refraction gloss lines (shining across left & right) */}
                  <motion.path
                    d="M 20 170 L 80 50 M 110 170 L 170 50"
                    stroke="rgba(255, 255, 255, 0.3)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ delay: 0.5, duration: 1.2, repeat: Infinity, repeatDelay: 1 }}
                  />
                </>
              )}
            </AnimatePresence>

            {/* Step 3: Acoustic EPDM Gasket seals */}
            <AnimatePresence>
              {stepSeals && (
                <motion.rect
                  x="13"
                  y="13"
                  width="174"
                  height="174"
                  stroke="#1e293b" // Slate grey EPDM rubber seals
                  strokeWidth="2.5"
                  strokeDasharray="4 4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5 }}
                />
              )}
            </AnimatePresence>

            {/* Step 4: Handles and Accessories placement */}
            <AnimatePresence>
              {stepHandle && (
                <>
                  {/* Left frame handle - gold sleek anodized sliding handle */}
                  <motion.rect
                    x="86"
                    y="80"
                    width="6"
                    height="40"
                    rx="3"
                    fill="#ffffff"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 100 }}
                  />
                  {/* Right frame pull bar close attachment */}
                  <motion.rect
                    x="108"
                    y="80"
                    width="6"
                    height="40"
                    rx="3"
                    fill="#d4af37"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2, type: "spring", stiffness: 100 }}
                  />
                </>
              )}
            </AnimatePresence>

            {/* Step 5: Horizontal Red/Gold Precise Laser Line checking calibration */}
            <AnimatePresence>
              {stepLaser && (
                <motion.line
                  x1="5"
                  y1="10"
                  x2="195"
                  y2="10"
                  stroke="#fbbf24"
                  strokeWidth="3.5"
                  style={{ filter: "drop-shadow(0px 0px 8px rgba(251, 191, 36, 0.9))" }}
                  animate={{
                    y1: [10, 180, 10],
                    y2: [10, 180, 10],
                  }}
                  transition={{
                    duration: 2.2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
              )}
            </AnimatePresence>
          </svg>

          {/* Sparkly corner indicators */}
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-slate-950/80 px-2 py-0.5 rounded-md border border-slate-800 text-[8px] font-mono font-bold tracking-widest text-slate-400">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            ANACLETO_GOLD_V1
          </div>
        </div>

        {/* Interactive Progress Indicators and Storytelling Log */}
        <div className="w-full space-y-4">
          <div className="min-h-[40px] flex flex-col justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="flex items-center justify-center gap-2"
              >
                {currentStep === 4 ? (
                  <Sparkles className="w-4 h-4 text-luxury-gold animate-spin" />
                ) : (
                  <Sliders className="w-4 h-4 text-emerald-400 animate-pulse" />
                )}
                <p className="text-xs font-bold font-sans tracking-wide text-slate-200">
                  {localized.steps[currentStep]}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Premium gold progress bar */}
          <div className="relative">
            <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-amber-500 via-luxury-gold to-yellow-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            
            {/* Soft percentage indicator */}
            <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 font-bold uppercase tracking-widest mt-2 px-1">
              <span>status: {Math.round(progress)}%</span>
              <span className="flex items-center gap-1 text-luxury-gold">
                <ShieldCheck className="w-3 h-3 text-luxury-gold" />
                precision certified
              </span>
            </div>
          </div>
        </div>

        {/* Soft company tagline bottom details */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          transition={{ delay: 1, duration: 1 }}
          className="mt-12 text-[9px] text-slate-500 tracking-widest uppercase"
        >
          © 2026 ANACLETO • premium opening systems
        </motion.div>

      </div>
    </div>
  );
}
