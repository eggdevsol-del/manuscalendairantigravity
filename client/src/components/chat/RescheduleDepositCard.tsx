/**
 * RescheduleDepositCard — SSOT Compliant
 *
 * Renders in the chat stream when an appointment is rescheduled within
 * the artist's notice period, requiring a new deposit from the client.
 * Uses tokens.card SSOT for consistent styling.
 */

import { CalendarClock, ArrowRight, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { tokens } from "@/ui/tokens";

interface RescheduleDepositMetadata {
  type: "reschedule_deposit";
  appointmentId: number;
  originalDate: string;
  newDate: string;
  depositAmount: number;
  serviceName: string;
  forfeitedDepositAmount: number;
  status: "pending" | "confirmed";
}

interface RescheduleDepositCardProps {
  metadata: RescheduleDepositMetadata;
  isArtist: boolean;
  onPress?: () => void;
}

// — Selector: format date for display
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function RescheduleDepositCard({ metadata, isArtist, onPress }: RescheduleDepositCardProps) {
  const card = tokens.card;
  const isPending = metadata.status === "pending";
  const isConfirmed = metadata.status === "confirmed";
  const depositDollars = metadata.depositAmount.toFixed(2);

  const handleClick = () => {
    if (onPress && isPending && !isArtist) {
      onPress();
    }
  };

  return (
    <div
      className={cn(
        card.base,
        isPending && !isArtist ? card.interactive : "",
        "bg-gradient-to-r from-[var(--color-status-warning-bg)] to-amber-500/5 hover:from-amber-500/15 hover:to-amber-500/10",
        "w-[85vw] max-w-[340px] p-0 self-center"
      )}
      onClick={handleClick}
    >
      {/* Left accent bar — amber for reschedule/warning */}
      <div className={cn(card.leftAccent, "bg-[var(--color-status-warning-text)]")} />

      <div className="pl-4 pr-3 py-3 space-y-3">
        {/* Header */}
        <div className="space-y-0.5">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[var(--color-status-warning-text)]/80">
            Reschedule — New Deposit Required
          </p>
          <h3 className="text-sm font-bold text-foreground leading-tight truncate">
            {metadata.serviceName}
          </h3>
        </div>

        {/* Date Change Detail */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-secondary/50 border border-border">
          <CalendarClock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="text-[11px] text-muted-foreground font-medium">
            {formatDate(metadata.originalDate)}
          </span>
          <ArrowRight className="w-3 h-3 text-[var(--color-status-warning-text)] shrink-0" />
          <span className="text-[11px] text-foreground font-semibold">
            {formatDate(metadata.newDate)}
          </span>
        </div>

        {/* Body text */}
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Your appointment for <span className="font-semibold text-foreground">{metadata.serviceName}</span> has
          been moved. A new deposit is required to confirm.
        </p>

        {/* Amount Display */}
        <div
          className={cn(
            card.base,
            "flex items-center justify-center gap-3 rounded-md bg-secondary/50 py-3"
          )}
        >
          <AlertTriangle className="w-5 h-5 text-[var(--color-status-warning-text)]" />
          <span className="text-xl font-bold text-foreground">${depositDollars}</span>
        </div>

        {/* Footer — conditional on status */}
        <div className="flex items-center justify-between">
          {/* Status badge */}
          {isConfirmed ? (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-[var(--color-status-success-bg)] text-[var(--color-status-success-text)]">
              <CheckCircle2 className="w-2.5 h-2.5" />
              Deposit Paid
            </div>
          ) : (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-[var(--color-status-warning-bg)] text-[var(--color-status-warning-text)]">
              <AlertTriangle className="w-2.5 h-2.5" />
              Deposit Required
            </div>
          )}

          {/* Action area */}
          {isPending && !isArtist && (
            <div className="text-[var(--color-status-warning-text)] text-[10px] font-bold flex items-center gap-0.5">
              Pay Deposit <ArrowRight className="w-3 h-3" />
            </div>
          )}

          {isPending && isArtist && (
            <div className="text-muted-foreground text-[10px] font-medium">
              Awaiting client deposit
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
