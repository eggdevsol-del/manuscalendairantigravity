/**
 * MoneyScreen — §6.4 Money (pushed screen)
 *
 * Not a tab. Pushed from the Money strip via onBack.
 *
 * Layout:
 *   BALANCE card — your balance, pending, next payout
 *   EARNINGS card — collected (period), platform fee (3.4% at tertiary), your fee (2%, real deduction), net
 *   TRANSACTIONS — expandable rows with refund state
 *   PAYOUTS — list from Stripe
 *
 * §8.1: Labels match who-pays-what:
 *   - "Clients paid you" = grossCents (before any fee)
 *   - "Your platform fee" = artistFeeCents (2%, shown as negative)
 *   - "Processing, paid by clients" = platformFeeCents (3.4%, shown at tertiary, not subtracted)
 *   - "You earned" = netCents
 *
 * §8.2: Range selector filters all figures together.
 */

import React, { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { formatCents } from "@/lib/formatMoney";
import { DT, DType, DRadius, DSpace } from "./dashboardTokens";
import { ArrowLeft, ChevronDown, ChevronUp, RefreshCcw } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

// ── Period Selector ─────────────────────────────────────

type Period = "7d" | "30d" | "90d" | "all";
const PERIOD_LABELS: Record<Period, string> = {
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
  "all": "All time",
};

function PeriodSelector({ value, onChange }: { value: Period; onChange: (v: Period) => void }) {
  return (
    <div style={{ display: "flex", gap: 4, borderRadius: DRadius.pill, background: DT.quietRow, padding: 2 }}>
      {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
        <button
          key={p}
          onClick={() => onChange(p)}
          style={{
            padding: "6px 12px",
            borderRadius: DRadius.pill,
            fontSize: DType.exceptionPill.fontSize,
            fontWeight: DType.exceptionPill.fontWeight,
            color: p === value ? DT.textPrimary : DT.textTertiary,
            background: p === value ? DT.segmentPill : "transparent",
            border: "none",
            cursor: "pointer",
            transition: "all .15s",
            minHeight: 32,
          }}
        >
          {PERIOD_LABELS[p]}
        </button>
      ))}
    </div>
  );
}

// ── Section Header ──────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{
      fontSize: DType.sectionLabel.fontSize,
      fontWeight: DType.sectionLabel.fontWeight,
      letterSpacing: DType.sectionLabel.letterSpacing,
      color: DT.textTertiary,
      textTransform: "uppercase" as const,
      marginBottom: DSpace[2],
    }}>
      {label}
    </div>
  );
}

// ── Earnings Row ────────────────────────────────────────

function EarningsRow({
  label, value, isTertiary, isNegative, isBold,
}: {
  label: string; value: string; isTertiary?: boolean; isNegative?: boolean; isBold?: boolean;
}) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
      padding: "6px 0",
    }}>
      <span style={{
        fontSize: DType.rowBody.fontSize,
        fontWeight: isBold ? 600 : 400,
        color: isTertiary ? DT.textTertiary : DT.textSecondary,
      }}>
        {label}
      </span>
      <span style={{
        fontSize: isBold ? DType.rowTitle.fontSize : DType.rowBody.fontSize,
        fontWeight: isBold ? DType.rowTitle.fontWeight : DType.rowBody.fontWeight,
        color: isNegative ? DT.destructiveText : isBold ? DT.textPrimary : DT.textSecondary,
      }}>
        {isNegative ? `−${value}` : value}
      </span>
    </div>
  );
}

// ── Transaction Row ─────────────────────────────────────

