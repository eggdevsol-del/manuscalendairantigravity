/**
 * Tattoi Fee Calculation Engine — Single Source of Truth
 *
 * All fee logic for the platform lives here. No fee calculations
 * should exist in route handlers, UI components, or any other layer.
 *
 * Spec: v2.3
 * - Per-transaction fees (not per-booking) — §4.2
 * - All math in integer cents, round half-up — §4.3
 * - Uniform 3.4% platform fee (ACCC compliant) — §4.2
 * - Tier-based artist fee (Free 2%, Pro 0%, Top 0%) — §2
 * - $5 minimum platform fee floor — §4.4
 * - Combined application_fee_amount (platform + artist fee) — v2.3 §1
 * - Deposit % by tier (Free=25% fixed, Pro/Top configurable) — v2.3 §3
 * - Multi-sitting bundled deposits — v2.3 §4
 * - Upfront payment (Pro only) — v2.3 §5
 */

// ─── Tier Definitions ───────────────────────────────────────

export type PaymentTier = "free" | "pro" | "top";

export interface TierPaymentConfig {
    platformFeeRate: number;       // Decimal, e.g. 0.034 = 3.4%
    artistFeeRate: number;         // Decimal, e.g. 0.020 = 2.0%
    subscriptionPriceCents: number; // Monthly, in cents
    defaultDepositPercent: number;  // v2.3: deposit % (Free=25 fixed)
    depositCustomisable: boolean;   // v2.3: can artist change deposit %?
    upfrontPaymentAllowed: boolean; // v2.3: "pay in full" option (Pro only)
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
        subscriptionPriceCents: 0,
        defaultDepositPercent: 25,   // Fixed at 25% per sitting
        depositCustomisable: false,  // Free cannot change
        upfrontPaymentAllowed: false,
        label: "Free",
    },
    pro: {
        platformFeeRate: 0.034,
        artistFeeRate: 0.000,
        subscriptionPriceCents: 6000, // $60/month
        defaultDepositPercent: 25,    // Default, configurable
        depositCustomisable: true,
        upfrontPaymentAllowed: true,  // Toggle in settings (default off)
        label: "Pro",
    },
    top: {
        platformFeeRate: 0.034,
        artistFeeRate: 0.000,
        subscriptionPriceCents: 0,
        defaultDepositPercent: 25,    // Default, configurable
        depositCustomisable: true,
        upfrontPaymentAllowed: false, // Not available
        label: "Top",
    },
};

/** Minimum platform fee in cents ($5.00) */
export const MIN_PLATFORM_FEE_CENTS = 500;

// ─── Legacy Tier Mapping ────────────────────────────────────

/** Map legacy DB enum values to current payment tiers */
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
            return "free";
    }
}

// ─── Rounding (§4.3) ────────────────────────────────────────

/**
 * Round half-up to nearest integer cent.
 * This is the ONLY rounding function used for money.
 */
export function roundCents(value: number): number {
    return Math.round(value);
}

// ─── Fee Calculation (v2.3 §1 — Combined Application Fee) ───

export interface TransactionFees {
    /** Original amount in cents (artist's rate for this transaction) */
    baseAmountCents: number;
    /** Platform fee charged to client (3.4%, min $5) */
    platformFeeCents: number;
    /** Artist fee deducted from artist payout (tier-based) */
    artistFeeCents: number;
    /** What the client pays: baseAmount + platformFee */
    clientTotalCents: number;
    /** What the artist receives: baseAmount - artistFee */
    artistPayoutCents: number;
    /**
     * Combined application_fee_amount for Stripe Connect.
     * = platformFee + artistFee. Stripe sees ONE number.
     * Ledger records them separately for reporting.
     */
    stripeApplicationFeeCents: number;
    /** Tier used for this calculation */
    tier: PaymentTier;
}

/**
 * Calculate fees for a single transaction (deposit OR balance).
 *
 * @param baseAmountCents - The artist's rate portion for this charge, in cents.
 *                          This comes from artist settings (SSOT), NOT client input.
 * @param tier - The artist's subscription tier.
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

    // Client pays: base + platform fee (artist fee is invisible to client)
    const clientTotalCents = baseAmountCents + platformFeeCents;

    // Artist receives: base - artist fee
    const artistPayoutCents = baseAmountCents - artistFeeCents;

    // v2.3: Combined application_fee_amount = platform fee + artist fee
    // Stripe transfers (baseAmount - artistFee) to artist automatically
    const stripeApplicationFeeCents = platformFeeCents + artistFeeCents;

    return {
        baseAmountCents,
        platformFeeCents,
        artistFeeCents,
        clientTotalCents,
        artistPayoutCents,
        stripeApplicationFeeCents,
        tier,
    };
}

// ─── Deposit Percentage Resolution (v2.3 §3) ────────────────

/**
 * Resolve the effective deposit percentage for an artist.
 * Free tier is LOCKED at 25%. Pro/Top use artist setting or default.
 *
 * @param tier - Artist's subscription tier.
 * @param artistDepositPercent - Artist's configured % (from settings), null = use default.
 */
