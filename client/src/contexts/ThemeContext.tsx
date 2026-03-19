import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "noir";

interface ThemeContextType {
  theme: Theme;
  toggleTheme?: () => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  switchable?: boolean;
}

const THEME_ORDER: Theme[] = ["dark", "light", "noir"];

export function ThemeProvider({
  children,
  defaultTheme = "dark",
  switchable = false,
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (switchable) {
      const stored = localStorage.getItem("theme");
      if (stored === "light" || stored === "dark" || stored === "noir") return stored;
      return defaultTheme;
    }
    return defaultTheme;
  });

  useEffect(() => {
    const root = document.documentElement;
    // Remove all theme classes first
    root.classList.remove("dark", "noir");
    // Apply the active theme class (light = no class)
    if (theme === "dark") {
      root.classList.add("dark");
    } else if (theme === "noir") {
      root.classList.add("noir");
    }

    if (switchable) {
      localStorage.setItem("theme", theme);
    }
  }, [theme, switchable]);

  const toggleTheme = switchable
    ? () => {
      setTheme(prev => {
        const idx = THEME_ORDER.indexOf(prev);
        return THEME_ORDER[(idx + 1) % THEME_ORDER.length];
      });
    }
    : undefined;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, switchable }}>
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
