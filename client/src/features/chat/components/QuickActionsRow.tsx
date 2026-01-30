<<<<<<< HEAD
import { Button } from "@/components/ui";
=======
/**
 * QuickActionsRow - Chat contextual actions for bottom navigation
 * 
 * Uses SSOT NavActionButton for guaranteed touch event handling.
 * This component renders the contextual action bar that appears
 * when viewing a chat conversation.
 */

import { NavActionButton } from "@/components/ui/ssot";
>>>>>>> f67b805f30b6e59529d357c59fa5a255ab93fc80
import { BottomNavRow } from "@/components/BottomNavRow";
import { LucideIcon } from "lucide-react";

export interface ChatAction {
    id: string | number;
    label: string;
    icon: LucideIcon;
    onClick: () => void;
    highlight?: boolean;
}

interface QuickActionsRowProps {
    actions: ChatAction[];
}

export function QuickActionsRow({
    actions = [],
}: QuickActionsRowProps) {
    console.log('[QuickActionsRow] Rendering with', actions.length, 'actions');
    
    return (
        <BottomNavRow>
            {actions.map((action) => (
                <NavActionButton
                    key={action.id}
                    id={action.id}
                    label={action.label}
                    icon={action.icon}
                    onAction={action.onClick}
                    highlight={action.highlight}
                />
            ))}
        </BottomNavRow>
    );
}
