import React, { createContext, useContext, useEffect, useState } from "react";

interface UIDebugContextType {
  showDebugLabels: boolean;
  setShowDebugLabels: (show: boolean) => void;
}

const UIDebugContext = createContext<UIDebugContextType | undefined>(undefined);

export function UIDebugProvider({ children }: { children: React.ReactNode }) {
  const [showDebugLabels, setShowDebugLabels] = useState(() => {
    // 1. URL params taking precedence
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const debugParam = params.get("debugUI");
      if (debugParam === "true") return true;
      if (debugParam === "false") return false;

      // 2. LocalStorage
      const stored = localStorage.getItem("ui_debug_enabled");
      if (stored !== null) {
        return stored === "true";
      }
    }

    // 3. Default based on environment
    return process.env.NODE_ENV === "development";
  });

  useEffect(() => {
    // Persist to localStorage whenever changed
    localStorage.setItem("ui_debug_enabled", String(showDebugLabels));

    // Optional: Add/remove class to body for global styling if needed
    if (showDebugLabels) {
      document.body.classList.add("ui-debug-mode");
    } else {
      document.body.classList.remove("ui-debug-mode");
    }
  }, [showDebugLabels]);

  return (
    <UIDebugContext.Provider value={{ showDebugLabels, setShowDebugLabels }}>
      {children}
    </UIDebugContext.Provider>
  );
}

export function useUIDebug() {
  const context = useContext(UIDebugContext);
  if (context === undefined) {
    throw new Error("useUIDebug must be used within a UIDebugProvider");
  }
  return context;
}
