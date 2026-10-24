const STYLE_ID = "anacleto-theme-override";

export interface ThemeConfig {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  accent: string;
  bg: string;
}

/**
 * Aplica el tema inyectando un <style> que sobrescribe las clases
 * Tailwind de color primario (indigo-*) con el color elegido.
 */
export function applyTheme(config: ThemeConfig): void {
  const root = document.documentElement;
  root.style.setProperty("--theme-primary", config.primary);
  root.style.setProperty("--theme-primary-dark", config.primaryDark);
  root.style.setProperty("--theme-primary-light", config.primaryLight);
  root.style.setProperty("--theme-accent", config.accent);
  root.style.setProperty("--theme-bg", config.bg);

  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }

  style.textContent = `
    .bg-indigo-600 { background-color: ${config.primary} !important; }
    .bg-indigo-700 { background-color: ${config.primaryDark} !important; }
    .bg-indigo-500 { background-color: ${config.primary} !important; }
    .bg-indigo-50 { background-color: ${config.primaryLight} !important; }
    .bg-indigo-100 { background-color: ${config.primaryLight} !important; }
    .hover\\:bg-indigo-700:hover { background-color: ${config.primaryDark} !important; }
    .hover\\:bg-indigo-600:hover { background-color: ${config.primary} !important; }
    .hover\\:bg-indigo-50:hover { background-color: ${config.primaryLight} !important; }
    .text-indigo-600, .text-indigo-500 { color: ${config.primary} !important; }
    .text-indigo-700, .text-indigo-800 { color: ${config.primaryDark} !important; }
    .text-indigo-400, .text-indigo-300 { color: ${config.primary} !important; }
    .border-indigo-600, .border-indigo-500, .border-indigo-400 { border-color: ${config.primary} !important; }
    .border-indigo-200 { border-color: ${config.primaryLight} !important; }
    .ring-indigo-500 { --tw-ring-color: ${config.primary} !important; }
    .from-indigo-500 { --tw-gradient-from: ${config.primary} !important; }
    .to-indigo-600 { --tw-gradient-to: ${config.primaryDark} !important; }
    .from-indigo-600 { --tw-gradient-from: ${config.primary} !important; }
  `;

  localStorage.setItem("anacleto_theme", JSON.stringify(config));
}

export function loadSavedTheme(): ThemeConfig | null {
  try {
    const saved = localStorage.getItem("anacleto_theme");
    if (saved) return JSON.parse(saved) as ThemeConfig;
  } catch {}
  return null;
}

export function clearTheme(): void {
  document.getElementById(STYLE_ID)?.remove();
  localStorage.removeItem("anacleto_theme");
  document.documentElement.style.removeProperty("--theme-primary");
}
