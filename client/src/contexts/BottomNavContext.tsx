import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
  useMemo,
  useRef,
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

  // ── FAB Action System ──────────────────────────────────
  // Pages register contextual actions (booking, proposals, etc.)
  // These render in a bottom sheet when the FAB button is tapped.
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

  // ── Legacy no-ops (contextual rows removed) ────────────
  contextualRow: ReactNode | null;
  isContextualVisible: boolean;
  registerRow: (scope: Scope, id: string, content: ReactNode) => () => void;
  setContextualVisible: (visible: boolean) => void;
  rowIndex: number;
}

const BottomNavContext = createContext<BottomNavContextType | undefined>(
  undefined
);

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

  // ── FAB Action State ───────────────────────────────────
  const [fabActions, setFabActions] = useState<FABMenuItem[]>([]);
  const [fabChildren, setFabChildren] = useState<ReactNode | null>(null);
  const [isFABOpen, setFABOpenState] = useState(false);
  const [isLargePanel, setLargePanelState] = useState(false);
  const [requestedSettingsView, setRequestedSettingsView] = useState<string | null>(null);

  // Track registered action sets by id
  const actionsRegistry = useRef<Map<string, FABMenuItem[]>>(new Map());
  const childrenRegistry = useRef<Map<string, ReactNode>>(new Map());

  const setFABOpen = useCallback((open: boolean) => {
    setFABOpenState(open);
  }, []);

  const setLargePanel = useCallback((large: boolean) => {
    setLargePanelState(large);
  }, []);

  const requestSettingsView = useCallback((view: string | null) => {
    setRequestedSettingsView(view);
  }, []);

  const registerFABActions = useCallback(
    (id: string, actions: FABMenuItem[] | ReactNode) => {
      if (Array.isArray(actions)) {
        actionsRegistry.current.set(id, actions as FABMenuItem[]);
        // Merge all registered action sets
        const merged = Array.from(actionsRegistry.current.values()).flat();
        setFabActions(merged);
        setFabChildren(null);
      } else {
        // ReactNode children (e.g. BookingWizardContent)
        childrenRegistry.current.set(id, actions);
        setFabChildren(actions as ReactNode);
      }

      return () => {
        actionsRegistry.current.delete(id);
        childrenRegistry.current.delete(id);
        const merged = Array.from(actionsRegistry.current.values()).flat();
        setFabActions(merged);
        // If any children registrations remain, use the last one
        const remainingChildren = Array.from(childrenRegistry.current.values());
        setFabChildren(remainingChildren.length > 0 ? remainingChildren[remainingChildren.length - 1] : null);
      };
    },
    []
  );

  // Legacy no-op callbacks
  const registerRow = useCallback(
    (_scope: Scope, _id: string, _content: ReactNode) => NOOP_UNREGISTER,
    []
  );
  const setContextualVisible = useCallback((_visible: boolean) => {}, []);

  const value = useMemo(
    () => ({
      navItems,
      scope,
      // FAB action system — live state
      fabActions,
      registerFABActions,
      fabChildren,
      isFABOpen,
      setFABOpen,
      isLargePanel,
      setLargePanel,
      requestedSettingsView,
      requestSettingsView,
      // Legacy no-ops
      contextualRow: null,
      isContextualVisible: false,
      registerRow,
      setContextualVisible,
      rowIndex: 0,
    }),
    [
      navItems, scope,
      fabActions, registerFABActions, fabChildren,
      isFABOpen, setFABOpen, isLargePanel, setLargePanel,
      requestedSettingsView, requestSettingsView,
      registerRow, setContextualVisible,
    ]
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
 * useRegisterFABActions — registers page-specific actions for the FAB panel.
 * Pages call this to add booking, proposal, payment actions, etc.
 */
export function useRegisterFABActions(
  id: string,
  actions: FABMenuItem[] | ReactNode
) {
  const { registerFABActions } = useBottomNav();

  useEffect(() => {
    const unregister = registerFABActions(id, actions);
    return unregister;
  }, [id, actions, registerFABActions]);
}
