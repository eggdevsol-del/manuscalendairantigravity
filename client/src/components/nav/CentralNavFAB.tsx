import React, { useMemo } from "react";
import { Settings, Plus, Sun, Moon, Link } from "lucide-react";
import { useLocation } from "wouter";
import { FABMenu, FABMenuItem } from "@/ui/FABMenu";
import { cn } from "@/lib/utils";
import { useBottomNav } from "@/contexts/BottomNavContext";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface CentralNavFABProps {
    className?: string;
}

/**
 * CentralNavFAB - Anchored in the center of the BottomNav.
 * Houses global actions like Settings and potential page-specific quick actions.
 */
export function CentralNavFAB({ className }: CentralNavFABProps) {
    const [, setLocation] = useLocation();
    const { theme, toggleTheme } = useTheme();
    const { fabActions, fabChildren, isFABOpen, setFABOpen } = useBottomNav();

    // Fetch artist settings for the booking link slug
    const { data: artistSettings } = trpc.artistSettings.get.useQuery(undefined, {
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    const handleCopyLink = () => {
        if (!artistSettings?.publicSlug) {
            toast.error("Booking link not configured. Please set your public slug in settings.");
            return;
        }
        const url = `${window.location.origin}/start/${artistSettings.publicSlug}`;
        navigator.clipboard.writeText(url);
        toast.success("Booking link copied to clipboard!");
    };

    const permanentItems: FABMenuItem[] = [
        {
            id: "settings",
            label: "Settings",
            icon: Settings,
            onClick: () => setLocation("/settings"),
        },
        {
            id: "theme",
            label: theme === 'dark' ? "Light Mode" : "Dark Mode",
            icon: theme === 'dark' ? Sun : Moon,
            onClick: () => toggleTheme?.(),
            closeOnClick: false, // Keep menu open to show change
        },
        {
            id: "copy-link",
            label: "Booking Link",
            icon: Link,
            onClick: handleCopyLink,
        }
    ];

    // Combine permanent items with dynamic actions from context
    const allItems = useMemo(() => {
        return [...fabActions, ...permanentItems];
    }, [fabActions, permanentItems]);

    return (
        <div className={cn("relative flex items-center justify-center w-16 h-full transition-none", className)}>
            <FABMenu
                toggleIcon={<Plus className="w-6 h-6" />}
                items={!fabChildren ? allItems : undefined}
                isOpen={isFABOpen}
                onOpenChange={setFABOpen}
                className="!static !bottom-auto !right-auto transition-none"
                portalContainerClassName="bottom-[90px] left-1/2 -translate-x-1/2 items-center"
                panelClassName={cn("!items-center", fabChildren ? "w-[330px]" : "w-[220px]")}
            >
                {fabChildren}
            </FABMenu>
        </div>
    );
}
