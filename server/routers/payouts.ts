/**
 * Payouts Router — Artist Dashboard Queries
 *
 * Read-only queries on the payment_ledger for:
 * - Next payout indicator (Stripe Payouts API + ledger)
 * - Earnings breakdown (gross, platform fee, artist fee, net)
 * - Payout history (completed payouts with details)
 *
 * All queries are artist-scoped via ctx.user.id.
 */

import { z } from "zod";
import { artistProcedure, router } from "../_core/trpc";
import { getDb } from "../services/core";
import { eq, and, sql, gte, desc } from "drizzle-orm";
import {
    paymentLedger,
    artistSettings,
} from "../../drizzle/schema";
import { stripe } from "../services/stripe";

export const payoutsRouter = router({
    /**
     * Next Payout — Shows the artist's upcoming payout from Stripe.
     * Uses Stripe's Balance + Payouts API for the Connected Account.
     * Falls back to ledger aggregation if no Connect account.
     */
    nextPayout: artistProcedure.query(async ({ ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database connection failed");

        const settings = await db.query.artistSettings.findFirst({
            where: eq(artistSettings.userId, ctx.user.id),
        });

        // If no Connect account, show ledger-based pending total
        if (!settings?.stripeConnectAccountId) {
            const result = await db
                .select({
                    pendingCents: sql<number>`COALESCE(SUM(
            CASE WHEN ${paymentLedger.transactionType} IN ('deposit', 'balance')
            THEN ${paymentLedger.amountCents} - ${paymentLedger.artistFeeCents}
            WHEN ${paymentLedger.transactionType} = 'refund'
            THEN ${paymentLedger.amountCents}
            ELSE 0 END
          ), 0)`,
                })
                .from(paymentLedger)
                .where(
                    and(
                        eq(paymentLedger.artistId, ctx.user.id),
                        eq(paymentLedger.payoutStatus, "pending")
                    )
                );

            return {
                connected: false,
                pendingAmountCents: Number(result[0]?.pendingCents || 0),
                nextPayoutAmountCents: null,
                nextPayoutArrivalDate: null,
                nextPayoutStatus: null,
                currency: "aud",
            };
        }

        // Connected — use Stripe Balance + Payouts API
        try {
            const [balance, payouts] = await Promise.all([
                stripe.balance.retrieve({
                    stripeAccount: settings.stripeConnectAccountId,
                }),
                stripe.payouts.list(
                    { limit: 1, status: "pending" },
                    { stripeAccount: settings.stripeConnectAccountId }
                ),
            ]);

            const pendingBalance = balance.pending?.find(
                (b) => b.currency === "aud"
            );
            const availableBalance = balance.available?.find(
                (b) => b.currency === "aud"
            );
            const nextPayout = payouts.data[0] || null;

            return {
                connected: true,
                pendingAmountCents: pendingBalance?.amount || 0,
                availableAmountCents: availableBalance?.amount || 0,
                nextPayoutAmountCents: nextPayout?.amount || null,
                nextPayoutArrivalDate: nextPayout?.arrival_date
                    ? new Date(nextPayout.arrival_date * 1000).toISOString()
                    : null,
                nextPayoutStatus: nextPayout?.status || null,
                currency: "aud",
            };
        } catch (err: any) {
            console.error("[Payouts] Stripe balance fetch failed:", err.message);
            return {
                connected: true,
                error: "Unable to fetch payout info",
                pendingAmountCents: 0,
                nextPayoutAmountCents: null,
                nextPayoutArrivalDate: null,
                nextPayoutStatus: null,
                currency: "aud",
            };
        }
    }),

    /**
     * Earnings Breakdown — Aggregate from payment_ledger.
     * Returns gross, platform fee, artist fee, net for a given period.
     */
    earningsBreakdown: artistProcedure
        .input(
            z.object({
                period: z.enum(["7d", "30d", "90d", "all"]).default("30d"),
            })
        )
        .query(async ({ ctx, input }) => {
            const db = await getDb();
            if (!db) throw new Error("Database connection failed");

            // Calculate period start date
            const periodDays: Record<string, number | null> = {
                "7d": 7,
                "30d": 30,
                "90d": 90,
                all: null,
            };
            const days = periodDays[input.period];
            const startDate = days
                ? new Date(Date.now() - days * 24 * 60 * 60 * 1000)
                    .toISOString()
                    .slice(0, 19)
                    .replace("T", " ")
                : null;

            // Build conditions
            const conditions = [eq(paymentLedger.artistId, ctx.user.id)];
            if (startDate) {
                conditions.push(gte(paymentLedger.createdAt, startDate));
            }

            const result = await db
                .select({
                    grossCents: sql<number>`COALESCE(SUM(
            CASE WHEN ${paymentLedger.transactionType} IN ('deposit', 'balance')
            THEN ${paymentLedger.amountCents} ELSE 0 END
          ), 0)`,
                    totalPlatformFeeCents: sql<number>`COALESCE(SUM(
            CASE WHEN ${paymentLedger.transactionType} IN ('deposit', 'balance')
            THEN ${paymentLedger.platformFeeCents} ELSE 0 END
          ), 0)`,
                    totalArtistFeeCents: sql<number>`COALESCE(SUM(
            CASE WHEN ${paymentLedger.transactionType} IN ('deposit', 'balance')
            THEN ${paymentLedger.artistFeeCents} ELSE 0 END
          ), 0)`,
                    refundsCents: sql<number>`COALESCE(SUM(
            CASE WHEN ${paymentLedger.transactionType} = 'refund'
            THEN ABS(${paymentLedger.amountCents}) ELSE 0 END
          ), 0)`,
                    disputesCents: sql<number>`COALESCE(SUM(
            CASE WHEN ${paymentLedger.transactionType} = 'dispute'
            THEN ABS(${paymentLedger.amountCents}) ELSE 0 END
          ), 0)`,
                    transactionCount: sql<number>`COUNT(
            CASE WHEN ${paymentLedger.transactionType} IN ('deposit', 'balance')
            THEN 1 END
          )`,
                })
                .from(paymentLedger)
                .where(and(...conditions));

            const row = result[0];
            const grossCents = Number(row?.grossCents || 0);
            const platformFeeCents = Number(row?.totalPlatformFeeCents || 0);
            const artistFeeCents = Number(row?.totalArtistFeeCents || 0);
            const refundsCents = Number(row?.refundsCents || 0);
            const disputesCents = Number(row?.disputesCents || 0);

            // Net = gross - artist fees - refunds
            const netCents = grossCents - artistFeeCents - refundsCents;

            return {
                period: input.period,
                grossCents,
                platformFeeCents,
                artistFeeCents,
                refundsCents,
                disputesCents,
                netCents,
                transactionCount: Number(row?.transactionCount || 0),
            };
        }),

    /**
     * Payout History — List of completed/upcoming payouts.
     * Combines Stripe payout list with ledger context.
     */
    payoutHistory: artistProcedure
        .input(
            z.object({
                limit: z.number().min(1).max(100).default(20),
                cursor: z.string().optional(), // Stripe payout ID for pagination
            })
        )
        .query(async ({ ctx, input }) => {
            const db = await getDb();
            if (!db) throw new Error("Database connection failed");

            const settings = await db.query.artistSettings.findFirst({
                where: eq(artistSettings.userId, ctx.user.id),
            });

            // If no Connect account, return ledger-based history
            if (!settings?.stripeConnectAccountId) {
                const entries = await db
                    .select()
                    .from(paymentLedger)
                    .where(eq(paymentLedger.artistId, ctx.user.id))
                    .orderBy(desc(paymentLedger.createdAt))
                    .limit(input.limit);

                return {
                    connected: false,
                    payouts: [],
                    entries: entries.map((e) => ({
                        id: e.id,
                        type: e.transactionType,
                        amountCents: e.amountCents,
                        platformFeeCents: e.platformFeeCents,
                        artistFeeCents: e.artistFeeCents,
                        netCents: e.amountCents - e.artistFeeCents,
                        payoutStatus: e.payoutStatus,
                        paymentMethod: e.paymentMethod,
                        createdAt: e.createdAt,
                        stripePaymentId: e.stripePaymentId,
                    })),
                    hasMore: entries.length === input.limit,
                };
            }

            // Connected — use Stripe Payouts API
            try {
                const params: any = {
                    limit: input.limit,
                };
                if (input.cursor) {
                    params.starting_after = input.cursor;
                }

                const payouts = await stripe.payouts.list(params, {
                    stripeAccount: settings.stripeConnectAccountId,
                });

                return {
                    connected: true,
                    payouts: payouts.data.map((p) => ({
                        id: p.id,
                        amountCents: p.amount,
                        currency: p.currency,
                        status: p.status,
                        arrivalDate: new Date(p.arrival_date * 1000).toISOString(),
                        createdAt: new Date(p.created * 1000).toISOString(),
                        method: p.type, // "bank_account" or "card"
                        description: p.description,
                    })),
                    entries: [],
                    hasMore: payouts.has_more,
                    nextCursor: payouts.data.length
                        ? payouts.data[payouts.data.length - 1].id
                        : undefined,
                };
            } catch (err: any) {
                console.error("[Payouts] History fetch failed:", err.message);
                return {
                    connected: true,
                    error: "Unable to fetch payout history",
                    payouts: [],
                    entries: [],
                    hasMore: false,
                };
            }
        }),
});