function TransactionRow({ entry, suspectedDuplicate }: { entry: any; suspectedDuplicate?: boolean }) {
  const [expanded, setExpanded] = useState(false);

  const isRefund = entry.type === "refund";
  const label = isRefund ? "Refund" : entry.type === "deposit" ? "Deposit" : "Balance";
  const date = entry.createdAt ? format(new Date(entry.createdAt), "d MMM yyyy") : "";
  const amount = formatCents(entry.amountCents);
  const net = formatCents(entry.netCents);

  return (
    <div
      style={{
        background: expanded ? DT.rowHover : DT.cardSurface,
        borderRadius: DRadius.row,
        border: `1px solid ${DT.hairline}`,
        padding: `${DSpace[4]}px ${DSpace[5]}px`,
        cursor: "pointer",
        transition: "background .15s",
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <span style={{
            fontSize: DType.rowTitle.fontSize,
            fontWeight: DType.rowTitle.fontWeight,
            color: isRefund ? DT.destructiveText : DT.textPrimary,
          }}>
            {label}
          </span>
          {entry.clientName && (
            <span style={{ fontSize: DType.rowMeta.fontSize, color: DT.textTertiary, marginLeft: 8 }}>
              {entry.clientName}
            </span>
          )}
          {suspectedDuplicate && (
            <span style={{
              fontSize: DType.exceptionPill.fontSize,
              fontWeight: DType.exceptionPill.fontWeight,
              color: DT.amber,
              border: `1px solid ${DT.amberBorder40}`,
              borderRadius: DRadius.pill,
              padding: "2px 7px",
              marginLeft: 8,
              whiteSpace: "nowrap" as const,
            }}>
              possible duplicate
            </span>
          )}
        </div>
        <span style={{
          fontSize: DType.rowTitle.fontSize,
          fontWeight: DType.rowTitle.fontWeight,
          color: isRefund ? DT.destructiveText : DT.textPrimary,
        }}>
          {isRefund ? `−${amount}` : amount}
        </span>
      </div>
      <div style={{ fontSize: DType.rowMeta.fontSize, color: DT.textTertiary, marginTop: 2 }}>
        {date} · {entry.paymentMethod || "card"}
      </div>
      {expanded && (
        <div style={{
          marginTop: DSpace[3],
          padding: `${DSpace[2]}px ${DSpace[3]}px`,
          background: DT.factPanelBg,
          borderRadius: DRadius.factPanel,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: DType.rowMeta.fontSize }}>
            <span style={{ color: DT.textTertiary }}>Gross</span>
            <span style={{ color: DT.textPrimary }}>{amount}</span>
          </div>
          {entry.platformFeeCents > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: DType.rowMeta.fontSize }}>
              <span style={{ color: DT.textTertiary }}>Client processing (3.4%)</span>
              <span style={{ color: DT.textTertiary }}>{formatCents(entry.platformFeeCents)}</span>
            </div>
          )}
          {entry.artistFeeCents > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: DType.rowMeta.fontSize }}>
              <span style={{ color: DT.textTertiary }}>Your fee (2%)</span>
              <span style={{ color: DT.destructiveText }}>−{formatCents(entry.artistFeeCents)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: DType.rowMeta.fontSize, borderTop: `1px solid ${DT.hairline}`, marginTop: 4 }}>
            <span style={{ color: DT.textPrimary, fontWeight: 600 }}>Net</span>
            <span style={{ color: DT.textPrimary, fontWeight: 600 }}>{net}</span>
          </div>
          <div style={{ fontSize: DType.rowMeta.fontSize, color: DT.textTertiary, marginTop: 4 }}>
            Status: {entry.payoutStatus || "pending"}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Payout Row ──────────────────────────────────────────

function PayoutRow({ payout }: { payout: any }) {
  const amount = formatCents(payout.amountCents);
  const date = payout.arrivalDate ? format(new Date(payout.arrivalDate), "d MMM yyyy") : "";
  const statusColors: Record<string, string> = {
    paid: DT.green,
    in_transit: DT.amber,
    pending: DT.textTertiary,
    failed: DT.destructive,
  };

  return (
    <div style={{
      background: DT.cardSurface,
      borderRadius: DRadius.row,
      border: `1px solid ${DT.hairline}`,
      padding: `${DSpace[4]}px ${DSpace[5]}px`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <span style={{ fontSize: DType.rowTitle.fontSize, fontWeight: DType.rowTitle.fontWeight, color: DT.textPrimary }}>
            {amount}
          </span>
          {payout.bankLast4 && (
            <span style={{ fontSize: DType.rowMeta.fontSize, color: DT.textTertiary, marginLeft: 8 }}>
              ···{payout.bankLast4}
            </span>
          )}
        </div>
        <span style={{
          fontSize: DType.exceptionPill.fontSize,
          fontWeight: DType.exceptionPill.fontWeight,
          color: statusColors[payout.status] || DT.textTertiary,
          textTransform: "capitalize" as const,
        }}>
          {payout.status}
        </span>
      </div>
      <div style={{ fontSize: DType.rowMeta.fontSize, color: DT.textTertiary, marginTop: 2 }}>
        {date}
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────

interface MoneyScreenProps {
  onBack: () => void;
}

export function MoneyScreen({ onBack }: MoneyScreenProps) {
  const [period, setPeriod] = useState<Period>("30d");
  const [showTransactions, setShowTransactions] = useState(false);

  // Queries — §8.2: range selector filters all figures
  const earningsQuery = trpc.payouts.earningsBreakdown.useQuery({ period });
  const nextPayoutQuery = trpc.payouts.nextPayout.useQuery();
  const connectQuery = trpc.artistSettings.getStripeConnectStatus.useQuery();

  // Lazy-load transactions
  const historyQuery = trpc.payouts.payoutHistory.useQuery(
    { limit: 20 },
    { enabled: showTransactions }
  );

  const e = earningsQuery.data;
  const payout = nextPayoutQuery.data;
  const connected = connectQuery.data?.connected ?? false;

  // §8.5: Duplicate payment detection
  // Flag entries where same client + same amount appears within 60 seconds
  const duplicateIds = useMemo(() => {
    const entries = historyQuery.data?.entries;
    if (!entries || entries.length < 2) return new Set<number>();

    const ids = new Set<number>();
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i];
        const b = entries[j];
        if (
          a.clientName && b.clientName &&
          a.clientName === b.clientName &&
          a.amountCents === b.amountCents &&
          a.type !== "refund" && b.type !== "refund"
        ) {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          if (Math.abs(aTime - bTime) <= 60_000) {
            ids.add(a.id);
            ids.add(b.id);
          }
        }
      }
    }
    return ids;
  }, [historyQuery.data?.entries]);

  // §9: Error retry helper
  const ErrorRetry = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
    <div style={{
      background: DT.cardSurface,
      borderRadius: DRadius.row,
      border: `1px solid ${DT.hairline}`,
      padding: DSpace[7],
      textAlign: "center" as const,
    }}>
      <div style={{ color: DT.destructiveText, fontSize: DType.rowBody.fontSize, marginBottom: DSpace[3] }}>
        {message}
      </div>
      <button
        onClick={onRetry}
        style={{
          background: DT.amber,
          color: DT.amberOnColor,
          border: "none",
          borderRadius: DRadius.button,
          padding: "8px 20px",
          fontSize: DType.button.fontSize,
          fontWeight: DType.button.fontWeight,
          cursor: "pointer",
          minHeight: 44,
        }}
      >
        Retry
      </button>
    </div>
  );

  return (
    <div style={{
      minHeight: "100vh",
      background: DT.pageBg,
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: DSpace[3],
        padding: `${DSpace[6]}px ${DSpace[7]}px`,
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: DT.pageBg,
      }}>
        <button
          onClick={onBack}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 8,
            margin: -8,
            color: DT.textPrimary,
            minWidth: 44,
            minHeight: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </button>
        <span style={{
          fontSize: DType.screenTitle.fontSize,
          fontWeight: DType.screenTitle.fontWeight,
          color: DT.textPrimary,
        }}>
          Money
        </span>
      </div>

      <div style={{ padding: `0 ${DSpace[7]}px ${DSpace[7] * 4}px`, display: "flex", flexDirection: "column", gap: DSpace[7] }}>
        {/* Period Selector */}
        <PeriodSelector value={period} onChange={setPeriod} />

        {/* Balance Card */}
        <div>
          <SectionHeader label="BALANCE" />
          <div style={{
            background: DT.cardSurface,
            borderRadius: DRadius.card,
            border: `1px solid ${DT.hairline}`,
            padding: DSpace[7],
          }}>
            {earningsQuery.isLoading ? (
              <div style={{ color: DT.textTertiary, fontSize: DType.rowBody.fontSize }}>Loading…</div>
            ) : (
              <>
                <div style={{ marginBottom: DSpace[4] }}>
                  <div style={{
                    fontSize: DType.moneyLabel.fontSize,
                    fontWeight: DType.moneyLabel.fontWeight,
                    letterSpacing: DType.moneyLabel.letterSpacing,
                    color: DT.textTertiary,
                    textTransform: "uppercase" as const,
                    marginBottom: 4,
                  }}>
                    YOUR BALANCE
                  </div>
                  <div style={{
                    fontSize: DType.headlineMoney.fontSize,
                    fontWeight: DType.headlineMoney.fontWeight,
                    color: DT.amber,
                  }}>
                    {formatCents(payout?.pendingAmountCents ?? 0)}
                  </div>
                </div>

                {payout?.nextPayoutAmountCents && (
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "6px 0",
                    borderTop: `1px solid ${DT.hairline}`,
                  }}>
                    <span style={{ fontSize: DType.rowBody.fontSize, color: DT.textSecondary }}>Next payout</span>
                    <span style={{ fontSize: DType.rowBody.fontSize, color: DT.textPrimary }}>
                      {formatCents(payout.nextPayoutAmountCents)}
                      {payout.nextPayoutArrivalDate && (
                        <span style={{ color: DT.textTertiary, marginLeft: 6 }}>
                          {format(new Date(payout.nextPayoutArrivalDate), "d MMM")}
                        </span>
                      )}
                    </span>
                  </div>
                )}

                {!connected && (
                  <div style={{
                    marginTop: DSpace[4],
                    padding: `${DSpace[3]}px ${DSpace[4]}px`,
                    background: DT.factPanelBg,
                    borderRadius: DRadius.factPanel,
                    fontSize: DType.rowMeta.fontSize,
                    color: DT.amber,
                  }}>
                    Connect Stripe to enable automatic payouts
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Earnings Card — §8.1: Correct labels */}
        <div>
          <SectionHeader label="EARNINGS" />
          <div style={{
            background: DT.cardSurface,
            borderRadius: DRadius.card,
            border: `1px solid ${DT.hairline}`,
            padding: DSpace[7],
          }}>
            {earningsQuery.isLoading ? (
              <div style={{ color: DT.textTertiary, fontSize: DType.rowBody.fontSize }}>Loading…</div>
            ) : earningsQuery.isError ? (
              <ErrorRetry message="Couldn't load earnings" onRetry={() => earningsQuery.refetch()} />
            ) : e ? (
              <>
                <EarningsRow label="Clients paid you" value={formatCents(e.grossCents)} />
                {e.artistFeeCents > 0 && (
                  <EarningsRow label="Your platform fee (2%)" value={formatCents(e.artistFeeCents)} isNegative />
                )}
                {e.refundsCents > 0 && (
                  <EarningsRow label="Refunds" value={formatCents(e.refundsCents)} isNegative />
                )}
                <div style={{ borderTop: `1px solid ${DT.hairline}`, marginTop: 4, paddingTop: 4 }}>
                  <EarningsRow label="You earned" value={formatCents(e.netCents)} isBold />
                </div>
                {e.platformFeeCents > 0 && (
                  <EarningsRow
                    label={`Processing, paid by clients (3.4%)`}
                    value={formatCents(e.platformFeeCents)}
                    isTertiary
                  />
                )}
                <div style={{ fontSize: DType.rowMeta.fontSize, color: DT.textTertiary, marginTop: DSpace[3] }}>
                  {e.transactionCount} {e.transactionCount === 1 ? "transaction" : "transactions"} in the last {PERIOD_LABELS[period].toLowerCase()}
                </div>
              </>
            ) : null}
          </div>
        </div>

        {/* Transactions */}
        <div>
          <button
            onClick={() => setShowTransactions(!showTransactions)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 0,
              marginBottom: showTransactions ? DSpace[2] : 0,
              minHeight: 44,
            }}
          >
            <span style={{
              fontSize: DType.sectionLabel.fontSize,
              fontWeight: DType.sectionLabel.fontWeight,
              letterSpacing: DType.sectionLabel.letterSpacing,
              color: DT.textTertiary,
              textTransform: "uppercase" as const,
            }}>
              TRANSACTIONS
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4, color: DT.textTertiary, fontSize: DType.rowMeta.fontSize }}>
              {showTransactions ? "Hide" : "Show"}
              {showTransactions ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </span>
          </button>

          {showTransactions && (
            <div style={{ display: "flex", flexDirection: "column", gap: DSpace[1] }}>
              {historyQuery.isLoading ? (
                <div style={{
                  background: DT.cardSurface, borderRadius: DRadius.row, padding: DSpace[6],
                  textAlign: "center", color: DT.textTertiary, fontSize: DType.rowBody.fontSize,
                }}>
                  Loading transactions…
                </div>
              ) : historyQuery.isError ? (
                <ErrorRetry message="Couldn't load transactions" onRetry={() => historyQuery.refetch()} />
              ) : historyQuery.data?.entries && historyQuery.data.entries.length > 0 ? (
                historyQuery.data.entries.map((entry: any) => (
                  <TransactionRow
                    key={entry.id}
                    entry={entry}
                    suspectedDuplicate={duplicateIds.has(entry.id)}
                  />
                ))
              ) : (
                <div style={{
                  background: DT.cardSurface, borderRadius: DRadius.row, padding: DSpace[6],
                  textAlign: "center", color: DT.textTertiary, fontSize: DType.rowBody.fontSize,
                  border: `1px solid ${DT.hairline}`,
                }}>
                  No transactions yet
                </div>
              )}
            </div>
          )}
        </div>

        {/* Payouts */}
        {showTransactions && historyQuery.data?.payouts && historyQuery.data.payouts.length > 0 && (
          <div>
            <SectionHeader label="PAYOUTS" />
            <div style={{ display: "flex", flexDirection: "column", gap: DSpace[1] }}>
              {historyQuery.data.payouts.map((p: any) => (
                <PayoutRow key={p.id} payout={p} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
