import React from "react";
import { Settings, Plus } from "lucide-react";
import { useLocation } from "wouter";
import { FABMenu, FABMenuItem } from "@/ui/FABMenu";
import { cn } from "@/lib/utils";

interface CentralNavFABProps {
    className?: string;
}

/**
 * CentralNavFAB - Anchored in the center of the BottomNav.
 * Houses global actions like Settings and potential page-specific quick actions.
 */
export function CentralNavFAB({ className }: CentralNavFABProps) {
    const [, setLocation] = useLocation();

    const items: FABMenuItem[] = [
        // Add more global or page-specific items here in the future
        {
            id: "settings",
            label: "Settings",
            icon: Settings,
            onClick: () => setLocation("/settings"),
            highlight: false
        }
    ];

    return (
        <div className={cn("relative flex items-center justify-center w-16 h-full", className)}>
            <FABMenu
                toggleIcon={<Plus className="w-6 h-6" />}
                items={items}
                className="!static !bottom-auto !right-auto" // Reset FAB default fixed position
                panelClassName="bottom-20 right-1/2 translate-x-1/2 !items-center" // Center the panel above the button
            />
        </div>
    );
}
