/**
 * SafeSelect — Drop-in replacement for Radix UI Select
 *
 * Uses native HTML <select> instead of Radix's useControllableState
 * hook, which causes React Error #185 under React 19 when mounted
 * inside AnimatePresence animations.
 *
 * API mirrors Radix Select: SafeSelect, SafeSelectTrigger, SafeSelectContent,
 * SafeSelectItem, SafeSelectValue — but renders as a native <select>.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

interface SafeSelectProps {
    value?: string;
    onValueChange?: (value: string) => void;
    children?: React.ReactNode;
    disabled?: boolean;
}

interface SafeSelectItemProps {
    value: string;
    children: React.ReactNode;
    disabled?: boolean;
}

/**
 * Extracts option data from SafeSelectItem children.
 */
function extractOptions(children: React.ReactNode): { value: string; label: string; disabled?: boolean }[] {
    const options: { value: string; label: string; disabled?: boolean }[] = [];
    React.Children.forEach(children, (child) => {
        if (!React.isValidElement(child)) return;
        const props = child.props as Record<string, any>;
        // Check if this is a SafeSelectContent wrapper — recurse into it
        if (props && props.children) {
            const innerChildren = props.children;
            // If the child has a `value` prop, it's a SafeSelectItem
            if (typeof props.value === "string") {
                const label = typeof innerChildren === "string"
                    ? innerChildren
                    : React.Children.toArray(innerChildren)
                        .filter((c) => typeof c === "string" || typeof c === "number")
                        .join("");
                options.push({
                    value: props.value,
                    label: label || props.value,
                    disabled: props.disabled,
                });
            } else {
                // It's a wrapper (SafeSelectContent, SafeSelectTrigger) — recurse
                options.push(...extractOptions(innerChildren));
            }
        }
    });
    return options;
}

function SafeSelect({ value, onValueChange, children, disabled }: SafeSelectProps) {
    const options = React.useMemo(() => extractOptions(children), [children]);

    return (
        <div className="relative">
            <select
                value={value || ""}
                onChange={(e) => onValueChange?.(e.target.value)}
                disabled={disabled}
                className={cn(
                    "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background",
                    "focus:outline-none focus:ring-1 focus:ring-ring",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    "appearance-none cursor-pointer",
                    "bg-white/5 border-white/10 text-foreground",
                    "[&>option]:bg-background [&>option]:text-foreground"
                )}
            >
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                        {opt.label}
                    </option>
                ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 pointer-events-none" />
        </div>
    );
}

// These are no-op wrappers — SafeSelect extracts options directly from children
function SafeSelectTrigger({ children, className }: { children?: React.ReactNode; className?: string }) {
    return null; // Ignored — native select handles its own trigger
}

function SafeSelectContent({ children, className }: { children?: React.ReactNode; className?: string }) {
    return <>{children}</>; // Pass-through for option extraction
}

function SafeSelectItem({ value, children, disabled, className }: SafeSelectItemProps & { className?: string }) {
    return null; // Handled by extractOptions in SafeSelect
}

function SafeSelectValue({ placeholder, className }: { placeholder?: string; className?: string }) {
    return null; // Handled by native select
}

export {
    SafeSelect as Select,
    SafeSelectTrigger as SelectTrigger,
    SafeSelectContent as SelectContent,
    SafeSelectItem as SelectItem,
    SafeSelectValue as SelectValue,
};
