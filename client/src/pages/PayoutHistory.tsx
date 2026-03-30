/**
 * PayoutHistory Page — Full list of payouts and ledger entries
 */

import { useState } from "react";
import {
    ArrowLeft,
    Banknote,
    ArrowUpRight,
    ArrowDownLeft,
    AlertTriangle,
    Clock,
    CheckCircle2,
    Loader2,
} from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { tokens } from "@/ui/tokens";
import { PageShell, PageHeader, LoadingState } from "@/components/ui/ssot";

function formatCents(cents: number): string {
    return `$${(Math.abs(cents) / 100).toFixed(2)}`;
}

function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString("en-AU", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

function formatTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-AU", {
        hour: "2-digit",
        minute: "2-digit",
    });
}

type Period = "7d" | "30d" | "90d" | "all";

export default function PayoutHistory() {
    const [, setLocation] = useLocation();
    const [period, setPeriod] = useState<Period>("30d");

    const historyQuery = trpc.payouts.payoutHistory.useQuery({ limit: 50 });
    const earningsQuery = trpc.payouts.earningsBreakdown.useQuery({ period });

    if (historyQuery.isLoading) {
        return <LoadingState message="Loading payout history..." fullScreen />;
    }

    const history = historyQuery.data;
    const earnings = earningsQuery.data;

    // Determine which data source to show
    const hasStripePayouts =
        history?.connected && (history?.payouts?.length || 0) > 0;
    const hasLedgerEntries = (history?.entries?.length || 0) > 0;

    return (
        <PageShell>
            <PageHeader title="Payout History" />

            <div className={tokens.contentContainer.base}>
                <div className="flex-1 w-full px-4 pt-4 overflow-y-auto mobile-scroll touch-pan-y">
                    <div className="pb-32 max-w-2xl mx-auto space-y-6">
                        {/* Back button */}
                        <button
                            onClick={() => setLocation("/settings")}
                            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to Settings
                        </button>

                        {/* Period Selector + Earnings Summary */}
                        <div
                            className={cn(
                                tokens.card.base,
                                tokens.card.bg,
                                "border-0 p-5 space-y-4"
                            )}
                        >
                            <div className="flex items-center justify-between">
                                <h2 className="font-semibold text-foreground flex items-center gap-2">
                                    <Banknote className="w-5 h-5 text-emerald-400" />
                                    Earnings Summary
                                </h2>
                                <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
                                    {(["7d", "30d", "90d", "all"] as Period[]).map((p) => (
                                        <button
                                            key={p}
                                            onClick={() => setPeriod(p)}
                                            className={cn(
                                                "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors",
                                                period === p
                                                    ? "bg-primary text-primary-foreground"
                                                    : "text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            {p === "all" ? "All" : p}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {earnings && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-white/5 rounded-lg p-3">
                                        <p className="text-[10px] text-muted-foreground uppercase">
                                            Gross Revenue
                                        </p>
                                        <p className="text-lg font-bold text-foreground tabular-nums">
                                            {formatCents(earnings.grossCents)}
                                        </p>
                                    </div>
                                    <div className="bg-emerald-500/10 rounded-lg p-3 border border-emerald-500/20">
                                        <p className="text-[10px] text-emerald-400 uppercase font-bold">
                                            Net Earnings
                                        </p>
                                        <p className="text-lg font-bold text-emerald-400 tabular-nums">
                                            {formatCents(earnings.netCents)}
                                        </p>
                                    </div>
                                    <div className="bg-white/5 rounded-lg p-3">
                                        <p className="text-[10px] text-muted-foreground uppercase">
                                            Platform Fees
                                        </p>
                                        <p className="text-sm font-medium text-muted-foreground tabular-nums">
                                            -{formatCents(earnings.platformFeeCents)}
                                        </p>
                                    </div>
                                    <div className="bg-white/5 rounded-lg p-3">
                                        <p className="text-[10px] text-muted-foreground uppercase">
                                            Artist Fees
                                        </p>
                                        <p className="text-sm font-medium text-muted-foreground tabular-nums">
                                            -{formatCents(earnings.artistFeeCents)}
                                        </p>
                                    </div>
                                    {earnings.refundsCents > 0 && (
                                        <div className="col-span-2 bg-red-500/10 rounded-lg p-3 border border-red-500/20">
                                            <p className="text-[10px] text-red-400 uppercase">
                                                Refunds
                                            </p>
                                            <p className="text-sm font-medium text-red-400 tabular-nums">
                                                -{formatCents(earnings.refundsCents)}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Stripe Payouts List */}
                        {hasStripePayouts && (
                            <div
                                className={cn(
                                    tokens.card.base,
                                    tokens.card.bg,
                                    "border-0 overflow-hidden"
                                )}
                            >
                                <div className="p-4 border-b border-white/5">
                                    <h3 className="font-semibold text-foreground text-sm">
                                        Payouts
                                    </h3>
                                </div>
                                <div className="divide-y divide-white/5">
                                    {history!.payouts.map((payout: any) => (
                                        <div
                                            key={payout.id}
                                            className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className={cn(
                                                        "p-2 rounded-xl",
                                                        payout.status === "paid"
                                                            ? "bg-emerald-500/20 text-emerald-400"
                                                            : payout.status === "failed"
                                                                ? "bg-red-500/20 text-red-400"
                                                                : "bg-amber-500/20 text-amber-400"
                                                    )}
                                                >
                                                    {payout.status === "paid" ? (
                                                        <CheckCircle2 className="w-4 h-4" />
                                                    ) : payout.status === "failed" ? (
                                                        <AlertTriangle className="w-4 h-4" />
                                                    ) : (
                                                        <Clock className="w-4 h-4" />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-foreground">
                                                        {formatCents(payout.amountCents)}
                                                    </p>
                                                    <p className="text-[10px] text-muted-foreground">
                                                        {formatDate(payout.arrivalDate)}
                                                    </p>
                                                </div>
                                            </div>
                                            <span
                                                className={cn(
                                                    "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest",
                                                    payout.status === "paid"
                                                        ? "bg-emerald-500/20 text-emerald-400"
                                                        : payout.status === "failed"
                                                            ? "bg-red-500/20 text-red-400"
                                                            : "bg-amber-500/20 text-amber-400"
                                                )}
                                            >
                                                {payout.status}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Ledger Entries (fallback or supplementary) */}
                        {hasLedgerEntries && (
                            <div
                                className={cn(
                                    tokens.card.base,
                                    tokens.card.bg,
                                    "border-0 overflow-hidden"
                                )}
                            >
                                <div className="p-4 border-b border-white/5">
                                    <h3 className="font-semibold text-foreground text-sm">
                                        Transaction History
                                    </h3>
                                </div>
                                <div className="divide-y divide-white/5">
                                    {history!.entries.map((entry: any) => {
                                        const isIncome =
                                            entry.type === "deposit" || entry.type === "balance";
                                        return (
                                            <div
                                                key={entry.id}
                                                className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className={cn(
                                                            "p-1.5 rounded-lg",
                                                            isIncome
                                                                ? "bg-emerald-500/20 text-emerald-400"
                                                                : entry.type === "refund"
                                                                    ? "bg-red-500/20 text-red-400"
                                                                    : "bg-amber-500/20 text-amber-400"
                                                        )}
                                                    >
                                                        {isIncome ? (
                                                            <ArrowDownLeft className="w-3.5 h-3.5" />
                                                        ) : (
                                                            <ArrowUpRight className="w-3.5 h-3.5" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-foreground capitalize">
                                                            {entry.type}
                                                        </p>
                                                        <p className="text-[10px] text-muted-foreground">
                                                            {entry.createdAt
                                                                ? `${formatDate(entry.createdAt)} · ${formatTime(entry.createdAt)}`
                                                                : ""}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p
                                                        className={cn(
                                                            "text-sm font-bold tabular-nums",
                                                            isIncome
                                                                ? "text-emerald-400"
                                                                : "text-red-400"
                                                        )}
                                                    >
                                                        {isIncome ? "+" : "-"}
                                                        {formatCents(entry.amountCents)}
                                                    </p>
                                                    <p className="text-[10px] text-muted-foreground">
                                                        Net: {formatCents(entry.netCents)}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Empty state */}
                        {!hasStripePayouts && !hasLedgerEntries && (
                            <div className="text-center py-12">
                                <Banknote className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                                <p className="text-muted-foreground">
                                    No payout history yet
                                </p>
                                <p className="text-xs text-muted-foreground/60 mt-1">
                                    Payouts will appear here once you receive client payments
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </PageShell>
    );
}
