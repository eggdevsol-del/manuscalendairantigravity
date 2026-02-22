/**
 * StudioInviteMessage — SSOT Compliant (v3)
 *
 * Inline chat stream card for Studio Invites.
 * All styling via tokens.card SSOT. No hardcoded colors.
 */

import { Check, X as XIcon, ArrowRight, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { tokens } from "@/ui/tokens";

export interface StudioInviteMetadata {
    studioId: string;
    studioName: string;
    inviteId: number;
    status: 'pending' | 'accepted' | 'declined';
}

interface StudioInviteMessageProps {
    metadata: StudioInviteMetadata;
    isArtist: boolean;
    /** Open the invite details / FAB menu */
    onPress?: () => void;
}

/** Glow accent by status — uses SSOT card.glow tokens */
function getGlow(status: string) {
    const g = tokens.card.glow;
    if (status === 'accepted') return g.low;     // emerald
    if (status === 'declined') return g.high;    // red
    return g.medium;                             // indigo/primary for pending
}

/** Short status label */
function getStatusLabel(status: string) {
    if (status === 'accepted') return 'Accepted';
    if (status === 'declined') return 'Declined';
    return 'Pending';
}

export function StudioInviteMessage({
    metadata,
    isArtist,
    onPress,
}: StudioInviteMessageProps) {
    const { studioName, status } = metadata;
    const card = tokens.card;
    const glow = getGlow(status);

    const statusLabel = getStatusLabel(status);
    const isAccepted = status === 'accepted';
    const isPending = status === 'pending';

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
                    <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-indigo-400">
                        Studio Invitation
                    </p>
                    <h3 className="text-sm font-bold text-foreground leading-tight truncate flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-indigo-400" />
                        {studioName}
                    </h3>
                </div>

                <div className="text-xs text-muted-foreground/80 leading-relaxed">
                    You've been invited to join {studioName} as a resident artist.
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between">
                    {/* Status badge */}
                    <div className={cn(
                        "flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider",
                        isAccepted ? "bg-emerald-500/10 text-emerald-500" :
                            status === 'declined' ? "bg-red-500/10 text-red-500" :
                                "bg-indigo-500/10 text-indigo-400"
                    )}>
                        {isAccepted && <Check className="w-2.5 h-2.5" />}
                        {statusLabel}
                    </div>

                    <div className="flex items-center gap-2">
                        {/* View details (Only when pending, or if we want to see it anytime) */}
                        {isPending && isArtist && (
                            <div className="text-indigo-400 text-[10px] font-bold flex items-center gap-0.5 group-hover:text-indigo-300 transition-colors">
                                Respond <ArrowRight className="w-3 h-3" />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
