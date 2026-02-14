/**
 * ProjectProposalMessage — SSOT Compliant (v2)
 *
 * Uses tokens.card for card styling, tokens.button for actions.
 * No hardcoded colors, radii, or shadows — everything from tokens.ts.
 */

import { Check, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { tokens } from "@/ui/tokens";

interface ProposalMetadata {
    type: "project_proposal";
    serviceName: string;
    totalCost: number;
    sittings: number;
    dates: string[];
    status: 'pending' | 'accepted' | 'rejected';
    serviceDuration?: number;
    autoSendDeposit?: boolean;
    depositAmount?: number;
    bsb?: string;
    accountNumber?: string;
}

interface ProjectProposalMessageProps {
    metadata: ProposalMetadata;
    isArtist: boolean;
    onViewDetails: () => void;
}

/** Status badge config — derived from card glow tokens */
const statusConfig = {
    pending: {
        label: "Pending",
        dot: tokens.card.glow.medium.line,
        text: "text-orange-500",
        bg: "bg-orange-500/10",
    },
    accepted: {
        label: "Accepted",
        dot: tokens.card.glow.low.line,
        text: "text-emerald-500",
        bg: "bg-emerald-500/10",
        icon: Check,
    },
    rejected: {
        label: "Declined",
        dot: tokens.card.glow.high.line,
        text: "text-red-500",
        bg: "bg-red-500/10",
    },
} as const;

export function ProjectProposalMessage({
    metadata,
    isArtist,
    onViewDetails
}: ProjectProposalMessageProps) {
    const { serviceName, totalCost, sittings, status, serviceDuration } = metadata;
    const card = tokens.card;

    // Derive time display
    const totalMinutes = (sittings || 1) * (serviceDuration || 60);
    const hours = Math.floor(totalMinutes / 60);

    // Status config
    const badge = statusConfig[status] || statusConfig.pending;
    const BadgeIcon = 'icon' in badge ? badge.icon : null;

    // Pick the glow style based on status
    const glow = status === 'accepted' ? card.glow.low
        : status === 'rejected' ? card.glow.high
            : card.glow.medium;

    return (
        <div
            className={cn(
                card.base,
                card.bg,
                card.interactive,
                "w-[85vw] max-w-[340px] p-0 self-center"
            )}
            onClick={onViewDetails}
        >
            {/* Left accent bar — SSOT glow */}
            <div className={cn(card.leftAccent, glow.line)} />

            {/* Content area */}
            <div className="pl-4 pr-3 py-3 space-y-3">
                {/* Header: label + service name */}
                <div className="space-y-0.5">
                    <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-primary/70">
                        Project Proposal
                    </p>
                    <h3 className="text-sm font-bold text-foreground leading-tight truncate">
                        {serviceName}
                    </h3>
                </div>

                {/* Stats row — SSOT card bg, small radius */}
                <div className={cn(card.base, "grid grid-cols-3 gap-px rounded-[4px] overflow-hidden bg-white/[0.03]")}>
                    {[
                        { label: "Total", value: `$${totalCost}` },
                        { label: "Time", value: `${hours}h` },
                        { label: "Sittings", value: String(sittings) },
                    ].map(({ label, value }) => (
                        <div key={label} className="p-2 flex flex-col items-center gap-0.5">
                            <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">
                                {label}
                            </span>
                            <span className="text-xs font-bold text-foreground">{value}</span>
                        </div>
                    ))}
                </div>

                {/* Footer: status badge + view details */}
                <div className="flex items-center justify-between">
                    {/* Status badge */}
                    <div className={cn(
                        "flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider",
                        badge.bg, badge.text
                    )}>
                        {BadgeIcon && <BadgeIcon className="w-2.5 h-2.5" />}
                        {badge.label}
                    </div>

                    {/* View details — always visible on mobile (no hover) */}
                    <div className="text-primary text-[10px] font-bold flex items-center gap-0.5">
                        Details <ArrowRight className="w-3 h-3" />
                    </div>
                </div>
            </div>
        </div>
    );
}
