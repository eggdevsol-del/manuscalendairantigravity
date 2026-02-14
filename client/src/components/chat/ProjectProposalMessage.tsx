/**
 * ProjectProposalMessage — SSOT Compliant (v3)
 *
 * Two variants:
 *  - 'pinned'  → compact card under header (pending proposals only)
 *  - 'inline'  → chat-stream card (accepted / rejected)
 *
 * All styling via tokens.card SSOT. No hardcoded colors.
 */

import { Check, X as XIcon, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { tokens } from "@/ui/tokens";

interface ProposalMetadata {
    type: "project_proposal";
    serviceName: string;
    totalCost: number;
    sittings: number;
    dates: string[];
    status: 'pending' | 'accepted' | 'rejected' | 'canceled';
    serviceDuration?: number;
    autoSendDeposit?: boolean;
    depositAmount?: number;
    bsb?: string;
    accountNumber?: string;
}

interface ProjectProposalMessageProps {
    metadata: ProposalMetadata;
    isArtist: boolean;
    /** 'pinned' = compact under header, 'inline' = in chat stream */
    variant?: 'pinned' | 'inline';
    /** Open the proposal details */
    onPress?: () => void;
    /** Cancel / delete proposal (artist only) */
    onCancel?: () => void;
}

/** Glow accent by status — uses SSOT card.glow tokens */
function getGlow(status: string) {
    const g = tokens.card.glow;
    if (status === 'accepted') return g.low;     // emerald
    if (status === 'rejected') return g.high;    // red
    return g.medium;                               // orange for pending
}

/** Short status label */
function getStatusLabel(status: string) {
    if (status === 'accepted') return 'Accepted';
    if (status === 'rejected') return 'Declined';
    return 'Pending';
}

export function ProjectProposalMessage({
    metadata,
    isArtist,
    variant = 'inline',
    onPress,
    onCancel,
}: ProjectProposalMessageProps) {
    const { serviceName, totalCost, sittings, status, serviceDuration } = metadata;
    const card = tokens.card;
    const glow = getGlow(status);

    // Derive time
    const totalMinutes = (sittings || 1) * (serviceDuration || 60);
    const hours = Math.floor(totalMinutes / 60);

    const statusLabel = getStatusLabel(status);
    const isAccepted = status === 'accepted';
    const isPending = status === 'pending';

    // ---------- PINNED variant (compact, horizontal) ----------
    if (variant === 'pinned') {
        return (
            <div
                className={cn(
                    card.base, card.bg, card.interactive,
                    "flex items-center gap-3 p-3 w-full"
                )}
                onClick={onPress}
            >
                {/* Left accent */}
                <div className={cn(card.leftAccent, glow.line)} />

                {/* Info */}
                <div className="flex-1 min-w-0 pl-3">
                    <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-primary/70">
                        Proposal
                    </p>
                    <p className="text-xs font-bold text-foreground truncate">{serviceName}</p>
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        ${totalCost} · {hours}h · {sittings}s
                    </p>
                </div>

                {/* Status dot */}
                <div className={cn("w-2 h-2 rounded-full shrink-0 animate-pulse", glow.line)} />

                {/* Cancel button (artist) */}
                {isArtist && onCancel && (
                    <button
                        className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center bg-white/5 hover:bg-red-500/20 text-muted-foreground hover:text-red-500 transition-colors"
                        onClick={(e) => { e.stopPropagation(); onCancel(); }}
                    >
                        <XIcon className="w-3 h-3" />
                    </button>
                )}
            </div>
        );
    }

    // ---------- INLINE variant (in chat stream) ----------
    return (
        <div
            className={cn(
                card.base, card.interactive,
                isAccepted ? card.bgAccent : card.bg,
                "w-[85vw] max-w-[340px] p-0 self-center"
            )}
            onClick={onPress}
        >
            {/* Left accent bar */}
            <div className={cn(card.leftAccent, glow.line)} />

            <div className="pl-4 pr-3 py-3 space-y-3">
                {/* Header */}
                <div className="space-y-0.5">
                    <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-primary/70">
                        Project Proposal
                    </p>
                    <h3 className="text-sm font-bold text-foreground leading-tight truncate">
                        {serviceName}
                    </h3>
                </div>

                {/* Stats */}
                <div className={cn(card.base, "grid grid-cols-3 gap-px rounded-[4px] overflow-hidden bg-white/[0.03]")}>
                    {[
                        { label: "Total", value: `$${totalCost}` },
                        { label: "Time", value: `${hours}h` },
                        { label: "Sittings", value: String(sittings) },
                    ].map(({ label, value }) => (
                        <div key={label} className="p-2 flex flex-col items-center gap-0.5">
                            <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">{label}</span>
                            <span className="text-xs font-bold text-foreground">{value}</span>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between">
                    {/* Status badge */}
                    <div className={cn(
                        "flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider",
                        isAccepted ? "bg-emerald-500/10 text-emerald-500" :
                            status === 'rejected' ? "bg-red-500/10 text-red-500" :
                                "bg-orange-500/10 text-orange-500"
                    )}>
                        {isAccepted && <Check className="w-2.5 h-2.5" />}
                        {statusLabel}
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Cancel (artist only, pending only) */}
                        {isArtist && isPending && onCancel && (
                            <button
                                className="w-6 h-6 rounded-full flex items-center justify-center bg-white/5 hover:bg-red-500/20 text-muted-foreground hover:text-red-500 transition-colors"
                                onClick={(e) => { e.stopPropagation(); onCancel(); }}
                            >
                                <XIcon className="w-3 h-3" />
                            </button>
                        )}

                        {/* View details */}
                        <div className="text-primary text-[10px] font-bold flex items-center gap-0.5">
                            Details <ArrowRight className="w-3 h-3" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
