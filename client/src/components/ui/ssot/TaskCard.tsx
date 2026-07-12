import { Card } from "../card";
/**
 * UI SINGLE SOURCE OF TRUTH (SSOT)
 * -------------------------------
 * TaskCard is the canonical card component for Dashboard tasks.
 * This file is part of the core UI primitives. Changes to gradients, blur,
 * radius, or core styling MUST happen here.
 * DO NOT OVERRIDE STYLES IN PAGE COMPONENTS.
 *
 * Card Dimensions (SSOT):
 * - Border radius: rounded-2xl (1rem / 16px)
 * - Padding: p-4 (1rem / 16px)
 * - Background: bg-secondary/50 with hover:bg-secondary/50
 * - Border: border-0 (no border)
 */
import { tokens } from "@/ui/tokens";
import { cn } from "@/lib/utils";
import { Check, ChevronRight, ChevronDown, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface TaskCardAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  className?: string;
}

export interface TaskCardProps {
  title: string;
  context?: string;
  priority: "high" | "medium" | "low";
  status: "pending" | "completed" | "snoozed" | "dismissed";
  actionType: "none" | "email" | "sms" | "social" | "internal";
  onClick?: () => void;
  /** Whether this card is currently expanded */
  isExpanded?: boolean;
  /** LLM conversation summary to display when expanded */
  conversationSummary?: string | null;
  /** Client name for the summary header */
  clientName?: string;
  /** Action buttons to render when expanded */
  actions?: TaskCardAction[];
}

export function TaskCard({
  title,
  context,
  priority,
  status,
  actionType,
  onClick,
  isExpanded = false,
  conversationSummary,
  clientName,
  actions,
}: TaskCardProps) {
  // SSOT Rules:
  // - Left-edge glow for priority (not full-card tint)
  // - Red = urgent, Orange = time-sensitive, Green = maintenance
  // - Neutral translucent background

  const priorityConfig = tokens.card.glow[priority];

  return (
    <Card
      onClick={onClick}
      className={cn(
        tokens.card.base,
        tokens.card.bg,
        tokens.card.interactive,
        tokens.spacing.cardPadding,
        isExpanded && "ring-1 ring-primary/20"
      )}
    >
      {/* Priority Indicator: Left Edge Line */}
      <div className={cn(tokens.card.leftAccent, priorityConfig.line)} />

      {/* Priority Indicator: Soft Gradient Swath (20%) */}
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-[20%] bg-gradient-to-r to-transparent pointer-events-none",
          priorityConfig.gradient
        )}
      />
      <div className="flex items-center gap-4 z-10 relative">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-foreground text-lg leading-tight mb-1 group-hover:text-white transition-colors duration-300">
            {title}
          </h3>
          {context && (
            <p className="text-sm text-muted-foreground leading-relaxed group-hover:text-muted-foreground/80 transition-colors duration-300">
              {context}
            </p>
          )}
        </div>

        {/* Right Chevron / Check */}
        <div className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground group-hover:border-border group-hover:text-foreground transition-colors">
          {status === "completed" ? (
            <Check className="w-4 h-4 text-[var(--color-success)]" />
          ) : isExpanded ? (
            <ChevronDown className="w-4 h-4 text-primary" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </div>
      </div>

      {/* Expandable Section */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            className="overflow-hidden z-10 relative"
          >
            <div className="pt-3 space-y-3">
              {/* Conversation Brief */}
              {conversationSummary && (
                <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
                  <div className="flex items-start gap-2">
                    <MessageSquare className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-foreground mb-0.5">
                        {clientName || "Client"} — Conversation
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {conversationSummary}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {actions && actions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {actions.map(action => (
                    <button
                      key={action.id}
                      onClick={e => {
                        e.stopPropagation();
                        action.onClick();
                      }}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium",
                        "bg-secondary/80 hover:bg-secondary active:scale-95",
                        "border border-border/50 transition-all duration-150",
                        action.className
                      )}
                    >
                      <action.icon className="w-3.5 h-3.5" />
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

