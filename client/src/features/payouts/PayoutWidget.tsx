/**
 * PayoutWidget — Presentational Component
 *
 * Props-only, stateless, unaware of tRPC or routing.
 * Shows next payout amount, status badge, arrival date, and earnings summary.
 */

import {
    Banknote,
    TrendingUp,
    Clock,
    ArrowUpRight,
    AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { tokens } from "@/ui/tokens";

export interface PayoutWidgetProps {
    connected: boolean;
    pendingAmountCents: number;
    availableAmountCents?: number;
    nextPayoutAmountCents: number | null;
    nextPayoutArrivalDate: string | null;
    nextPayoutStatus: string | null;
    currency: string;
    error?: string;
    // Earnings summary (optional, from earningsBreakdown)
    earnings?: {
        period: string;
        grossCents: number;
        platformFeeCents: number;
        artistFeeCents: number;
        netCents: number;
        refundsCents: number;
        transactionCount: number;
    };
    onViewHistory?: () => void;
    onConnectStripe?: () => void;
}

function formatCents(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString("en-AU", {
        weekday: "short",
        day: "numeric",
        month: "short",
    });
}

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, { bg: string; text: string; label: string }> = {
        pending: {
            bg: "bg-amber-500/20",
            text: "text-amber-400",
            label: "Pending",
        },
        in_transit: {
            bg: "bg-blue-500/20",
            text: "text-blue-400",
            label: "In Transit",
        },
        paid: {
            bg: "bg-emerald-500/20",
            text: "text-emerald-400",
            label: "Paid",
        },
        failed: {
            bg: "bg-red-500/20",
            text: "text-red-400",
            label: "Failed",
        },
        canceled: {
            bg: "bg-gray-500/20",
            text: "text-gray-400",
            label: "Cancelled",
        },
    };

    const style = map[status] || map.pending;

    return (
        <span
            className={cn(
                "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest",
                style.bg,
                style.text
            )}
        >
            {style.label}
        </span>
    );
}

export function PayoutWidget({
    connected,
    pendingAmountCents,
    availableAmountCents,
    nextPayoutAmountCents,
    nextPayoutArrivalDate,
    nextPayoutStatus,
    error,
    earnings,
    onViewHistory,
    onConnectStripe,
}: PayoutWidgetProps) {
    // Not connected state
    if (!connected) {
        return (
            <div
                className={cn(
                    tokens.card.base,
                    tokens.card.bg,
                    "border-0 p-5 space-y-3"
                )}
            >
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400">
                        <Banknote className="w-5 h-5" />
                    </div>
                    <h3 className="font-semibold text-foreground">Payouts</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                    Connect Stripe to start receiving automatic payouts from client
                    payments.
                </p>
                {onConnectStripe && (
                    <button
                        onClick={onConnectStripe}
                        className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
                    >
                        Connect Stripe
                    </button>
                )}
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div
                className={cn(
                    tokens.card.base,
                    tokens.card.bg,
                    "border-0 p-5 space-y-3"
                )}
            >
                <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-400" />
                    <span className="text-sm text-amber-400">{error}</span>
                </div>
            </div>
        );
    }

    return (
        <div
            className={cn(
                tokens.card.base,
                tokens.card.bg,
                "border-0 p-5 space-y-4"
            )}
        >
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                        <Banknote className="w-5 h-5" />
                    </div>
                    <h3 className="font-semibold text-foreground">Payouts</h3>
                </div>
                {onViewHistory && (
                    <button
                        onClick={onViewHistory}
                        className="text-xs text-primary flex items-center gap-1 hover:underline"
                    >
                        History <ArrowUpRight className="w-3 h-3" />
                    </button>
                )}
            </div>

            {/* Balance Summary */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 rounded-xl p-4">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1">
                        Available for Withdrawal
                    </p>
                    <p className="text-xl font-bold text-emerald-400 tabular-nums">
                        {formatCents(availableAmountCents ?? 0)}
                    </p>
                </div>
                <div className="bg-white/5 rounded-xl p-4">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1">
                        Pending
                    </p>
                    <p className="text-xl font-bold text-foreground tabular-nums">
                        {formatCents(pendingAmountCents)}
                    </p>
                </div>
            </div>
        </div>
    );
}
