import { Card } from "@/components/ui/card";
/**
 * UI SINGLE SOURCE OF TRUTH (SSOT)
 * -------------------------------
 * ConsultationCard is the canonical card component for consultation requests.
 * This file is part of the core UI primitives. Changes to gradients, blur, 
 * radius, or core styling MUST happen here. 
 * DO NOT OVERRIDE STYLES IN PAGE COMPONENTS.
 * 
 * Card Dimensions (SSOT - matches TaskCard):
 * - Border radius: rounded-2xl (1rem / 16px)
 * - Padding: p-4 (1rem / 16px)
 * - Background: bg-white/5 with hover:bg-white/10 (with primary accent for pending)
 * - Border: border-0 (no border)
 */
import { tokens } from "@/ui/tokens";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

export interface ConsultationCardProps {
    /** Subject/title of the consultation */
    subject: string;
    /** Client name */
    clientName?: string;
    /** Description text */
    description?: string;
    /** Whether this is a new/pending consultation (shows accent styling) */
    isNew?: boolean;
    /** Click handler */
    onClick?: () => void;
    /** Additional classes */
    className?: string;
}

export function ConsultationCard({
    subject,
    clientName,
    description,
    isNew = false,
    onClick,
    className
}: ConsultationCardProps) {
    return (
        <Card
            onClick={onClick}
            className={cn(
                tokens.card.base,
                isNew ? tokens.card.bgAccent : tokens.card.bg,
                tokens.card.interactive,
                tokens.spacing.cardPadding,
                className
            )}
        >
            {/* New indicator glow effect */}
            {isNew && (
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            )}

            <div className="flex items-center justify-between relative z-10">
                <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2 mb-1">
                        {isNew && (
                            <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_hsl(var(--primary))]" />
                        )}
                        <h3 className="font-bold text-foreground text-lg truncate group-hover:text-white transition-colors duration-300">
                            {subject}{clientName ? ` - ${clientName}` : ''}
                        </h3>
                    </div>
                    {description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed pl-4 group-hover:text-muted-foreground/80 transition-colors duration-300">
                            {description}
                        </p>
                    )}
                </div>
                <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-muted-foreground group-hover:border-primary group-hover:text-primary transition-colors">
                    <ChevronRight className="w-4 h-4" />
                </div>
            </div>
        </Card>
    );
}
