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

import { tokens } from "@/ui/tokens";
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
        onAction();
    }, [onAction]);

    const handlePointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        setIsPressed(true);
    }, []);

    const handlePointerUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        setIsPressed(false);
    }, []);

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
                tokens.navAction.base,
                isPressed ? tokens.navAction.pressed : tokens.navAction.idle,
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
