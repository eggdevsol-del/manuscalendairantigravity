/**
 * ProjectProposalMessage — SSOT Compliant (v4)
 *
 * Three variants:
 *  - 'pinned'   ? compact horizontal strip under the header (pending proposals only)
 *  - 'portrait' ? 3:4 portrait card inline in the chat stream (accepted / confirmed)
 *  - 'inline'   ? legacy wide chip (kept for backwards compat)
 *
 * All styling via tokens.card SSOT + clientDark SSOT. No hardcoded colors.
 */

import { Check, X as XIcon, ArrowRight, Calendar } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { tokens } from "@/ui/tokens";
import { clientDark } from "@/ui/clientTokens";

interface ProposalMetadata {
  type: "project_proposal";
  serviceName: string;
  totalCost: number;
  sittings: number;
  dates: string[];
  status: "pending" | "accepted" | "rejected" | "canceled" | "remittance_uploaded" | "confirmed";
  serviceDuration?: number;
  autoSendDeposit?: boolean;
  depositAmount?: number;
  bsb?: string;
  accountNumber?: string;
  isImported?: boolean;
  proposedDates?: string[];
}

interface ProjectProposalMessageProps {
  metadata: ProposalMetadata;
  isArtist: boolean;
  variant?: "pinned" | "portrait" | "inline";
  isFullyPaid?: boolean;
  onPress?: () => void;
  onCancel?: () => void;
}

function getGlow(status: string) {
  const g = tokens.card.glow;
  if (status === "accepted" || status === "remittance_uploaded" || status === "confirmed") return g.low;
  if (status === "rejected") return g.high;
  return g.medium;
}

function getStatusLabel(status: string, isFullyPaid?: boolean) {
  if (isFullyPaid) return "PAID IN FULL";
  if (status === "accepted") return "Accepted";
  if (status === "remittance_uploaded") return "Deposit Pending";
  if (status === "confirmed") return "Confirmed";
  if (status === "rejected") return "Declined";
  return "Pending";
}

function getAccentBar(status: string, isFullyPaid?: boolean) {
  if (isFullyPaid) return clientDark.proposalCard.accentConfirmed;
  if (status === "accepted" || status === "remittance_uploaded") return clientDark.proposalCard.accentAccepted;
  if (status === "confirmed") return clientDark.proposalCard.accentConfirmed;
  if (status === "rejected") return clientDark.proposalCard.accentDeclined;
  return clientDark.proposalCard.accentPending;
}

