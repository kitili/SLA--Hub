export const THEME_STORAGE_KEY = "silverleaf-theme";

export type Theme = "light" | "dark";

export function resolveTheme(stored: string | null): Theme {
  if (stored === "light" || stored === "dark") return stored;
  return "light";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}
