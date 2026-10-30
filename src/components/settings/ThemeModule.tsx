import React, { useEffect, useState } from "react";
import {
  Palette, Check, Sun, Moon, Sparkles, RotateCcw, Save, Zap, Package,
} from "lucide-react";
import { applyTheme, loadSavedTheme, clearTheme, ThemeConfig, DEFAULT_THEME } from "../../utils/applyTheme";

interface Preset { id: string; name: string; label: string; config: ThemeConfig; }

const PRESETS: Preset[] = [
  { id: "google",   name: "Google Blue",   label: "Clásico Google",  config: { ...DEFAULT_THEME } },
  { id: "green",    name: "Google Verde",  label: "Fresco y limpio", config: { primary: "#1E8E3E", primaryDark: "#137333", primaryLight: "#E6F4EA", accent: "#FBBC04", accentLight: "#FEF7E0", bg: "#F1F8F4", radius: 8, density: "normal" } },
  { id: "amber",    name: "Google Ámbar",  label: "Cálido",          config: { primary: "#F29900", primaryDark: "#C77700", primaryLight: "#FEF7E0", accent: "#EA4335", accentLight: "#FCE8E6", bg: "#FFFBF0", radius: 10, density: "comfortable" } },
  { id: "rose",     name: "Google Rojo",   label: "Enérgico",        config: { primary: "#D93025", primaryDark: "#B3261E", primaryLight: "#FCE8E6", accent: "#4285F4", accentLight: "#E8F0FE", bg: "#FEF7F7", radius: 6, density: "normal" } },
  { id: "indigo",   name: "Indigo SaaS",   label: "Moderno SaaS",    config: { primary: "#4F46E5", primaryDark: "#4338CA", primaryLight: "#EEF2FF", accent: "#10B981", accentLight: "#D1FAE5", bg: "#F5F3FF", radius: 12, density: "normal" } },
  { id: "slate",    name: "Slate minimal", label: "Minimalista",     config: { primary: "#0F172A", primaryDark: "#020617", primaryLight: "#F1F5F9", accent: "#3B82F6", accentLight: "#DBEAFE", bg: "#F8FAFC", radius: 4, density: "compact" } },
  { id: "teal",     name: "Teal moderno",  label: "Fresco tech",     config: { primary: "#0D9488", primaryDark: "#0F766E", primaryLight: "#CCFBF1", accent: "#F59E0B", accentLight: "#FEF3C7", bg: "#F0FDFA", radius: 10, density: "normal" } },
  { id: "violet",   name: "Violeta premium", label: "Elegante",      config: { primary: "#7C3AED", primaryDark: "#6D28D9", primaryLight: "#EDE9FE", accent: "#EC4899", accentLight: "#FCE7F3", bg: "#F5F3FF", radius: 14, density: "comfortable" } },
  { id: "orange",   name: "Naranja vibrante", label: "Energético",   config: { primary: "#EA580C", primaryDark: "#C2410C", primaryLight: "#FFEDD5", accent: "#0EA5E9", accentLight: "#E0F2FE", bg: "#FFF7ED", radius: 8, density: "normal" } },
  { id: "pink",     name: "Rosa suave",    label: "Creativo",        config: { primary: "#DB2777", primaryDark: "#BE185D", primaryLight: "#FCE7F3", accent: "#8B5CF6", accentLight: "#EDE9FE", bg: "#FDF2F8", radius: 16, density: "comfortable" } },
  { id: "cyan",     name: "Cyan fresco",   label: "Innovador",       config: { primary: "#0891B2", primaryDark: "#0E7490", primaryLight: "#CFFAFE", accent: "#F59E0B", accentLight: "#FEF3C7", bg: "#ECFEFF", radius: 10, density: "normal" } },
  { id: "dark-red", name: "Rojo ejecutivo", label: "Formal",         config: { primary: "#991B1B", primaryDark: "#7F1D1D", primaryLight: "#FEE2E2", accent: "#F59E0B", accentLight: "#FEF3C7", bg: "#FEF2F2", radius: 6, density: "compact" } },
];

