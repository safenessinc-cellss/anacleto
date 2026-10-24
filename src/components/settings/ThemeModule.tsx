import React, { useEffect, useState } from "react";
import { Palette, Check, Sun, Moon, Sparkles, RotateCcw } from "lucide-react";
import { applyTheme, loadSavedTheme, clearTheme, ThemeConfig } from "../../utils/applyTheme";

const PRESETS: Array<{ id: string; name: string; label: string; config: ThemeConfig }> = [
  { id: "google", name: "Google Blue", label: "Clásico Google", config: { primary: "#1A73E8", primaryDark: "#1557B0", primaryLight: "#E8F0FE", accent: "#EA4335", bg: "#F8F9FA" } },
  { id: "green", name: "Google Verde", label: "Fresco y limpio", config: { primary: "#1E8E3E", primaryDark: "#137333", primaryLight: "#E6F4EA", accent: "#FBBC04", bg: "#F1F8F4" } },
  { id: "amber", name: "Google Ámbar", label: "Cálido", config: { primary: "#F29900", primaryDark: "#C77700", primaryLight: "#FEF7E0", accent: "#EA4335", bg: "#FFFBF0" } },
  { id: "rose", name: "Google Rojo", label: "Enérgico", config: { primary: "#D93025", primaryDark: "#B3261E", primaryLight: "#FCE8E6", accent: "#4285F4", bg: "#FEF7F7" } },
  { id: "indigo", name: "Indigo SaaS", label: "Moderno SaaS", config: { primary: "#4F46E5", primaryDark: "#4338CA", primaryLight: "#EEF2FF", accent: "#10B981", bg: "#F5F3FF" } },
  { id: "slate", name: "Slate minimal", label: "Minimalista", config: { primary: "#0F172A", primaryDark: "#020617", primaryLight: "#F1F5F9", accent: "#3B82F6", bg: "#F8FAFC" } },
];

