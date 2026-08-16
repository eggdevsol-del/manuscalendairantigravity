/**
 * MoneyTab — Earnings & Payout view for the redesigned dashboard.
 *
 * Sections:
 *  1. Net figure, fee breakdown, period selector
 *  2. Pending payout card with arrival date
 *  3. Transaction list with inline expand
 *
 * Data sources:
 *  - Earnings: trpc.payouts.earningsBreakdown
 *  - Next payout: trpc.payouts.nextPayout
 *  - Transaction list: trpc.payouts.payoutHistory
 */

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  Banknote,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertCircle,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { formatCents } from "@/lib/formatMoney";
import { useLocation } from "wouter";
import { format } from "date-fns";

// ── Types ─────────────────────────────────────────────────

type Period = "7d" | "30d" | "90d" | "all";
const PERIOD_LABELS: Record<Period, string> = {
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
  all: "All time",
};

interface MoneyTabProps {
  demoMode?: boolean;
}

// ── Component ─────────────────────────────────────────────

export function MoneyTab({ demoMode = false }: MoneyTabProps) {
  const [, setLocation] = useLocation();
  const [period, setPeriod] = useState<Period>("30d");
  const [showTransactions, setShowTransactions] = useState(false);

  // Earnings breakdown
  const earningsQuery = trpc.payouts.earningsBreakdown.useQuery(
    { period },
    { enabled: !demoMode }
  );

  // Next payout
  const payoutQuery = trpc.payouts.nextPayout.useQuery(undefined, {
    enabled: !demoMode,
  });

  // Transaction history
  const historyQuery = trpc.payouts.payoutHistory.useQuery(
    { limit: 20 },
    { enabled: !demoMode && showTransactions }
  );

  const earnings = earningsQuery.data;
  const payout = payoutQuery.data;
  const history = historyQuery.data;

  const isLoading = earningsQuery.isLoading || payoutQuery.isLoading;

  if (isLoading && !demoMode) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="rounded-2xl bg-secondary/30 h-40" />
        <div className="rounded-2xl bg-secondary/30 h-24" />
        <div className="rounded-2xl bg-secondary/30 h-16" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      {/* ── Earnings Summary ───────────────────────── */}
      <section className="rounded-2xl border border-border/30 bg-card p-5">
        {/* Period selector */}
        <div className="flex items-center gap-1.5 mb-4">
          {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "text-xs font-semibold px-3 py-1.5 rounded-full transition-all",
                period === p
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground/60 hover:text-muted-foreground hover:bg-secondary/50"
              )}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {earnings ? (
          <>
            {/* Net figure */}
            <div className="mb-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-1">
                Net Earnings
              </p>
              <p className="text-3xl font-bold tracking-tight">
                {formatCents(earnings.netCents)}
              </p>
              <p className="text-xs text-muted-foreground/50 mt-0.5">
                {earnings.transactionCount} transaction{earnings.transactionCount !== 1 ? "s" : ""} · {PERIOD_LABELS[period]}
              </p>
            </div>

            {/* Fee breakdown */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground/70 flex items-center gap-1.5">
                  <ArrowUpRight className="w-3.5 h-3.5 text-[var(--color-success)]" />
                  Gross
                </span>
                <span className="font-semibold">{formatCents(earnings.grossCents)}</span>
              </div>

              {earnings.platformFeeCents > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground/70 flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 flex items-center justify-center text-[10px]">%</span>
                    Platform fee
                  </span>
                  <span className="font-medium text-muted-foreground">
                    -{formatCents(earnings.platformFeeCents)}
                  </span>
                </div>
              )}

              {earnings.artistFeeCents > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground/70 flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 flex items-center justify-center text-[10px]">%</span>
                    Processing fee
                  </span>
                  <span className="font-medium text-muted-foreground">
                    -{formatCents(earnings.artistFeeCents)}
                  </span>
                </div>
              )}

              {earnings.refundsCents > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground/70 flex items-center gap-1.5">
                    <ArrowDownLeft className="w-3.5 h-3.5 text-[var(--color-status-danger-text)]" />
                    Refunds
                  </span>
                  <span className="font-medium text-[var(--color-status-danger-text)]">
                    -{formatCents(earnings.refundsCents)}
                  </span>
                </div>
              )}

              {/* Divider */}
              <div className="border-t border-border/20 pt-2 flex justify-between">
                <span className="font-semibold text-foreground/80">Net</span>
                <span className="font-bold text-foreground">{formatCents(earnings.netCents)}</span>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-6">
            <Wallet className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground/50">No earnings data</p>
          </div>
        )}
      </section>

      {/* ── Next Payout ────────────────────────────── */}
      {payout && (
        <section className="rounded-2xl border border-border/30 bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">
              {payout.connected ? "Next Payout" : "Pending Balance"}
            </h3>
            {payout.nextPayoutStatus && (
              <span className={cn(
                "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                payout.nextPayoutStatus === "paid"
                  ? "bg-[var(--color-success)]/10 text-[var(--color-success)]"
                  : payout.nextPayoutStatus === "pending"
                    ? "bg-primary/10 text-primary"
                    : "bg-secondary text-muted-foreground"
              )}>
                {payout.nextPayoutStatus}
              </span>
            )}
          </div>

          <div className="flex items-end justify-between">
            <div>
              <p className="text-2xl font-bold">
                {payout.nextPayoutAmountCents
                  ? formatCents(payout.nextPayoutAmountCents)
                  : formatCents(payout.pendingAmountCents)}
              </p>
              {payout.nextPayoutArrivalDate && (
                <p className="text-xs text-muted-foreground/50 mt-0.5 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Clears {format(new Date(payout.nextPayoutArrivalDate), "EEE d MMM")}
                </p>
              )}
            </div>

            {payout.connected && (
              <button
                onClick={() => setLocation("/payouts")}
                className="text-xs font-semibold text-primary flex items-center gap-1 hover:underline"
              >
                History
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {payout.error && (
            <div className="mt-3 flex items-center gap-2 text-xs text-[var(--color-status-danger-text)]">
              <AlertCircle className="w-3.5 h-3.5" />
              {payout.error}
            </div>
          )}

          {!payout.connected && (
            <button
              onClick={() => setLocation("/bank")}
              className="mt-3 w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              Connect Bank Account
            </button>
          )}
        </section>
      )}

      {/* ── Transactions ───────────────────────────── */}
      <section>
        <button
          onClick={() => setShowTransactions(!showTransactions)}
          className="flex items-center gap-2 w-full text-left py-2 group"
        >
          <ChevronDown
            className={cn(
              "w-4 h-4 text-muted-foreground/50 transition-transform",
              showTransactions && "rotate-180"
            )}
          />
          <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground/50">
            Recent Transactions
          </span>
        </button>

        <AnimatePresence>
          {showTransactions && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              {historyQuery.isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/50" />
                </div>
              ) : history?.entries && history.entries.length > 0 ? (
                <div className="space-y-1 pt-2">
                  {history.entries.map((entry: any) => {
                    const isRefund = entry.type === "refund";
                    const isDeposit = entry.type === "deposit";

                    return (
                      <div
                        key={entry.id}
                        className="rounded-xl border border-border/20 bg-card/50 p-3 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                            isRefund
                              ? "bg-[var(--color-status-danger-bg)]"
                              : "bg-[var(--color-success)]/10"
                          )}>
                            {isRefund ? (
                              <ArrowDownLeft className="w-4 h-4 text-[var(--color-status-danger-text)]" />
                            ) : (
                              <ArrowUpRight className="w-4 h-4 text-[var(--color-success)]" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {entry.clientName || (isDeposit ? "Deposit" : "Payment")}
                            </p>
                            <p className="text-xs text-muted-foreground/50">
                              {entry.createdAt ? format(new Date(entry.createdAt), "d MMM · h:mm a") : ""}
                              {entry.paymentMethod ? ` · ${entry.paymentMethod}` : ""}
                            </p>
                          </div>
                        </div>
                        <span className={cn(
                          "text-sm font-semibold shrink-0",
                          isRefund ? "text-[var(--color-status-danger-text)]" : "text-foreground"
                        )}>
                          {isRefund ? "-" : ""}{formatCents(entry.amountCents)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-sm text-muted-foreground/50">No transactions yet</p>
                </div>
              )}

              {history?.entries && history.entries.length > 0 && (
                <button
                  onClick={() => setLocation("/payouts")}
                  className="w-full mt-3 py-2.5 rounded-xl border border-border/30 text-sm font-semibold text-muted-foreground hover:bg-secondary/50 transition-colors"
                >
                  View All Transactions
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  );
}
