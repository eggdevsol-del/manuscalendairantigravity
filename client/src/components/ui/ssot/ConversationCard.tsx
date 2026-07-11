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
 * - Background: bg-secondary/50 with hover:bg-secondary/50
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
  /** Subject line (for new requests) */
  subject?: string;
  /** Whether this is a new request */
  isNew?: boolean;
  /** Whether this card is currently selected (for split view) */
  isActive?: boolean;
  /** Whether this conversation is a studio invite */
  isStudioInvite?: boolean;
}

export function ConversationCard({
  name,
  avatar,
  timestamp,
  unreadCount = 0,
  onClick,
  className,
  subject,
  isNew,
  isActive,
  isStudioInvite,
}: ConversationCardProps) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        tokens.card.base,
        tokens.card.bg,
        tokens.card.interactive,
        tokens.spacing.cardPadding,
        tokens.spacing.cardPadding,
        isActive && "bg-primary/10 border-primary/50",
        isStudioInvite && "bg-[var(--color-status-info-bg)] border border-[var(--color-status-info-border)]",
        className
      )}
    >
      {isNew && !isStudioInvite && (
        <>
          {/* New Indicator: Left Edge Line (Emerald) */}
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--color-success)]" />
          {/* New Indicator: Soft Gradient Swath */}
          <div className="absolute left-0 top-0 bottom-0 w-[20%] bg-gradient-to-r from-[var(--color-status-success-bg)] to-transparent pointer-events-none" />
        </>
      )}

      {isStudioInvite && (
        <>
          {/* Studio Invite Indicator: Left Edge Line (Indigo) */}
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary" />
          {/* Studio Invite Indicator: Soft Gradient Swath */}
          <div className="absolute left-0 top-0 bottom-0 w-[20%] bg-gradient-to-r from-[var(--color-status-info-bg)] to-transparent pointer-events-none" />
        </>
      )}

      <div className="flex items-center gap-4 relative z-10">
        {/* Avatar */}
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center flex-shrink-0 overflow-hidden ring-2 ring-white/5">
          {avatar ? (
            <img
              src={avatar}
              alt={name}
              className="w-full h-full object-cover"
            />
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

          {subject ? (
            <p className="text-sm font-medium text-foreground/90 truncate flex items-center gap-2">
              {subject}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground truncate flex items-center gap-2 group-hover:text-muted-foreground/80 transition-colors duration-300">
              {unreadCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-primary inline-block" />
              )}
              Click to view messages
            </p>
          )}
        </div>

        {/* Right side: Unread badge / New badge + Chevron */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {isStudioInvite && (
            <div className="bg-[var(--color-status-info-bg)] text-[var(--color-status-info-text)] border border-[var(--color-status-info-border)] px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-[0_0_10px_rgba(var(--primary-rgb),0.15)]">
              Invite
            </div>
          )}
          {isNew && !isStudioInvite && (
            <div className="bg-[var(--color-status-success-bg)] text-[var(--color-status-success-text)] border border-[var(--color-status-success-border)] px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-[0_0_10px_rgba(var(--primary-rgb),0.15)]">
              New
            </div>
          )}

          {!isNew && unreadCount > 0 && (
            <div className="bg-primary text-white shadow-[0_0_10px_rgba(var(--primary),0.5)] rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
              {unreadCount}
            </div>
          )}
          <div className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground group-hover:border-border group-hover:text-foreground transition-colors">
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    </Card>
  );
}