export default function ThemeModule() {
  const [activePreset, setActivePreset] = useState<string>("google");
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [config, setConfig] = useState<ThemeConfig>(DEFAULT_THEME);
  const [saved, setSaved] = useState(false);
  const [autoApply, setAutoApply] = useState(true);

  useEffect(() => {
    const savedPreset = localStorage.getItem("anacleto_theme_preset") || "google";
    const savedMode = (localStorage.getItem("anacleto_theme_mode") as "light" | "dark") || "light";
    setActivePreset(savedPreset);
    setMode(savedMode);
    if (savedMode === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    const t = loadSavedTheme();
    if (t) setConfig({ ...DEFAULT_THEME, ...t });
  }, []);

  // ===== AUTO-APPLY: cada cambio se aplica en vivo =====
  useEffect(() => {
    if (autoApply) applyTheme(config);
  }, [config, autoApply]);

  const update = (patch: Partial<ThemeConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
    setSaved(false);
  };

  const selectPreset = (p: Preset) => {
    setConfig({ ...DEFAULT_THEME, ...p.config });
    setActivePreset(p.id);
    setSaved(false);
    if (autoApply) applyTheme({ ...DEFAULT_THEME, ...p.config });
  };

  const save = () => {
    try {
      const normalized: ThemeConfig = { ...DEFAULT_THEME, ...config };
      applyTheme(normalized);
      try { localStorage.setItem("anacleto_theme_preset", activePreset); } catch (storageError) {
        console.warn("Não foi possível persistir a paleta neste navegador:", storageError);
      }
      setConfig(normalized);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (error) {
      console.error("Falha ao aplicar a personalização:", error);
      window.alert("Não foi possível salvar a personalização. Verifique se o navegador permite armazenamento local e tente novamente.");
    }
  };

  const reset = () => {
    clearTheme();
    setActivePreset("google");
    setConfig(DEFAULT_THEME);
    if (autoApply) applyTheme(DEFAULT_THEME);
    setSaved(false);
  };

  const toggleMode = (m: "light" | "dark") => {
    setMode(m);
    if (m === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    localStorage.setItem("anacleto_theme_mode", m);
  };

  return (
    <div className="space-y-6 pb-24">
      {/* HEADER */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Palette className="w-6 h-6 text-indigo-600" /> Aparência e Tema
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Escolha uma paleta ou personalize. As alterações são aplicadas <strong>automaticamente</strong>.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm font-bold bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer">
          <input type="checkbox" checked={autoApply} onChange={(e) => setAutoApply(e.target.checked)} className="accent-indigo-600 w-4 h-4" />
          <Zap className="w-4 h-4 text-indigo-600" /> Auto-aplicar
        </label>
      </div>

      {/* PREVIEW STICKY */}
      <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-sm flex items-center gap-2"><Sparkles className="w-4 h-4" /> Pré-visualização em tempo real</h3>
          <span className="text-[10px] font-black uppercase text-slate-400">Ao vivo</span>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <button className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700">Botão principal</button>
          <button className="px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-200">Botão secundário</button>
          <span className="text-indigo-600 font-bold text-xs">Texto principal</span>
          <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full text-[10px] font-black border border-indigo-200">ETIQUETA</span>
          <div className="bg-white border-2 border-indigo-600 rounded-lg px-2 py-1 text-[10px] font-bold text-indigo-600">Cartão ativo</div>
          <div className="bg-rose-50 text-rose-700 px-2 py-1 rounded-full text-[10px] font-black border border-rose-200">Alerta (destaque)</div>
        </div>
      </div>

      {/* PALETAS */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
        <h3 className="font-bold mb-3 flex items-center gap-2"><Package className="w-4 h-4" /> {PRESETS.length} paletas predefinidas</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => selectPreset(p)}
              className={`relative p-3 rounded-xl border-2 text-left transition ${
                activePreset === p.id
                  ? "border-slate-900 dark:border-white shadow-lg scale-[1.02]"
                  : "border-slate-200 dark:border-slate-700 hover:border-slate-400"
              }`}
            >
              {activePreset === p.id && (
                <span className="absolute top-1.5 right-1.5 bg-slate-900 text-white rounded-full p-0.5">
                  <Check className="w-2.5 h-2.5" />
                </span>
              )}
              <div className="flex gap-1 mb-1.5">
                <span className="w-5 h-5 rounded-full border border-white shadow" style={{ background: p.config.primary }} />
                <span className="w-5 h-5 rounded-full border border-white shadow" style={{ background: p.config.accent }} />
                <span className="w-5 h-5 rounded-full border" style={{ background: p.config.bg }} />
              </div>
              <div className="font-bold text-slate-900 dark:text-white text-xs leading-tight">{p.name}</div>
              <div className="text-[10px] text-slate-500">{p.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* CUSTOM COLORS */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
        <h3 className="font-bold mb-4">Personalização avançada</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <ColorField label="Primário" value={config.primary} onChange={(v) => update({ primary: v })} />
          <ColorField label="Escuro (hover)" value={config.primaryDark} onChange={(v) => update({ primaryDark: v })} />
          <ColorField label="Claro (badges)" value={config.primaryLight} onChange={(v) => update({ primaryLight: v })} />
          <ColorField label="Acento (alertas)" value={config.accent} onChange={(v) => update({ accent: v })} />
          <ColorField label="Acento claro" value={config.accentLight} onChange={(v) => update({ accentLight: v })} />
          <ColorField label="Fundo da área" value={config.bg} onChange={(v) => update({ bg: v })} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Raio dos cantos: {config.radius}px</label>
            <input type="range" min={0} max={20} step={1} value={config.radius} onChange={(e) => update({ radius: Number(e.target.value) })} className="w-full mt-1 accent-indigo-600" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Densidade</label>
            <div className="flex gap-1 mt-1">
              {(["compact", "normal", "comfortable"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => update({ density: d })}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold border ${
                    config.density === d ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {d === "compact" ? "Compacta" : d === "normal" ? "Normal" : "Cômoda"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* MODO */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
        <h3 className="font-bold mb-3">Modo de exibição</h3>
        <div className="flex gap-2">
          <button onClick={() => toggleMode("light")} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-bold text-sm ${mode === "light" ? "border-slate-900 bg-slate-50 text-slate-900" : "border-slate-200 text-slate-500"}`}>
            <Sun className="w-4 h-4" /> Claro
          </button>
          <button onClick={() => toggleMode("dark")} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-bold text-sm ${mode === "dark" ? "border-white bg-slate-800 text-white" : "border-slate-200 text-slate-500"}`}>
            <Moon className="w-4 h-4" /> Escuro
          </button>
        </div>
      </div>

      {/* BARRA DE ACCIONES FIJA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-950/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 p-3 z-20">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          <button onClick={reset} className="flex items-center gap-1 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-bold hover:bg-slate-200">
            <RotateCcw className="w-4 h-4" /> Restaurar padrão
          </button>
          <button onClick={save} className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-black transition ${saved ? "bg-emerald-600 text-white" : "bg-indigo-600 text-white hover:bg-indigo-700"}`}>
            {saved ? <><Check className="w-4 h-4" /> Tema salvo!</> : <><Save className="w-4 h-4" /> Salvar tema</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-bold text-slate-500 uppercase">{label}</label>
      <div className="flex gap-2 items-center mt-1">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-10 h-10 rounded-lg cursor-pointer border border-slate-200" />
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="flex-1 px-2 py-1.5 text-xs font-mono border border-slate-200 rounded-lg" />
      </div>
    </div>
  );
}
