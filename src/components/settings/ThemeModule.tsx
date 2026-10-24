import React, { useEffect, useState } from "react";
import { Palette, Check, Sun, Moon, Sparkles } from "lucide-react";

const PRESETS = [
  { id: "google", name: "Google Blue", primary: "#1A73E8", accent: "#EA4335", bg: "#F8F9FA", label: "Clásico Google" },
  { id: "green", name: "Google Verde", primary: "#34A853", accent: "#FBBC04", bg: "#F1F8F4", label: "Fresco y limpio" },
  { id: "amber", name: "Google Ámbar", primary: "#FBBC04", accent: "#EA4335", bg: "#FFFBF0", label: "Cálido" },
  { id: "rose", name: "Google Rojo", primary: "#EA4335", accent: "#4285F4", bg: "#FEF7F7", label: "Enérgico" },
  { id: "indigo", name: "Indigo SaaS", primary: "#4F46E5", accent: "#10B981", bg: "#F5F3FF", label: "Moderno SaaS" },
  { id: "slate", name: "Slate minimal", primary: "#0F172A", accent: "#3B82F6", bg: "#F8FAFC", label: "Minimalista" },
];

export default function ThemeModule() {
  const [preset, setPreset] = useState("google");
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [customPrimary, setCustomPrimary] = useState("#1A73E8");

  useEffect(() => {
    const saved = localStorage.getItem("anacleto_theme_preset");
    const savedMode = localStorage.getItem("anacleto_theme_mode") as "light" | "dark" | null;
    const savedPrimary = localStorage.getItem("anacleto_theme_primary");
    if (saved) setPreset(saved);
    if (savedMode) setMode(savedMode);
    if (savedPrimary) setCustomPrimary(savedPrimary);
  }, []);

  const applyPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    setPreset(id);
    setCustomPrimary(p.primary);
    document.documentElement.style.setProperty("--color-primary", p.primary);
    document.documentElement.style.setProperty("--color-accent", p.accent);
    document.documentElement.style.setProperty("--color-bg", p.bg);
    localStorage.setItem("anacleto_theme_preset", id);
    localStorage.setItem("anacleto_theme_primary", p.primary);
  };

  const applyCustomPrimary = (color: string) => {
    setCustomPrimary(color);
    document.documentElement.style.setProperty("--color-primary", color);
    localStorage.setItem("anacleto_theme_primary", color);
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
          Personalize as cores da sua área de trabalho. As preferências ficam salvas no seu navegador.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
        <h3 className="font-bold mb-4 flex items-center gap-2"><Sparkles className="w-4 h-4" /> Paletas predefinidas</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => applyPreset(p.id)}
              className={`relative p-4 rounded-xl border-2 text-left transition ${
                preset === p.id
                  ? "border-slate-900 dark:border-white shadow-lg"
                  : "border-slate-200 dark:border-slate-700 hover:border-slate-400"
              }`}
            >
              {preset === p.id && (
                <span className="absolute top-2 right-2 bg-slate-900 text-white rounded-full p-1">
                  <Check className="w-3 h-3" />
                </span>
              )}
              <div className="flex gap-1.5 mb-2">
                <span className="w-6 h-6 rounded-full" style={{ background: p.primary }} />
                <span className="w-6 h-6 rounded-full" style={{ background: p.accent }} />
                <span className="w-6 h-6 rounded-full border" style={{ background: p.bg }} />
              </div>
              <div className="font-bold text-slate-900 dark:text-white text-sm">{p.name}</div>
              <div className="text-xs text-slate-500">{p.label}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
        <h3 className="font-bold mb-4">Cor primária customizada</h3>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={customPrimary}
            onChange={(e) => applyCustomPrimary(e.target.value)}
            className="w-16 h-16 rounded-xl cursor-pointer border-2 border-slate-200"
          />
          <div>
            <div className="font-mono text-sm font-bold text-slate-900 dark:text-white">{customPrimary}</div>
            <div className="text-xs text-slate-500">Clique no quadrado para escolher</div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
        <h3 className="font-bold mb-4">Modo de exibição</h3>
        <div className="flex gap-2">
          <button
            onClick={() => toggleMode("light")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-bold text-sm ${
              mode === "light" ? "border-slate-900 bg-slate-50 text-slate-900" : "border-slate-200 text-slate-500"
            }`}
          >
            <Sun className="w-4 h-4" /> Claro (recomendado)
          </button>
          <button
            onClick={() => toggleMode("dark")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-bold text-sm ${
              mode === "dark" ? "border-white bg-slate-800 text-white" : "border-slate-200 text-slate-500"
            }`}
          >
            <Moon className="w-4 h-4" /> Escuro
          </button>
        </div>
      </div>
    </div>
  );
}
