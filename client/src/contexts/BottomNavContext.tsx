import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
  useMemo,
} from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import {
  ARTIST_NAV_ITEMS,
  CLIENT_NAV_ITEMS,
  STUDIO_NAV_ITEMS,
  MERCHANT_NAV_ITEMS,
} from "@/_core/bottomNav/defaultNav";
import { BottomNavButton } from "@/_core/bottomNav/types";
import { FABMenuItem } from "@/ui/FABMenu";

export type Scope = "artist" | "client" | "studio" | "merchant";

interface BottomNavContextType {
  // Main row items based on scope
  navItems: BottomNavButton[];
  // Current Scope
  scope: Scope;

  // ──────────────────────────────────────────────────────
  // LEGACY FAB INTERFACE — kept for backward compatibility
  // All methods are no-ops. Will be removed in Phase 7.
  // ──────────────────────────────────────────────────────
  contextualRow: ReactNode | null;
  isContextualVisible: boolean;
  registerRow: (scope: Scope, id: string, content: ReactNode) => () => void;
  setContextualVisible: (visible: boolean) => void;
  rowIndex: number;
  fabActions: FABMenuItem[];
  registerFABActions: (
    id: string,
    actions: FABMenuItem[] | ReactNode
  ) => () => void;
  fabChildren: ReactNode | null;
  isFABOpen: boolean;
  setFABOpen: (open: boolean) => void;
  isLargePanel: boolean;
  setLargePanel: (large: boolean) => void;
  requestedSettingsView: string | null;
  requestSettingsView: (view: string | null) => void;
}

const BottomNavContext = createContext<BottomNavContextType | undefined>(
  undefined
);

// Stable empty array to avoid referential instability
const EMPTY_FAB_ACTIONS: FABMenuItem[] = [];
const NOOP_UNREGISTER = () => {};

export function BottomNavProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  // Derive scope from user role
  const rawRole = user?.role;
  const scope: Scope =
    rawRole === "merchant"
      ? "merchant"
      : rawRole === "artist" || rawRole === "admin"
        ? "artist"
        : rawRole === "studio"
          ? "studio"
          : "client";

  // Derive nav items from scope
  const navItems =
    scope === "merchant"
      ? MERCHANT_NAV_ITEMS
      : scope === "artist"
        ? ARTIST_NAV_ITEMS
        : scope === "studio"
          ? STUDIO_NAV_ITEMS
          : CLIENT_NAV_ITEMS;

  // Legacy no-op callbacks — stable references
  const registerRow = useCallback(
    (_scope: Scope, _id: string, _content: ReactNode) => NOOP_UNREGISTER,
    []
  );
  const registerFABActions = useCallback(
    (_id: string, _actions: FABMenuItem[] | ReactNode) => NOOP_UNREGISTER,
    []
  );
  const setContextualVisible = useCallback((_visible: boolean) => {}, []);
  const setFABOpen = useCallback((_open: boolean) => {}, []);
  const setLargePanel = useCallback((_large: boolean) => {}, []);
  const requestSettingsView = useCallback((_view: string | null) => {}, []);

  const value = useMemo(
    () => ({
      navItems,
      scope,
      // Legacy no-ops
      contextualRow: null,
      isContextualVisible: false,
      registerRow,
      setContextualVisible,
      rowIndex: 0,
      fabActions: EMPTY_FAB_ACTIONS,
      registerFABActions,
      fabChildren: null,
      isFABOpen: false,
      setFABOpen,
      isLargePanel: false,
      setLargePanel,
      requestedSettingsView: null,
      requestSettingsView,
    }),
    [navItems, scope, registerRow, registerFABActions, setContextualVisible, setFABOpen, setLargePanel, requestSettingsView]
  );

  return (
    <BottomNavContext.Provider value={value}>
      {children}
    </BottomNavContext.Provider>
  );
}

export function useBottomNav() {
  const context = useContext(BottomNavContext);
  if (context === undefined) {
    throw new Error("useBottomNav must be used within a BottomNavProvider");
  }
  return context;
}

/**
 * useRegisterBottomNavRow — LEGACY no-op.
 * Kept for backward compatibility. Does nothing.
 */
export function useRegisterBottomNavRow(_id: string, _content: ReactNode) {
  // No-op — contextual rows have been removed
}

/**
 * useRegisterFABActions — LEGACY no-op.
 * Kept for backward compatibility. Does nothing.
 */
export function useRegisterFABActions(
  _id: string,
  _actions: FABMenuItem[] | ReactNode
) {
  // No-op — FAB actions have been removed
}
