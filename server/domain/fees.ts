/**
 * Tattoi Fee Calculation Engine — Single Source of Truth
 *
 * All fee logic for the platform lives here. No fee calculations
 * should exist in route handlers, UI components, or any other layer.
 *
 * Spec: v2.2 §4.2, §4.3, §4.4
 * - Per-transaction fees (not per-booking)
 * - All math in integer cents, round half-up
 * - Uniform 3.4% platform fee (ACCC compliant)
 * - Tier-based artist fee (Free 2%, Pro 1%, Top 0%)
 * - $5 minimum platform fee floor
 */

// ─── Tier Definitions ───────────────────────────────────────

export type PaymentTier = "free" | "pro" | "top";

export interface TierPaymentConfig {
    platformFeeRate: number;  // Decimal, e.g. 0.034 = 3.4%
    artistFeeRate: number;    // Decimal, e.g. 0.020 = 2.0%
    bnplEnabled: boolean;
    subscriptionPriceCents: number; // Monthly, in cents
    label: string;
}

/**
 * PAYMENT_TIERS — Canonical tier configuration.
 * Never duplicate these values elsewhere.
 */
export const PAYMENT_TIERS: Record<PaymentTier, TierPaymentConfig> = {
    free: {
        platformFeeRate: 0.034,
        artistFeeRate: 0.020,
        bnplEnabled: false,
        subscriptionPriceCents: 0,
        label: "Free",
    },
    pro: {
        platformFeeRate: 0.034,
        artistFeeRate: 0.010,
        bnplEnabled: true,
        subscriptionPriceCents: 3900, // $39/month
        label: "Pro",
    },
    top: {
        platformFeeRate: 0.034,
        artistFeeRate: 0.000,
        bnplEnabled: false,
        subscriptionPriceCents: 0,
        label: "Top",
    },
};

/** Minimum platform fee in cents ($5.00) */
export const MIN_PLATFORM_FEE_CENTS = 500;

// ─── Legacy Tier Mapping ────────────────────────────────────

/** Map legacy DB enum values to v2.2 payment tiers */
export function resolvePaymentTier(
    dbTier: string | null | undefined
): PaymentTier {
    switch (dbTier) {
        case "free":
        case "basic":
            return "free";
        case "pro":
            return "pro";
        case "top":
        case "elite":
            return "top";
        default:
            return "free"; // Safe fallback
    }
}

// ─── Rounding (§4.3) ────────────────────────────────────────

/**
 * Round half-up to nearest integer cent.
 * This is the ONLY rounding function used for money.
 * Standard rounding: 0.5 → rounds up.
 */
export function roundCents(value: number): number {
    return Math.round(value);
}

// ─── Fee Calculation (§4.2, §4.3, §4.4) ─────────────────────

export interface TransactionFees {
    /** Original amount in cents (artist's rate portion for this transaction) */
    baseAmountCents: number;
    /** Platform fee charged to client (3.4%, min $5) */
    platformFeeCents: number;
    /** Artist fee deducted from artist payout (tier-based) */
    artistFeeCents: number;
    /** What the client pays: baseAmount + platformFee */
    clientTotalCents: number;
    /** What the artist receives: baseAmount - artistFee */
    artistPayoutCents: number;
    /** The application_fee_amount for Stripe Connect (platform fee only) */
    stripeApplicationFeeCents: number;
    /** Tier used for this calculation */
    tier: PaymentTier;
}

/**
 * Calculate fees for a single transaction (deposit OR balance).
 *
 * @param baseAmountCents - The artist's rate portion for this charge, in cents.
 *                          For deposits: depositAmount. For balance: remainingBalance.
 *                          This comes from artist settings (SSOT), NOT client input.
 * @param tier - The artist's subscription tier.
 * @returns All fee components, all in integer cents.
 */
export function calculateTransactionFees(
    baseAmountCents: number,
    tier: PaymentTier
): TransactionFees {
    const config = PAYMENT_TIERS[tier];

    // Platform fee: 3.4% of base amount, minimum $5
    const rawPlatformFee = baseAmountCents * config.platformFeeRate;
    const platformFeeCents = Math.max(
        roundCents(rawPlatformFee),
        MIN_PLATFORM_FEE_CENTS
    );

    // Artist fee: tier-based percentage of base amount
    const artistFeeCents = roundCents(baseAmountCents * config.artistFeeRate);

    // Client pays: base + platform fee
    const clientTotalCents = baseAmountCents + platformFeeCents;

    // Artist receives: base - artist fee
    const artistPayoutCents = baseAmountCents - artistFeeCents;

    return {
        baseAmountCents,
        platformFeeCents,
        artistFeeCents,
        clientTotalCents,
        artistPayoutCents,
        stripeApplicationFeeCents: platformFeeCents,
        tier,
    };
}

// ─── Deposit/Balance Split (§4.1, §4.5) ──────────────────────

export interface BookingPaymentSplit {
    totalAmountCents: number;
    depositAmountCents: number;
    balanceAmountCents: number;
    depositFees: TransactionFees;
    balanceFees: TransactionFees;
    /** Combined client total across both transactions */
    combinedClientTotalCents: number;
    /** Combined platform fee across both transactions */
    combinedPlatformFeeCents: number;
}

/**
 * Calculate the full deposit + balance split for a booking.
 *
 * @param totalAmountCents - Artist's full rate for the booking, in cents.
 * @param depositPercentage - Deposit percentage (0-100), e.g. 25 for 25%.
 * @param tier - Artist's subscription tier.
 */
export function calculateBookingPaymentSplit(
    totalAmountCents: number,
    depositPercentage: number,
    tier: PaymentTier
): BookingPaymentSplit {
    const depositAmountCents = roundCents(
        totalAmountCents * (depositPercentage / 100)
    );
    const balanceAmountCents = totalAmountCents - depositAmountCents;

    const depositFees = calculateTransactionFees(depositAmountCents, tier);
    const balanceFees = calculateTransactionFees(balanceAmountCents, tier);

    return {
        totalAmountCents,
        depositAmountCents,
        balanceAmountCents,
        depositFees,
        balanceFees,
        combinedClientTotalCents:
            depositFees.clientTotalCents + balanceFees.clientTotalCents,
        combinedPlatformFeeCents:
            depositFees.platformFeeCents + balanceFees.platformFeeCents,
    };
}

// ─── Payment Method Resolution (§5.2) ────────────────────────

/**
 * Returns allowed Stripe payment_method_types for a checkout session.
 * BNPL enforcement happens HERE, at the backend level.
 * Frontend gating alone is a security hole (§5.2).
 *
 * @param tier - Artist's subscription tier.
 * @param isDeposit - Whether this is a deposit (always card-only).
 */
export function getAllowedPaymentMethods(
    tier: PaymentTier,
    isDeposit: boolean
): string[] {
    // Deposits are ALWAYS card-only (§4.1)
    if (isDeposit) {
        return ["card"];
    }

    // Balance/upfront: BNPL only for Pro tier (§5.1, §5.2)
    const config = PAYMENT_TIERS[tier];
    if (config.bnplEnabled) {
        return ["card", "afterpay_clearpay", "zip"];
    }

    return ["card"];
}

// ─── Formatting Helpers ──────────────────────────────────────

/** Format cents to display string: 12050 → "$120.50" */
export function formatCents(cents: number): string {
    const dollars = (cents / 100).toFixed(2);
    return `$${dollars}`;
}

/** Check if BNPL is available for a given tier */
export function isBnplAvailable(tier: PaymentTier): boolean {
    return PAYMENT_TIERS[tier].bnplEnabled;
}
