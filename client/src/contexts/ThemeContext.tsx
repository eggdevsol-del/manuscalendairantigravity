import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "noir";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/** localStorage key for manual theme override (persists across sessions) */
const THEME_OVERRIDE_KEY = "tattoi-theme-override";

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  switchable?: boolean;
  /** Force a specific theme — used by RoleThemeWrapper based on user role */
  forceTheme?: Theme;
}

/**
 * ThemeProvider — Applies theme to <html> and exposes toggleTheme.
 *
 * Priority order:
 * 1. localStorage override (set by toggleTheme — user preference wins)
 * 2. forceTheme prop (role-based default from RoleThemeWrapper)
 * 3. defaultTheme prop
 */
export function ThemeProvider({
  children,
  defaultTheme = "light",
  switchable = false,
  forceTheme,
}: ThemeProviderProps) {
  const getInitialTheme = (): Theme => {
    try {
      const override = localStorage.getItem(THEME_OVERRIDE_KEY);
      if (override === "dark" || override === "light" || override === "noir") {
        return override as Theme;
      }
    } catch {
      // localStorage unavailable (SSR / private browsing)
    }
    return forceTheme || defaultTheme;
  };

  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  /** Toggle between dark and light. Persists to localStorage. */
  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem(THEME_OVERRIDE_KEY, next);
    } catch {}
  };

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      root.classList.remove("noir");
    } else if (theme === "noir") {
      root.classList.add("dark", "noir");
    } else {
      root.classList.remove("dark", "noir");
    }
  }, [theme]);

  // Remove stale next-themes key (do not remove THEME_OVERRIDE_KEY)
  useEffect(() => {
    localStorage.removeItem("theme");
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, switchable: true }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
