import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";

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

/**
 * ThemeProvider — Applies light theme for artists/merchants,
 * dark theme for client scope.
 */
export function ThemeProvider({
  children,
  defaultTheme = "light",
  switchable = false,
}: ThemeProviderProps) {
  const { user } = useAuth();
  const isClient = user?.role === "client";

  // Client scope → dark, everything else → light
  const theme: Theme = isClient ? "dark" : "light";

  useEffect(() => {
    const root = document.documentElement;

    if (theme === "dark") {
      root.classList.add("dark");
      root.classList.remove("noir");
    } else {
      root.classList.remove("dark", "noir");
    }
  }, [theme]);

  // Also clean up stale localStorage
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
