import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";

interface TeaserContextType {
    isTeaserClient: boolean;
    enableTeaserMode: () => void;
    disableTeaserMode: () => void;
}

const TeaserContext = createContext<TeaserContextType | undefined>(undefined);

export function TeaserProvider({ children }: { children: React.ReactNode }) {
    const [isTeaserClient, setIsTeaserClient] = useState<boolean>(false);
    const { user } = useAuth();

    // Initialize from localStorage on mount, but NEVER for artists/admins
    useEffect(() => {
        // CRITICAL: Artists and admins are NEVER in teaser mode
        if (user?.role === "artist" || user?.role === "admin") {
            setIsTeaserClient(false);
            localStorage.removeItem("calendair_teaser_mode");
            return;
        }

        // For clients, check localStorage
        const stored = localStorage.getItem("calendair_teaser_mode");
        if (stored === "true") {
            setIsTeaserClient(true);
        }
    }, [user]);

    const enableTeaserMode = () => {
        // Prevent artists/admins from enabling teaser mode
        if (user?.role === "artist" || user?.role === "admin") {
            console.warn("Artists and admins cannot enable teaser mode");
            return;
        }

        setIsTeaserClient(true);
        localStorage.setItem("calendair_teaser_mode", "true");
    };

    const disableTeaserMode = () => {
        setIsTeaserClient(false);
        localStorage.removeItem("calendair_teaser_mode");
    };

    return (
        <TeaserContext.Provider value={{ isTeaserClient, enableTeaserMode, disableTeaserMode }}>
            {children}
        </TeaserContext.Provider>
    );
}

export function useTeaser() {
    const context = useContext(TeaserContext);
    if (context === undefined) {
        throw new Error("useTeaser must be used within a TeaserProvider");
    }
    return context;
}