export function resolveDepositPercentage(
    tier: PaymentTier,
    artistDepositPercent: number | null | undefined
): number {
    const config = PAYMENT_TIERS[tier];

    // Free tier: locked at default (25%), ignore artist setting
    if (!config.depositCustomisable) {
        return config.defaultDepositPercent;
    }

    // Pro/Top: use artist setting if set, otherwise default
    return artistDepositPercent ?? config.defaultDepositPercent;
}

/**
 * Check if upfront payment ("pay in full") is available.
 * Pro tier only, and must be enabled by the artist (default off).
 */
export function isUpfrontPaymentAvailable(
    tier: PaymentTier,
    artistAllowUpfront: boolean | number | null | undefined
): boolean {
    const config = PAYMENT_TIERS[tier];
    if (!config.upfrontPaymentAllowed) return false;
    return !!artistAllowUpfront;
}

// ─── Deposit/Balance Split (v2.3 §4 — Multi-Sitting Support) ─

export interface BookingPaymentSplit {
    /** Number of sittings in this booking */
    numberOfSittings: number;
    /** Day rate per sitting in cents */
    dayRateCents: number;
    /** Total project amount: dayRate × sittings */
    totalProjectCents: number;
    /** Deposit percentage used */
    depositPercent: number;
    /** Deposit per sitting: dayRate × depositPercent */
    depositPerSittingCents: number;
    /** Total bundled deposit: depositPerSitting × sittings (ONE transaction) */
    totalDepositCents: number;
    /** Balance per sitting: dayRate - depositPerSitting */
    balancePerSittingCents: number;
    /** Fees on the bundled deposit transaction */
    depositFees: TransactionFees;
    /** Fees on ONE balance transaction (per-sitting) */
    balanceFeesPerSitting: TransactionFees;
    /** Combined client total across all transactions */
    combinedClientTotalCents: number;
    /** Combined platform fee across all transactions */
    combinedPlatformFeeCents: number;
}

/**
 * Calculate the full deposit + balance split for a booking.
 * Supports multi-sitting projects (v2.3 §4).
 *
 * Deposits for ALL sittings are bundled into ONE transaction.
 * Each sitting then has a separate balance payment (day-of).
 *
 * @param dayRateCents - Artist's rate per sitting, in cents (from settings SSOT).
 * @param depositPercent - Effective deposit % (use resolveDepositPercentage).
 * @param tier - Artist's subscription tier.
 * @param numberOfSittings - Number of sittings (default 1).
 */
export function calculateBookingPaymentSplit(
    dayRateCents: number,
    depositPercent: number,
    tier: PaymentTier,
    numberOfSittings: number = 1
): BookingPaymentSplit {
    // Per-sitting amounts
    const depositPerSittingCents = roundCents(
        dayRateCents * (depositPercent / 100)
    );
    const balancePerSittingCents = dayRateCents - depositPerSittingCents;

    // Bundled deposit: all sittings in ONE transaction
    const totalDepositCents = depositPerSittingCents * numberOfSittings;
    const totalProjectCents = dayRateCents * numberOfSittings;

    // Fee on the bundled deposit (single transaction)
    const depositFees = calculateTransactionFees(totalDepositCents, tier);

    // Fee on ONE balance payment (per sitting, paid day-of)
    const balanceFeesPerSitting = calculateTransactionFees(
        balancePerSittingCents,
        tier
    );

    // Combined totals across ALL transactions
    const combinedClientTotalCents =
        depositFees.clientTotalCents +
        balanceFeesPerSitting.clientTotalCents * numberOfSittings;
    const combinedPlatformFeeCents =
        depositFees.platformFeeCents +
        balanceFeesPerSitting.platformFeeCents * numberOfSittings;

    return {
        numberOfSittings,
        dayRateCents,
        totalProjectCents,
        depositPercent,
        depositPerSittingCents,
        totalDepositCents,
        balancePerSittingCents,
        depositFees,
        balanceFeesPerSitting,
        combinedClientTotalCents,
        combinedPlatformFeeCents,
    };
}

// ─── Payment Method Resolution ───────────────────────────────

/**
 * Returns allowed Stripe payment_method_types for a checkout session.
 * All transactions are card-only.
 */
export function getAllowedPaymentMethods(
    _tier: PaymentTier,
    _isDeposit: boolean
): string[] {
    return ["card"];
}

// ─── Formatting Helpers ──────────────────────────────────────

/** Format cents to display string: 12050 → "$120.50" */
export function formatCents(cents: number): string {
    const dollars = (cents / 100).toFixed(2);
    return `$${dollars}`;
}
