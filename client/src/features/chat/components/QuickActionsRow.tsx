import { Button } from "@/components/ui/button";
import { BottomNavRow } from "@/components/BottomNavRow";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { useRef, useCallback } from "react";

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

// Threshold for distinguishing tap from scroll (in pixels)
const TAP_THRESHOLD = 10;
// Maximum time for a tap (in milliseconds)
const TAP_MAX_DURATION = 300;

export function QuickActionsRow({
    actions = [],
}: QuickActionsRowProps) {
    return (
        <BottomNavRow>
            {actions.map((action) => (
                <ActionButton key={action.id} action={action} />
            ))}
        </BottomNavRow>
    );
}

// Separate component for each button to isolate touch state
function ActionButton({ action }: { action: ChatAction }) {
    const Icon = action.icon;
    const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        const touch = e.touches[0];
        touchStartRef.current = {
            x: touch.clientX,
            y: touch.clientY,
            time: Date.now()
        };
        console.log('[ActionButton] Touch start:', action.label);
    }, [action.label]);

    const handleTouchEnd = useCallback((e: React.TouchEvent) => {
        if (!touchStartRef.current) return;

        const touch = e.changedTouches[0];
        const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
        const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);
        const duration = Date.now() - touchStartRef.current.time;

        console.log('[ActionButton] Touch end:', action.label, { deltaX, deltaY, duration });

        // Check if this was a tap (minimal movement, short duration)
        if (deltaX < TAP_THRESHOLD && deltaY < TAP_THRESHOLD && duration < TAP_MAX_DURATION) {
            console.log('[ActionButton] Tap detected, executing onClick:', action.label);
            e.preventDefault();
            e.stopPropagation();
            action.onClick();
        }

        touchStartRef.current = null;
    }, [action]);

    const handleClick = useCallback((e: React.MouseEvent) => {
        // For non-touch devices (desktop)
        console.log('[ActionButton] Click:', action.label);
        e.stopPropagation();
        action.onClick();
    }, [action]);

    return (
        <Button
            ref={buttonRef}
            variant="ghost"
            size="sm"
            className={cn(
                "flex-col h-auto py-2 px-3 gap-1 hover:bg-gray-200/50 dark:hover:bg-white/10 min-w-[70px] snap-center shrink-0 transition-all duration-300 relative opacity-80 hover:opacity-100",
                // Critical: ensure touch events work properly
                "touch-manipulation"
            )}
            style={{
                // Ensure this element can receive touch events
                touchAction: 'manipulation',
                // Ensure pointer events are enabled
                pointerEvents: 'auto',
                // Prevent text selection on long press
                WebkitUserSelect: 'none',
                userSelect: 'none',
            }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onClick={handleClick}
        >
            <div className="relative pointer-events-none">
                <Icon className={cn(
                    "w-6 h-6 mb-0.5", 
                    action.highlight 
                        ? "text-blue-600 dark:text-blue-500" 
                        : "text-amber-600 dark:text-amber-500"
                )} />
            </div>
            <span className="text-[10px] font-medium truncate max-w-[80px] text-gray-700 dark:text-gray-300 pointer-events-none">
                {action.label}
            </span>
        </Button>
    );
}
