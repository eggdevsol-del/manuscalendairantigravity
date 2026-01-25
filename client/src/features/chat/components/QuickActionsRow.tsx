import { Button } from "@/components/ui/button";
import { BottomNavRow } from "@/components/BottomNavRow";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { useRef } from "react";

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
    return (
        <BottomNavRow>
            {actions.map((action) => {
                const Icon = action.icon;
                return (
                    <QuickActionButton key={action.id} action={action} Icon={Icon} />
                )
            })}
        </BottomNavRow>
    );
}

// Separate component to handle touch properly
function QuickActionButton({ action, Icon }: { action: ChatAction; Icon: LucideIcon }) {
    const touchStartRef = useRef<{ x: number; y: number } | null>(null);
    
    const handleTouchStart = (e: React.TouchEvent) => {
        const touch = e.touches[0];
        touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    };
    
    const handleTouchEnd = (e: React.TouchEvent) => {
        if (!touchStartRef.current) return;
        
        const touch = e.changedTouches[0];
        const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
        const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);
        
        // Only trigger if it was a tap (not a swipe)
        if (deltaX < 10 && deltaY < 10) {
            console.log('[QuickActionButton] Touch tap detected, calling onClick for:', action.label);
            e.preventDefault();
            e.stopPropagation();
            action.onClick();
        }
        
        touchStartRef.current = null;
    };
    
    const handleClick = (e: React.MouseEvent) => {
        console.log('[QuickActionButton] Click detected for:', action.label);
        e.stopPropagation();
        action.onClick();
    };
    
    return (
        <Button
            variant="ghost"
            size="sm"
            className={cn(
                "flex-col h-auto py-2 px-3 gap-1 hover:bg-gray-200/50 dark:hover:bg-transparent min-w-[70px] snap-center shrink-0 transition-all duration-300 relative opacity-80 hover:opacity-100"
            )}
            onClick={handleClick}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            <div className="relative pointer-events-none">
                <Icon className={cn("w-6 h-6 mb-0.5", action.highlight ? "text-blue-600 dark:text-blue-500" : "text-amber-600 dark:text-amber-500")} />
            </div>
            <span className="text-[10px] font-medium truncate max-w-[80px] text-gray-700 dark:text-gray-300 pointer-events-none">
                {action.label}
            </span>
        </Button>
    );
}
