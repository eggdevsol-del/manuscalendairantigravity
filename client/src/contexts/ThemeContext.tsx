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

/**
 * ThemeProvider — Always applies light (clean white) theme.
 * Dark mode code is preserved in index.css but never activated.
 * The toggle is intentionally hidden from the UI.
 */
export function ThemeProvider({
  children,
  defaultTheme = "light",
  switchable = false,
}: ThemeProviderProps) {
  // Always light — ignore stored preference
  const [theme] = useState<Theme>("light");

  useEffect(() => {
    const root = document.documentElement;
    // Ensure no dark/noir class is applied
    root.classList.remove("dark", "noir");
    // Remove any stale theme from localStorage
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
