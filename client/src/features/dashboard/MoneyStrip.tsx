/**
 * MoneyStrip — §6.2 Money summary strip
 *
 * Always-visible strip on Home above the segmented control.
 * Shows: collected (period) · outstanding · next payout.
 * Tapping pushes MoneyScreen.
 *
 * Amber text + amber hairline border. No background fill.
 * §4 colours, not the existing PayoutWidget styles.
 */

import React from "react";
import { trpc } from "@/lib/trpc";
import { formatCents } from "@/lib/formatMoney";
import { DT, DType, DRadius, DSpace } from "./dashboardTokens";
import { ChevronRight } from "lucide-react";

interface MoneyStripProps {
  period?: "7d" | "30d" | "90d" | "all";
  onTap: () => void;
}

export function MoneyStrip({ period = "30d", onTap }: MoneyStripProps) {
  const earningsQuery = trpc.payouts.earningsBreakdown.useQuery({ period });
  const nextPayoutQuery = trpc.payouts.nextPayout.useQuery();

  const netCents = earningsQuery.data?.netCents ?? 0;
  const outstandingCents = 0; // Derived from client groups; passed via props if needed
  const nextPayoutCents = nextPayoutQuery.data?.nextPayoutAmountCents ?? nextPayoutQuery.data?.pendingAmountCents ?? 0;

  const isLoading = earningsQuery.isLoading;

  return (
    <button
      onClick={onTap}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: `${DSpace[4]}px ${DSpace[6]}px`,
        borderRadius: DRadius.card,
        border: `1px solid ${DT.emphasisBorder}`,
        background: "transparent",
        cursor: "pointer",
        minHeight: 44,
        transition: "background .15s",
      }}
      onMouseEnter={e => (e.currentTarget.style.background = DT.quietRow)}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >
      {isLoading ? (
        <span style={{ color: DT.textTertiary, fontSize: DType.rowBody.fontSize }}>Loading…</span>
      ) : (
        <>
          <div style={{ display: "flex", gap: DSpace[6], alignItems: "baseline" }}>
            <div>
              <div style={{
                fontSize: DType.moneyLabel.fontSize,
                fontWeight: DType.moneyLabel.fontWeight,
                letterSpacing: DType.moneyLabel.letterSpacing,
                color: DT.textTertiary,
                textTransform: "uppercase",
                marginBottom: 2,
              }}>
                EARNED
              </div>
              <div style={{
                fontSize: DType.rowTitle.fontSize,
                fontWeight: DType.rowTitle.fontWeight,
                color: DT.amber,
              }}>
                {formatCents(netCents)}
              </div>
            </div>

            {nextPayoutCents > 0 && (
              <div>
                <div style={{
                  fontSize: DType.moneyLabel.fontSize,
                  fontWeight: DType.moneyLabel.fontWeight,
                  letterSpacing: DType.moneyLabel.letterSpacing,
                  color: DT.textTertiary,
                  textTransform: "uppercase",
                  marginBottom: 2,
                }}>
                  NEXT PAYOUT
                </div>
                <div style={{
                  fontSize: DType.rowTitle.fontSize,
                  fontWeight: DType.rowTitle.fontWeight,
                  color: DT.amber,
                }}>
                  {formatCents(nextPayoutCents)}
                </div>
              </div>
            )}
          </div>
          <ChevronRight size={16} color={DT.amber} />
        </>
      )}
    </button>
  );
}
