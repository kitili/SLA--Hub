"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import {
  applyTheme,
  resolveTheme,
  THEME_STORAGE_KEY,
  type Theme,
} from "@/lib/theme";

import styles from "./ThemeToggle.module.css";

export default function ThemeToggle() {
  const t = useTranslations("nav");
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    const resolved = resolveTheme(stored);
    setTheme(resolved);
    applyTheme(resolved);
  }, []);

  function selectTheme(next: Theme) {
    if (next === theme) return;
    setTheme(next);
    applyTheme(next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
  }

  return (
    <div className={styles.switch} role="group" aria-label={t("theme")}>
      <button
        type="button"
        className={styles.button}
        aria-pressed={theme === "light"}
        onClick={() => selectTheme("light")}
      >
        <span className={styles.icon} aria-hidden>
          ☀
        </span>
        <span className={styles.label}>{t("themeLight")}</span>
      </button>
      <button
        type="button"
        className={styles.button}
        aria-pressed={theme === "dark"}
        onClick={() => selectTheme("dark")}
      >
        <span className={styles.icon} aria-hidden>
          🌙
        </span>
        <span className={styles.label}>{t("themeDark")}</span>
      </button>
    </div>
  );
}
