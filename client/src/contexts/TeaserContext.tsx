import React, { createContext, useContext, useEffect, useState } from "react";

interface TeaserContextType {
    isTeaserClient: boolean;
    enableTeaserMode: () => void;
    disableTeaserMode: () => void;
}

const TeaserContext = createContext<TeaserContextType | undefined>(undefined);

export function TeaserProvider({ children }: { children: React.ReactNode }) {
    const [isTeaserClient, setIsTeaserClient] = useState<boolean>(false);

    // Initialize from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem("calendair_teaser_mode");
        if (stored === "true") {
            setIsTeaserClient(true);
        }
    }, []);

    const enableTeaserMode = () => {
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