export function ProjectProposalMessage({
  metadata,
  isArtist,
  variant = "portrait",
  isFullyPaid,
  onPress,
  onCancel,
}: ProjectProposalMessageProps) {
  const { serviceName, totalCost, sittings, status, serviceDuration } = metadata;
  const card = tokens.card;

  const effectiveStatus = metadata.isImported ? "confirmed" : status;
  const glow = getGlow(effectiveStatus);

  const totalMinutes = (sittings || 1) * (serviceDuration || 60);
  const hours = Math.floor(totalMinutes / 60);

  const statusLabel = getStatusLabel(effectiveStatus, isFullyPaid);
  const isPending = effectiveStatus === "pending";
  const isSuccessState = ["accepted", "remittance_uploaded", "confirmed"].includes(effectiveStatus);

  const allDates = (metadata.dates?.length ? metadata.dates : metadata.proposedDates) ?? [];
  const firstDate = allDates[0] ? new Date(allDates[0]) : null;
  const formattedDate = firstDate ? format(firstDate, "EEE, MMM d") : null;
  const formattedTime = firstDate ? format(firstDate, "h:mm a") : null;
  const extraSessions = allDates.length > 1 ? allDates.length - 1 : 0;

  const badgeClass = isSuccessState || isFullyPaid
    ? "bg-[var(--color-status-success-bg)] text-[var(--color-status-success-text)]"
    : effectiveStatus === "rejected"
    ? "bg-[var(--color-status-danger-bg)] text-[var(--color-status-danger-text)]"
    : "bg-[var(--color-status-warning-bg)] text-[var(--color-status-warning-text)]";

  // -- PINNED ----------------------------------------------------------------
  if (variant === "pinned") {
    return (
      <div
        className={cn(card.base, card.bg, card.interactive, "flex items-center gap-3 p-3 w-full")}
        onClick={onPress}
      >
        <div className={cn(card.leftAccent, glow.line)} />
        <div className="flex-1 min-w-0 pl-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-primary/70">Proposal</p>
          <p className="text-xs font-bold text-foreground truncate">{serviceName}</p>
          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
            ${totalCost} · {hours}h · {sittings || 1}s
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {isFullyPaid ? (
            <div className="w-2 h-2 rounded-full bg-[var(--color-success)] flex items-center justify-center">
              <Check className="w-1.5 h-1.5 text-white" strokeWidth={4} />
            </div>
          ) : (
            <div className={cn("w-2 h-2 rounded-full", isPending && "animate-pulse", glow.line)} />
          )}
          <span className={cn(
            "text-[8px] font-bold uppercase tracking-wider",
            isSuccessState || isFullyPaid ? "text-[var(--color-status-success-text)]" : status === "rejected" ? "text-[var(--color-status-danger-text)]" : "text-[var(--color-status-warning-text)]"
          )}>
            {statusLabel}
          </span>
        </div>
        {isArtist && isPending && onCancel && (
          <button
            className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center bg-secondary/50 hover:bg-[var(--color-status-danger-bg)] text-muted-foreground hover:text-[var(--color-status-danger-text)] transition-colors"
            onClick={e => { e.stopPropagation(); onCancel(); }}
          >
            <XIcon className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  }

  // -- PORTRAIT (3:4) --------------------------------------------------------
  if (variant === "portrait") {
    const accentBar = getAccentBar(effectiveStatus, isFullyPaid);
    return (
      <div
        className={cn(
          clientDark.proposalCard.shell,
          "relative cursor-pointer select-none",
          "transition-transform duration-150 active:scale-[0.97]",
          "w-[min(80vw,_240px)] aspect-[3/4] flex flex-col",
        )}
        onClick={onPress}
      >
        {/* Status accent bar */}
        <div className={cn("h-[3px] w-full shrink-0 rounded-t-2xl", accentBar)} />

        <div className="flex-1 flex flex-col px-4 pt-3 pb-4 min-h-0 overflow-hidden">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-primary/60">
            Project Proposal
          </p>
          <h3 className="text-[15px] font-bold text-foreground leading-tight mt-1 line-clamp-2">
            {serviceName}
          </h3>

          {formattedDate && (
            <div className="mt-3 flex items-start gap-2">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-foreground leading-tight">{formattedDate}</p>
                {formattedTime && <p className="text-[10px] text-muted-foreground">{formattedTime}</p>}
                {extraSessions > 0 && (
                  <p className="text-[9px] text-muted-foreground/70 mt-0.5">
                    +{extraSessions} more session{extraSessions > 1 ? "s" : ""}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="mt-3 grid grid-cols-3 rounded-xl overflow-hidden border border-white/[0.06] divide-x divide-white/[0.06]">
            {[
              { label: "Total", value: `$${totalCost}` },
              { label: "Hours", value: `${hours}h` },
              { label: "Sessions", value: String(sittings || 1) },
            ].map(({ label, value }) => (
              <div key={label} className={cn(clientDark.proposalCard.statsCell, "px-1 py-2 flex flex-col items-center gap-0.5")}>
                <span className="text-[8px] text-muted-foreground uppercase tracking-wide font-medium">{label}</span>
                <span className="text-[11px] font-bold text-foreground">{value}</span>
              </div>
            ))}
          </div>

          <div className="flex-1" />

          <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/[0.06]">
            <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider", badgeClass)}>
              {(isSuccessState || isFullyPaid) && <Check className="w-2.5 h-2.5" />}
              {statusLabel}
            </div>
            <span className="text-[10px] font-bold text-primary flex items-center gap-0.5">
              View <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {isArtist && isPending && onCancel && (
          <button
            className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center bg-secondary/50 hover:bg-[var(--color-status-danger-bg)] text-muted-foreground hover:text-[var(--color-status-danger-text)] transition-colors z-10"
            onClick={e => { e.stopPropagation(); onCancel(); }}
          >
            <XIcon className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  }

  // -- INLINE (legacy) -------------------------------------------------------
  return (
    <div
      className={cn(card.base, card.interactive, isSuccessState ? card.bgAccent : card.bg, "w-[85vw] max-w-[340px] p-0 self-center")}
      onClick={onPress}
    >
      <div className={cn(card.leftAccent, glow.line)} />
      <div className="pl-4 pr-3 py-3 space-y-3">
        <div className="space-y-0.5">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-primary/70">Project Proposal</p>
          <h3 className="text-sm font-bold text-foreground leading-tight truncate">{serviceName}</h3>
        </div>
        <div className={cn(card.base, "grid grid-cols-3 gap-px rounded-md overflow-hidden bg-secondary/50")}>
          {[
            { label: "Total", value: `$${totalCost}` },
            { label: "Time", value: `${hours}h` },
            { label: "Sittings", value: String(sittings || 1) },
          ].map(({ label, value }) => (
            <div key={label} className="p-2 flex flex-col items-center gap-0.5">
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">{label}</span>
              <span className="text-xs font-bold text-foreground">{value}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider", badgeClass)}>
            {isSuccessState && <Check className="w-2.5 h-2.5" />}
            {statusLabel}
          </div>
          <div className="flex items-center gap-2">
            {isArtist && isPending && onCancel && (
              <button
                className="w-6 h-6 rounded-full flex items-center justify-center bg-secondary/50 hover:bg-[var(--color-status-danger-bg)] text-muted-foreground hover:text-[var(--color-status-danger-text)] transition-colors"
                onClick={e => { e.stopPropagation(); onCancel(); }}
              >
                <XIcon className="w-3 h-3" />
              </button>
            )}
            <div className="text-primary text-[10px] font-bold flex items-center gap-0.5">
              Details <ArrowRight className="w-3 h-3" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
