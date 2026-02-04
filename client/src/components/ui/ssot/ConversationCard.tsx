import { Card } from "@/components/ui/card";
/**
 * UI SINGLE SOURCE OF TRUTH (SSOT)
 * -------------------------------
 * ConversationCard is the canonical card component for Messages/Conversations.
 * This file is part of the core UI primitives. Changes to gradients, blur, 
 * radius, or core styling MUST happen here. 
 * DO NOT OVERRIDE STYLES IN PAGE COMPONENTS.
 * 
 * Card Dimensions (SSOT - matches TaskCard):
 * - Border radius: rounded-2xl (1rem / 16px)
 * - Padding: p-4 (1rem / 16px)
 * - Background: bg-white/5 with hover:bg-white/10
 * - Border: border-0 (no border)
 */
import { tokens } from "@/ui/tokens";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

export interface ConversationCardProps {
    /** User's display name */
    name: string;
    /** User's avatar URL (optional) */
    avatar?: string | null;
    /** Last message timestamp */
    timestamp?: string;
    /** Number of unread messages */
    unreadCount?: number;
    /** Click handler */
    onClick?: () => void;
    /** Additional classes */
    className?: string;
}

export function ConversationCard({
    name,
    avatar,
    timestamp,
    unreadCount = 0,
    onClick,
    className
}: ConversationCardProps) {
    return (
        <Card
            onClick={onClick}
            className={cn(
                tokens.card.base,
                tokens.card.bg,
                tokens.card.interactive,
                tokens.spacing.cardPadding,
                className
            )}
        >
            <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 overflow-hidden ring-2 ring-white/5">
                    {avatar ? (
                        <img src={avatar} alt={name} className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-white font-bold text-lg">
                            {name?.charAt(0).toUpperCase() || "?"}
                        </span>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                        <h3 className="font-bold text-foreground text-lg truncate tracking-tight group-hover:text-white transition-colors duration-300">
                            {name || "Unknown User"}
                        </h3>
                        {timestamp && (
                            <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider">
                                {timestamp}
                            </p>
                        )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate flex items-center gap-2 group-hover:text-muted-foreground/80 transition-colors duration-300">
                        {unreadCount > 0 && <span className="w-2 h-2 rounded-full bg-primary inline-block" />}
                        Click to view messages
                    </p>
                </div>

                {/* Right side: Unread badge + Chevron */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    {unreadCount > 0 && (
                        <div className="bg-primary text-white shadow-[0_0_10px_rgba(var(--primary),0.5)] rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                            {unreadCount}
                        </div>
                    )}
                    <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-muted-foreground group-hover:border-white/30 group-hover:text-foreground transition-colors">
                        <ChevronRight className="w-4 h-4" />
                    </div>
                </div>
            </div>
        </Card>
    );
}
