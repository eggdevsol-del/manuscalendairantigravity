/**
 * SafeSwitch — Drop-in replacement for Radix UI Switch
 *
 * Uses a plain HTML checkbox + CSS instead of Radix's useControllableState
 * hook, which causes React Error #185 (Maximum update depth exceeded) when
 * mounted inside AnimatePresence animations under React 19.
 *
 * API-compatible with Radix Switch: checked, onCheckedChange, id, className, disabled.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

interface SafeSwitchProps {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    id?: string;
    className?: string;
    disabled?: boolean;
}

const SafeSwitch = React.forwardRef<HTMLButtonElement, SafeSwitchProps>(
    ({ checked = false, onCheckedChange, id, className, disabled }, ref) => {
        return (
            <button
                ref={ref}
                id={id}
                type="button"
                role="switch"
                aria-checked={checked}
                disabled={disabled}
                data-state={checked ? "checked" : "unchecked"}
                data-disabled={disabled ? "" : undefined}
                onClick={() => onCheckedChange?.(!checked)}
                className={cn(
                    "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    checked
                        ? "bg-primary"
                        : "bg-input",
                    className
                )}
            >
                <span
                    data-state={checked ? "checked" : "unchecked"}
                    className={cn(
                        "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform",
                        checked ? "translate-x-4" : "translate-x-0"
                    )}
                />
            </button>
        );
    }
);

SafeSwitch.displayName = "SafeSwitch";

export { SafeSwitch };
