/**
 * UI SINGLE SOURCE OF TRUTH (SSOT)
 * -------------------------------
 * NavActionButton is the canonical button component for bottom navigation action rows.
 * 
 * ARCHITECTURE:
 * This component uses a SIMPLE approach - just a native button with onClick.
 * Previous complex touch handling was causing issues because:
 * 1. Touch events were being captured by parent scroll containers
 * 2. The touchAction CSS property wasn't being respected consistently
 * 3. Complex tap detection logic was unreliable
 * 
 * NEW APPROACH:
 * - Use native <button> element with standard onClick
 * - Wrap in a non-scrolling container to isolate from parent scroll
 * - Use CSS pointer-events and touch-action to ensure button receives events
 * - Add visual feedback for touch/click
 * 
 * @version 1.0.125
 */

import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { useCallback, useState } from "react";

export interface NavActionButtonProps {
    /** Unique identifier for the action */
    id: string | number;
    /** Display label for the button */
    label: string;
    /** Lucide icon component */
    icon: LucideIcon;
    /** Click/tap handler */
    onAction: () => void;
    /** Whether this is a highlighted/primary action */
    highlight?: boolean;
    /** Additional CSS classes */
    className?: string;
}

/**
 * NavActionButton - SSOT button for bottom nav action rows
 * 
 * Uses a simple native button approach for maximum compatibility.
 */
export function NavActionButton({
    id,
    label,
    icon: Icon,
    onAction,
    highlight = false,
    className,
}: NavActionButtonProps) {
    const [isPressed, setIsPressed] = useState(false);

    const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();
        console.log(`[NavActionButton:${label}] Click event fired`);
        onAction();
    }, [label, onAction]);

    const handlePointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        setIsPressed(true);
        console.log(`[NavActionButton:${label}] Pointer down`);
    }, [label]);

    const handlePointerUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        setIsPressed(false);
        console.log(`[NavActionButton:${label}] Pointer up`);
    }, [label]);

    const handlePointerCancel = useCallback(() => {
        setIsPressed(false);
    }, []);

    return (
        <button
            type="button"
            data-action-id={id}
            onClick={handleClick}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onPointerLeave={handlePointerCancel}
            className={cn(
                // Layout
                "flex flex-col items-center justify-center",
                "h-auto py-2 px-4 gap-1",
                "min-w-[72px] shrink-0",
                // Visual
                "bg-transparent border-0 rounded-xl",
                "transition-all duration-150",
                // States
                isPressed ? "scale-90 opacity-70" : "opacity-90 hover:opacity-100",
                "hover:bg-white/10 dark:hover:bg-white/5",
                "active:scale-90",
                // Touch behavior - CRITICAL
                "touch-none", // Disable browser touch actions completely
                "select-none",
                // Focus
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                className
            )}
            style={{
                // CRITICAL: Disable all browser touch handling
                touchAction: 'none',
                // Ensure this element receives pointer events
                pointerEvents: 'auto',
                // Prevent iOS tap highlight
                WebkitTapHighlightColor: 'transparent',
                // Prevent text selection
                WebkitUserSelect: 'none',
                userSelect: 'none',
            }}
        >
            <Icon 
                className={cn(
                    "w-6 h-6 mb-0.5 transition-colors pointer-events-none",
                    highlight 
                        ? "text-blue-500 dark:text-blue-400" 
                        : "text-amber-500 dark:text-amber-400"
                )} 
            />
            <span className="text-[10px] font-medium truncate max-w-[80px] text-foreground/80 pointer-events-none">
                {label}
            </span>
        </button>
    );
}
