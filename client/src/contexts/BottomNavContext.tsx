import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { ARTIST_NAV_ITEMS, CLIENT_NAV_ITEMS } from "@/_core/bottomNav/defaultNav";
import { BottomNavButton } from "@/_core/bottomNav/types";
import { FABMenuItem } from "@/ui/FABMenu";

export type Scope = 'artist' | 'client';

interface BottomNavContextType {
    // The content of the contextual row (Row 1)
    contextualRow: ReactNode | null;
    // Main row items based on scope
    navItems: BottomNavButton[];
    // Whether the contextual row is currently visible (rowIndex === 1)
    isContextualVisible: boolean;
    // Function to register a row (returns unregister function)
    registerRow: (scope: Scope, id: string, content: ReactNode) => () => void;
    // Function to toggle visibility
    setContextualVisible: (visible: boolean) => void;
    // Current row index (0 = default, 1 = contextual)
    rowIndex: number;
    // Current Scope (for debug overlay)
    scope: Scope;
    // Context-dependent FAB actions
    fabActions: FABMenuItem[];
    // Function to register FAB actions
    registerFABActions: (id: string, actions: FABMenuItem[] | ReactNode) => () => void;
    // Custom FAB content (for complex flows)
    fabChildren: ReactNode | null;
}

const BottomNavContext = createContext<BottomNavContextType | undefined>(undefined);

export function BottomNavProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    // Default to 'client' for safety if not authenticated or specified.
    const rawRole = user?.role;
    const scope: Scope = rawRole === 'artist' ? 'artist' : 'client';

    const [registry, setRegistry] = useState<Record<Scope, Record<string, ReactNode>>>({
        artist: {},
        client: {}
    });

    const [fabRegistry, setFabRegistry] = useState<Record<string, FABMenuItem[] | ReactNode>>({});
    const [activeFabId, setActiveFabId] = useState<string | null>(null);

    // activeId is global, but resolved against current scope.
    const [activeId, setActiveId] = useState<string | null>(null);
    const [isContextualVisible, setIsContextualVisible] = useState(false);

    // Derived contextual row based on current scope
    const contextualRow = activeId ? (registry[scope][activeId] || null) : null;

    // Derived FAB actions
    const fabContent = activeFabId ? fabRegistry[activeFabId] : null;
    const fabActions = Array.isArray(fabContent) ? fabContent : [];
    const fabChildren = !Array.isArray(fabContent) ? fabContent : null;

    // Derived nav items
    const navItems = scope === 'artist' ? ARTIST_NAV_ITEMS : CLIENT_NAV_ITEMS;

    const registerRow = useCallback((targetScope: Scope, id: string, content: ReactNode) => {
        setRegistry((prev) => ({
            ...prev,
            [targetScope]: {
                ...prev[targetScope],
                [id]: content
            }
        }));
        setActiveId(id);

        return () => {
            setRegistry((prev) => {
                const newScopeRegistry = { ...prev[targetScope] };
                delete newScopeRegistry[id];
                return {
                    ...prev,
                    [targetScope]: newScopeRegistry
                };
            });

            setActiveId((current) => {
                if (current === id) {
                    setIsContextualVisible(false);
                    return null;
                }
                return current;
            });
        };
    }, []);

    const registerFABActions = useCallback((id: string, actions: FABMenuItem[] | ReactNode) => {
        setFabRegistry(prev => ({ ...prev, [id]: actions }));
        setActiveFabId(id);

        return () => {
            setFabRegistry(prev => {
                const next = { ...prev };
                delete next[id];
                return next;
            });
            setActiveFabId(current => current === id ? null : current);
        };
    }, []);

    const setContextualVisible = useCallback((visible: boolean) => {
        if (visible && !contextualRow) return; // Cannot show if no content
        setIsContextualVisible(visible);
    }, [contextualRow]);

    const rowIndex = isContextualVisible && contextualRow ? 1 : 0;

    return (
        <BottomNavContext.Provider
            value={{
                contextualRow,
                navItems,
                isContextualVisible,
                registerRow,
                setContextualVisible,
                rowIndex,
                scope,
                fabActions,
                registerFABActions,
                fabChildren
            }}
        >
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

export function useRegisterBottomNavRow(id: string, content: ReactNode) {
    const { registerRow } = useBottomNav();
    const { user } = useAuth();
    const scope: Scope = user?.role === 'artist' ? 'artist' : 'client';

    useEffect(() => {
        if (process.env.NODE_ENV === 'development') {
            console.log(`[BottomNavRegistry] scope=${scope} route=${id} row=1 (contextual)`);
        }
        const unregister = registerRow(scope, id, content);
        return unregister;
    }, [id, content, registerRow, scope]);
}

/**
 * useRegisterFABActions - Hooks into the Central Navigation FAB
 * Use this to dynamically add actions to the global FAB menu from any page.
 */
export function useRegisterFABActions(id: string, actions: FABMenuItem[] | ReactNode) {
    const { registerFABActions } = useBottomNav();

    useEffect(() => {
        const unregister = registerFABActions(id, actions);
        return unregister;
    }, [id, actions, registerFABActions]);
}
