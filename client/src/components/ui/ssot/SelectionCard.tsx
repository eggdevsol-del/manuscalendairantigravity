/**
 * UI SINGLE SOURCE OF TRUTH (SSOT)
 * -------------------------------
 * SelectionCard is the canonical component for pill-style selection items.
 * Used for choosing services, promotion types, or any selectable list item.
 * 
 * Supports:
 * - Liquid Glass styling via design tokens
 * - Optional icons
 * - Custom right elements (defaults to checkmark)
 * - Standardized selected/idle states
 */

import { tokens } from "@/ui/tokens";
import { cn } from "@/lib/utils";
import { LucideIcon, Check } from "lucide-react";
import { ReactNode } from "react";

export interface SelectionCardProps {
    /** Whether the card is currently selected */
    selected: boolean;
    /** Click handler */
    onClick: () => void;
    /** Main display title */
    title: string;
    /** Optional description or sub-content */
    description?: ReactNode;
    /** Optional Lucide icon to display on the left */
    icon?: LucideIcon;
    /** Optional element to display on the right (defaults to checkmark indicator) */
    rightElement?: ReactNode;
    /** Additional CSS classes */
    className?: string;
}

export function SelectionCard({
    selected,
    onClick,
    title,
    description,
    icon: Icon,
    rightElement,
    className
}: SelectionCardProps) {
    return (
        <div
            className={cn(
                tokens.selectionCard.base,
                selected ? tokens.selectionCard.selected : tokens.selectionCard.idle,
                className
            )}
            onClick={onClick}
        >
            {/* Left Icon (if provided) */}
            {Icon && (
                <div className={cn(
                    tokens.selectionCard.iconContainer.base,
                    selected ? tokens.selectionCard.iconContainer.selected : tokens.selectionCard.iconContainer.idle
                )}>
                    <Icon className="w-6 h-6" />
                </div>
            )}

            {/* Content area */}
            <div className="flex-1">
                <h3 className={cn(
                    tokens.selectionCard.title.base,
                    selected ? tokens.selectionCard.title.selected : tokens.selectionCard.title.idle
                )}>
                    {title}
                </h3>
                {description && (
                    <div className={tokens.selectionCard.description}>
                        {description}
                    </div>
                )}
            </div>

            {/* Right indicator */}
            <div className={cn(
                tokens.selectionCard.indicator.base,
                selected ? tokens.selectionCard.indicator.selected : tokens.selectionCard.indicator.idle
            )}>
                {rightElement || <Check className="w-4 h-4" />}
            </div>
        </div>
    );
}

export default SelectionCard;
