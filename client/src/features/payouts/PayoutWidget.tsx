/**
 * PayoutWidget — Presentational Component
 *
 * Props-only, stateless, unaware of tRPC or routing.
 * Shows next payout amount, status badge, arrival date, and earnings summary.
 * Optionally renders an inline scrollable transaction list.
 */

import {
    Banknote,
    TrendingUp,
    Clock,
    ArrowUpRight,
    ArrowDownLeft,
    AlertCircle,
    ChevronDown,
    ChevronUp,
    Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { tokens } from "@/ui/tokens";
import { AnimatePresence, motion } from "framer-motion";

export interface TransactionEntry {
    id: number;
    type: string;
    amountCents: number;
    netCents: number;
    createdAt: string;
    paymentMethod?: string;
    clientName?: string | null;
}

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
    // Inline transaction list
    showTransactions?: boolean;
    transactions?: TransactionEntry[];
    isLoadingTransactions?: boolean;
    onToggleTransactions?: () => void;
    onViewHistory?: () => void;
    onConnectStripe?: () => void;
    onRefundRequest?: (transaction: TransactionEntry) => void;
}

function formatCents(cents: number): string {
    return `$${(Math.abs(cents) / 100).toFixed(2)}`;
}

function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString("en-AU", {
        day: "numeric",
        month: "short",
    });
}

function formatTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-AU", {
        hour: "2-digit",
        minute: "2-digit",
    });
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
    showTransactions,
    transactions,
    isLoadingTransactions,
    onToggleTransactions,
    onViewHistory,
    onConnectStripe,
    onRefundRequest,
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
                {onToggleTransactions && (
                    <button
                        onClick={onToggleTransactions}
                        className="text-xs text-primary flex items-center gap-1 hover:underline transition-colors"
                    >
                        History
                        {showTransactions ? (
                            <ChevronUp className="w-3 h-3" />
                        ) : (
                            <ChevronDown className="w-3 h-3" />
                        )}
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

            {/* Inline Transaction List */}
            <AnimatePresence>
                {showTransactions && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="overflow-hidden"
                    >
                        <div className="border-t border-white/5 pt-3">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                                Recent Transactions
                            </p>

                            {isLoadingTransactions && (
                                <div className="flex items-center justify-center py-6">
                                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                                </div>
                            )}

                            {!isLoadingTransactions && transactions && transactions.length === 0 && (
                                <div className="flex flex-col items-center py-6 text-center">
                                    <Banknote className="w-8 h-8 text-muted-foreground/20 mb-2" />
                                    <p className="text-xs text-muted-foreground/50">
                                        No transactions yet
                                    </p>
                                </div>
                            )}

                            {!isLoadingTransactions && transactions && transactions.length > 0 && (
                                <div className="max-h-[240px] overflow-y-auto no-scrollbar divide-y divide-white/5 rounded-lg bg-white/[0.02]">
                                    {transactions.map((entry) => {
                                        const isIncome =
                                            ["deposit", "balance", "store_order"].includes(entry.type);
                                        return (
                                            <div
                                                key={entry.id}
                                                className="flex items-center justify-between px-3 py-2.5 hover:bg-white/5 transition-colors"
                                            >
                                                <div className="flex items-center gap-2.5">
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
                                                            <ArrowDownLeft className="w-3 h-3" />
                                                        ) : (
                                                            <ArrowUpRight className="w-3 h-3" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-medium text-foreground capitalize">
                                                            {entry.type}{entry.clientName ? ` · ${entry.clientName}` : ""}
                                                        </p>
                                                        <p className="text-[9px] text-muted-foreground">
                                                            {entry.createdAt
                                                                ? `${formatDate(entry.createdAt)} · ${formatTime(entry.createdAt)}`
                                                                : ""}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p
                                                        className={cn(
                                                            "text-xs font-bold tabular-nums",
                                                            isIncome
                                                                ? "text-emerald-400"
                                                                : "text-red-400"
                                                        )}
                                                    >
                                                        {isIncome ? "+" : "-"}
                                                        {formatCents(entry.amountCents)}
                                                    </p>
                                                    <p className="text-[9px] text-muted-foreground tabular-nums">
                                                        Net: {formatCents(entry.netCents)}
                                                    </p>
                                                    {isIncome && (entry as any).stripePaymentId && onRefundRequest && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onRefundRequest(entry);
                                                            }}
                                                            className="text-[9px] font-medium text-red-400 hover:text-red-300 hover:underline transition-colors mt-0.5"
                                                        >
                                                            Refund
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* View Full History link */}
                            {onViewHistory && transactions && transactions.length > 0 && (
                                <button
                                    onClick={onViewHistory}
                                    className="w-full mt-2 py-2 text-[10px] font-bold text-primary uppercase tracking-widest hover:underline flex items-center justify-center gap-1 transition-colors"
                                >
                                    View Full History
                                    <ArrowUpRight className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
