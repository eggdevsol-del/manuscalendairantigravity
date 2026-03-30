/**
 * Tattoi Refund Rules Engine — Single Source of Truth
 *
 * Centralised refund logic per spec v2.2 §4.6.
 * Refund calculations live here, never in route handlers or UI.
 *
 * Rules:
 * - Client cancels: platform fee is NON-REFUNDABLE, artist fee reversed proportionally
 * - Artist cancels / no-show: FULL refund including platform fee (Australian Consumer Law)
 * - Partial refunds: proportional fee adjustment
 * - All refunds via Stripe to maintain ledger integrity
 */

import { roundCents, type PaymentTier, PAYMENT_TIERS } from "./fees";

// ─── Types ───────────────────────────────────────────────────

export type CancellationParty = "client" | "artist";

export interface RefundCalculation {
    /** Who initiated the cancellation */
    cancelledBy: CancellationParty;
    /** Original charge amount in cents (what client paid) */
    originalChargeCents: number;
    /** Original platform fee in cents */
    originalPlatformFeeCents: number;
    /** Original artist fee in cents */
    originalArtistFeeCents: number;
    /** Amount to refund to the client */
    clientRefundCents: number;
    /** Platform fee refund amount (0 for client-cancel, full for artist-cancel) */
    platformFeeRefundCents: number;
    /** Artist fee reversal amount */
    artistFeeReversalCents: number;
    /** Net amount Tattoi retains after refund */
    platformRetainsCents: number;
}

// ─── Full Refund ─────────────────────────────────────────────

/**
 * Calculate refund amounts for a full cancellation.
 *
 * @param originalChargeCents - The full amount the client was charged (including platform fee)
 * @param originalBaseAmountCents - The artist's rate portion (before platform fee was added)
 * @param originalPlatformFeeCents - The platform fee that was charged
 * @param originalArtistFeeCents - The artist fee that was deducted
 * @param cancelledBy - Who cancelled: 'client' or 'artist'
 */
export function calculateFullRefund(
    originalChargeCents: number,
    originalBaseAmountCents: number,
    originalPlatformFeeCents: number,
    originalArtistFeeCents: number,
    cancelledBy: CancellationParty
): RefundCalculation {
    if (cancelledBy === "artist") {
        // Artist cancels / no-show → full refund including platform fee
        // Australian Consumer Law: service not provided = full refund
        return {
            cancelledBy,
            originalChargeCents,
            originalPlatformFeeCents,
            originalArtistFeeCents,
            clientRefundCents: originalChargeCents, // Everything back
            platformFeeRefundCents: originalPlatformFeeCents,
            artistFeeReversalCents: originalArtistFeeCents,
            platformRetainsCents: 0,
        };
    }

    // Client cancels → platform fee is NON-REFUNDABLE
    const clientRefundCents = originalChargeCents - originalPlatformFeeCents;

    return {
        cancelledBy,
        originalChargeCents,
        originalPlatformFeeCents,
        originalArtistFeeCents,
        clientRefundCents, // Base amount only, no platform fee
        platformFeeRefundCents: 0, // Tattoi keeps the platform fee
        artistFeeReversalCents: originalArtistFeeCents, // Artist fee reversed
        platformRetainsCents: originalPlatformFeeCents,
    };
}

// ─── Partial Refund ──────────────────────────────────────────

/**
 * Calculate refund amounts for a partial refund.
 * Fees are adjusted proportionally to the refund percentage.
 *
 * @param originalChargeCents - Full client charge
 * @param originalBaseAmountCents - Artist's rate portion
 * @param originalPlatformFeeCents - Platform fee charged
 * @param originalArtistFeeCents - Artist fee deducted
 * @param refundPercentage - Percentage to refund (0-100)
 * @param cancelledBy - Who cancelled
 */
export function calculatePartialRefund(
    originalChargeCents: number,
    originalBaseAmountCents: number,
    originalPlatformFeeCents: number,
    originalArtistFeeCents: number,
    refundPercentage: number,
    cancelledBy: CancellationParty
): RefundCalculation {
    const ratio = refundPercentage / 100;

    if (cancelledBy === "artist") {
        // Artist partial refund: proportional everything
        const clientRefundCents = roundCents(originalChargeCents * ratio);
        const platformFeeRefundCents = roundCents(originalPlatformFeeCents * ratio);
        const artistFeeReversalCents = roundCents(originalArtistFeeCents * ratio);

        return {
            cancelledBy,
            originalChargeCents,
            originalPlatformFeeCents,
            originalArtistFeeCents,
            clientRefundCents,
            platformFeeRefundCents,
            artistFeeReversalCents,
            platformRetainsCents: originalPlatformFeeCents - platformFeeRefundCents,
        };
    }

    // Client partial refund: platform fee on the refunded portion is non-refundable
    const baseRefundCents = roundCents(originalBaseAmountCents * ratio);
    const artistFeeReversalCents = roundCents(originalArtistFeeCents * ratio);

    return {
        cancelledBy,
        originalChargeCents,
        originalPlatformFeeCents,
        originalArtistFeeCents,
        clientRefundCents: baseRefundCents, // Only the base portion, no fee refund
        platformFeeRefundCents: 0,
        artistFeeReversalCents,
        platformRetainsCents: originalPlatformFeeCents,
    };
}
