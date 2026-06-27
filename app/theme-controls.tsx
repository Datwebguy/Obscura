"use client";

import { Moon, Settings, Sun } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Theme = "light" | "dark";
const THEME_STORAGE_KEY = "obscura-theme";
const LEGACY_THEME_STORAGE_KEY = ["stellar", "shield", "theme"].join("-");

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}

export function usePlatformTheme() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const savedTheme = (
      window.localStorage.getItem(THEME_STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY)
    ) as Theme | null;
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const initialTheme = savedTheme ?? systemTheme;

    setTheme(initialTheme);
    applyTheme(initialTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((currentTheme) => {
      const nextTheme = currentTheme === "dark" ? "light" : "dark";
      applyTheme(nextTheme);
      return nextTheme;
    });
  }, []);

  return { theme, toggleTheme };
}

export function ThemeControls({ surface = "landing" }: { surface?: "landing" | "wallet" }) {
  const { theme, toggleTheme } = usePlatformTheme();
  const isWallet = surface === "wallet";

  return (
    <div className={isWallet ? "wallet-theme-controls" : "theme-controls"}>
      <button
        className={isWallet ? "wallet-icon-button wallet-theme-settings" : "icon-box active"}
        type="button"
        aria-label="Settings"
      >
        <Settings size={isWallet ? 18 : 25} />
      </button>
      <button
        className={isWallet ? "wallet-icon-button" : "icon-button"}
        onClick={toggleTheme}
        type="button"
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        aria-pressed={theme === "dark"}
      >
        {theme === "dark" ? <Sun size={isWallet ? 18 : 24} /> : <Moon size={isWallet ? 18 : 24} />}
      </button>
    </div>
  );
}
