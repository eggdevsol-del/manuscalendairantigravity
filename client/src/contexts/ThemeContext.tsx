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
  /** Force a specific theme — overrides user role detection */
  forceTheme?: Theme;
}

/**
 * ThemeProvider — Applies the given theme to the root element.
 * Use forceTheme prop to set theme based on app type (e.g. "dark" for client app).
 */
export function ThemeProvider({
  children,
  defaultTheme = "light",
  switchable = false,
  forceTheme,
}: ThemeProviderProps) {
  const theme: Theme = forceTheme || defaultTheme;

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

  // Clean up stale localStorage
  useEffect(() => {
    localStorage.removeItem("theme");
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme: undefined, switchable: false }}>
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
