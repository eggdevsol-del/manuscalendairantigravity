import { useMemo } from "react";
import { useRegisterFABActions } from "@/contexts/BottomNavContext";
import { BarChart3, Settings, Plus } from "lucide-react";
import { type FABMenuItem } from "@/ui/FABMenu";

interface DashboardFABActionsProps {
    activeCategory: 'business' | 'social' | 'personal';
    onShowSnapshot: () => void;
    onShowSettings: () => void;
    onShowChallenge: () => void;
}

export function DashboardFABActions({
    activeCategory,
    onShowSnapshot,
    onShowSettings,
    onShowChallenge
}: DashboardFABActionsProps) {
    const fabContent = useMemo<FABMenuItem[]>(() => {
        const items: FABMenuItem[] = [];

        // Snapshot only for business
        if (activeCategory === 'business') {
            items.push({
                id: 'snapshot',
                label: 'Weekly Snapshot',
                icon: BarChart3,
                onClick: onShowSnapshot,
                highlight: true
            });
        }

        // New challenge for personal
        if (activeCategory === 'personal') {
            items.push({
                id: 'new-challenge',
                label: 'New Challenge',
                icon: Plus,
                onClick: onShowChallenge,
                highlight: true
            });
        }

        // Settings always available for dashboard
        items.push({
            id: 'dashboard-settings',
            label: 'Dashboard Settings',
            icon: Settings,
            onClick: onShowSettings
        });

        return items;
    }, [activeCategory, onShowSnapshot, onShowSettings, onShowChallenge]);

    useRegisterFABActions("dashboard", fabContent);

    return null;
}