export default function ThemeModule() {
  const [activePreset, setActivePreset] = useState<string>("google");
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [customPrimary, setCustomPrimary] = useState("#1A73E8");
  const [customPrimaryDark, setCustomPrimaryDark] = useState("#1557B0");
  const [customPrimaryLight, setCustomPrimaryLight] = useState("#E8F0FE");

  useEffect(() => {
    const savedPreset = localStorage.getItem("anacleto_theme_preset") || "google";
    const savedMode = (localStorage.getItem("anacleto_theme_mode") as "light" | "dark") || "light";
    setActivePreset(savedPreset);
    setMode(savedMode);
    if (savedMode === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    const t = loadSavedTheme();
    if (t) {
      setCustomPrimary(t.primary);
      setCustomPrimaryDark(t.primaryDark);
      setCustomPrimaryLight(t.primaryLight);
    }
  }, []);

  const selectPreset = (id: string) => {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setActivePreset(id);
    setCustomPrimary(preset.config.primary);
    setCustomPrimaryDark(preset.config.primaryDark);
    setCustomPrimaryLight(preset.config.primaryLight);
    applyTheme(preset.config);
    localStorage.setItem("anacleto_theme_preset", id);
  };

  const applyCustom = () => {
    const config: ThemeConfig = {
      primary: customPrimary,
      primaryDark: customPrimaryDark,
      primaryLight: customPrimaryLight,
      accent: "#EA4335",
      bg: "#F8F9FA",
    };
    applyTheme(config);
    setActivePreset("custom");
    localStorage.setItem("anacleto_theme_preset", "custom");
  };

  const reset = () => {
    clearTheme();
    setActivePreset("google");
    selectPreset("google");
  };

  const toggleMode = (m: "light" | "dark") => {
    setMode(m);
    if (m === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    localStorage.setItem("anacleto_theme_mode", m);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
          <Palette className="w-6 h-6 text-indigo-600" /> Aparência e Tema
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Personalize as cores da área de trabalho. As mudanças aplicam-se <strong>imediatamente</strong> em todos os botões, links e ícones principais.
        </p>
      </div>

      {/* PREVIEW: para você ver o resultado na hora */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
        <h3 className="font-bold mb-4 flex items-center gap-2"><Sparkles className="w-4 h-4" /> Pré-visualização</h3>
        <div className="flex flex-wrap gap-3 items-center">
          <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700">Botão primário</button>
          <span className="text-indigo-600 font-bold text-sm">Texto primário</span>
          <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold border border-indigo-200">Badge</span>
          <div className="border-2 border-indigo-600 rounded-lg px-3 py-1 text-xs font-bold text-indigo-600">Card</div>
        </div>
        <p className="text-xs text-slate-400 mt-3">Se as cores acima não mudarem ao escolher uma paleta, o tema não foi aplicado.</p>
      </div>

      {/* PALETAS */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
        <h3 className="font-bold mb-4 flex items-center gap-2"><Sparkles className="w-4 h-4" /> Paletas predefinidas</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => selectPreset(p.id)}
              className={`relative p-4 rounded-xl border-2 text-left transition ${
                activePreset === p.id
                  ? "border-slate-900 dark:border-white shadow-lg scale-[1.02]"
                  : "border-slate-200 dark:border-slate-700 hover:border-slate-400"
              }`}
            >
              {activePreset === p.id && (
                <span className="absolute top-2 right-2 bg-slate-900 text-white rounded-full p-1">
                  <Check className="w-3 h-3" />
                </span>
              )}
              <div className="flex gap-1.5 mb-2">
                <span className="w-6 h-6 rounded-full border border-white shadow" style={{ background: p.config.primary }} />
                <span className="w-6 h-6 rounded-full border border-white shadow" style={{ background: p.config.accent }} />
                <span className="w-6 h-6 rounded-full border" style={{ background: p.config.bg }} />
              </div>
              <div className="font-bold text-slate-900 dark:text-white text-sm">{p.name}</div>
              <div className="text-xs text-slate-500">{p.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* CUSTOM */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
        <h3 className="font-bold mb-4">Cor personalizada</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Primário</label>
            <div className="flex gap-2 items-center mt-1">
              <input type="color" value={customPrimary} onChange={(e) => setCustomPrimary(e.target.value)} className="w-12 h-12 rounded-lg cursor-pointer border" />
              <span className="font-mono text-xs">{customPrimary}</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Escuro (hover)</label>
            <div className="flex gap-2 items-center mt-1">
              <input type="color" value={customPrimaryDark} onChange={(e) => setCustomPrimaryDark(e.target.value)} className="w-12 h-12 rounded-lg cursor-pointer border" />
              <span className="font-mono text-xs">{customPrimaryDark}</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Claro (badges)</label>
            <div className="flex gap-2 items-center mt-1">
              <input type="color" value={customPrimaryLight} onChange={(e) => setCustomPrimaryLight(e.target.value)} className="w-12 h-12 rounded-lg cursor-pointer border" />
              <span className="font-mono text-xs">{customPrimaryLight}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={applyCustom} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700">
            Aplicar cor personalizada
          </button>
          <button onClick={reset} className="flex items-center gap-1 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-bold hover:bg-slate-200">
            <RotateCcw className="w-4 h-4" /> Restaurar padrão
          </button>
        </div>
      </div>

      {/* MODO */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
        <h3 className="font-bold mb-4">Modo de exibição</h3>
        <div className="flex gap-2">
          <button onClick={() => toggleMode("light")} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-bold text-sm ${mode === "light" ? "border-slate-900 bg-slate-50 text-slate-900" : "border-slate-200 text-slate-500"}`}>
            <Sun className="w-4 h-4" /> Claro
          </button>
          <button onClick={() => toggleMode("dark")} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-bold text-sm ${mode === "dark" ? "border-white bg-slate-800 text-white" : "border-slate-200 text-slate-500"}`}>
            <Moon className="w-4 h-4" /> Escuro
          </button>
        </div>
      </div>
    </div>
  );
}
