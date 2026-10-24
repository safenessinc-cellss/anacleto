const STYLE_ID = "anacleto-theme-override";

export interface ThemeConfig {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  accent: string;
  accentLight: string;
  bg: string;
  radius: number;   // 0-20 px
  density: "compact" | "normal" | "comfortable";
}

export const DEFAULT_THEME: ThemeConfig = {
  primary: "#1A73E8",
  primaryDark: "#1557B0",
  primaryLight: "#E8F0FE",
  accent: "#EA4335",
  accentLight: "#FCE8E6",
  bg: "#F8F9FA",
  radius: 8,
  density: "normal",
};

export function applyTheme(config: ThemeConfig): void {
  const root = document.documentElement;
  root.style.setProperty("--theme-primary", config.primary);
  root.style.setProperty("--theme-primary-dark", config.primaryDark);
  root.style.setProperty("--theme-primary-light", config.primaryLight);
  root.style.setProperty("--theme-accent", config.accent);
  root.style.setProperty("--theme-accent-light", config.accentLight);
  root.style.setProperty("--theme-bg", config.bg);
  root.style.setProperty("--theme-radius", `${config.radius}px`);

  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }

  const densityPad = config.density === "compact" ? "0.35rem" : config.density === "comfortable" ? "0.75rem" : "0.5rem";

  style.textContent = `
    /* ===== PRIMARY ===== */
    .bg-indigo-600, .bg-indigo-500 { background-color: ${config.primary} !important; }
    .bg-indigo-700 { background-color: ${config.primaryDark} !important; }
    .bg-indigo-50, .bg-indigo-100 { background-color: ${config.primaryLight} !important; }
    .hover\\:bg-indigo-700:hover { background-color: ${config.primaryDark} !important; }
    .hover\\:bg-indigo-600:hover { background-color: ${config.primary} !important; }
    .hover\\:bg-indigo-50:hover, .hover\\:bg-indigo-100:hover { background-color: ${config.primaryLight} !important; }
    .text-indigo-600, .text-indigo-500 { color: ${config.primary} !important; }
    .text-indigo-700, .text-indigo-800, .text-indigo-900 { color: ${config.primaryDark} !important; }
    .text-indigo-400, .text-indigo-300 { color: ${config.primary} !important; }
    .border-indigo-600, .border-indigo-500, .border-indigo-400 { border-color: ${config.primary} !important; }
    .border-indigo-200, .border-indigo-300 { border-color: ${config.primaryLight} !important; }
    .ring-indigo-500 { --tw-ring-color: ${config.primary} !important; }
    .from-indigo-500, .from-indigo-600 { --tw-gradient-from: ${config.primary} !important; }
    .to-indigo-600, .to-indigo-700 { --tw-gradient-to: ${config.primaryDark} !important; }
    .focus\\:border-indigo-500:focus { border-color: ${config.primary} !important; }
    .focus\\:ring-indigo-500:focus { --tw-ring-color: ${config.primary} !important; }

    /* ===== ACCENT (destructive / alerts) ===== */
    .bg-rose-500, .bg-rose-600 { background-color: ${config.accent} !important; }
    .text-rose-600, .text-rose-500 { color: ${config.accent} !important; }
    .bg-rose-50, .bg-rose-100 { background-color: ${config.accentLight} !important; }

    /* ===== BG TINT ===== */
    body { background-color: ${config.bg} !important; }

    /* ===== RADIUS ===== */
    .rounded-lg { border-radius: ${config.radius}px !important; }
    .rounded-xl { border-radius: ${config.radius + 4}px !important; }
    .rounded-2xl { border-radius: ${config.radius + 8}px !important; }
    .rounded-3xl { border-radius: ${config.radius + 12}px !important; }

    /* ===== DENSITY ===== */
    input, select, textarea { padding-top: ${densityPad} !important; padding-bottom: ${densityPad} !important; }
  `;

  localStorage.setItem("anacleto_theme", JSON.stringify(config));
}

export function loadSavedTheme(): ThemeConfig | null {
  try {
    const saved = localStorage.getItem("anacleto_theme");
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_THEME, ...parsed };
    }
  } catch {}
  return null;
}

export function clearTheme(): void {
  document.getElementById(STYLE_ID)?.remove();
  localStorage.removeItem("anacleto_theme");
  document.documentElement.style.removeProperty("--theme-primary");
}
