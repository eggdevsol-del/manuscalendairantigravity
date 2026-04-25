/**
 * Tier Permissions — Feature Gates by Subscription Tier
 *
 * Controls feature access per tier. The payment-specific tier config
 * (fee rates) lives in server/domain/fees.ts — this file handles
 * non-payment feature gating only.
 *
 * Tier mapping: basic → free, pro → pro, elite → top
 */

export type SubscriptionTier = "free" | "pro" | "top";

/** Legacy enum values still in the DB */
export type LegacySubscriptionTier = "basic" | "pro" | "elite";

/** Resolve any tier string (including legacy) to the canonical tier */
export function resolveSubscriptionTier(
    tier: string | null | undefined
): SubscriptionTier {
    switch (tier) {
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

export interface TierConfig {
    maxAppointments: number;
    canUseDepositEngine: boolean;
    canUseWizard: boolean;
    canUseAutomatedReminders: boolean;
    canUsePromotions: boolean;
    canRemoveBranding: boolean;
    canUseCustomMessaging: boolean;
    canUseMarketingBroadcasts: boolean;
    canUseWaitlist: boolean;
    canUseAIVoiceNotes: boolean;
    canProcessFinalPayments: boolean;

    maxStorageGB: number;
}

export const TIER_CONFIGS: Record<SubscriptionTier, TierConfig> = {
    free: {
        maxAppointments: 30,
        canUseDepositEngine: false,
        canUseWizard: false,
        canUseAutomatedReminders: false,
        canUsePromotions: false,
        canRemoveBranding: false,
        canUseCustomMessaging: false,
        canUseMarketingBroadcasts: false,
        canUseWaitlist: false,
        canUseAIVoiceNotes: false,
        canProcessFinalPayments: false,

        maxStorageGB: 1,
    },
    pro: {
        maxAppointments: Infinity,
        canUseDepositEngine: true,
        canUseWizard: true,
        canUseAutomatedReminders: true,
        canUsePromotions: true,
        canRemoveBranding: true,
        canUseCustomMessaging: true,
        canUseMarketingBroadcasts: true,
        canUseWaitlist: true,
        canUseAIVoiceNotes: true,
        canProcessFinalPayments: true,

        maxStorageGB: Infinity,
    },
    top: {
        maxAppointments: Infinity,
        canUseDepositEngine: true,
        canUseWizard: true,
        canUseAutomatedReminders: true,
        canUsePromotions: true,
        canRemoveBranding: true,
        canUseCustomMessaging: true,
        canUseMarketingBroadcasts: true,
        canUseWaitlist: true,
        canUseAIVoiceNotes: true,
        canProcessFinalPayments: true,

        maxStorageGB: Infinity,
    },
};

export function canAccessFeature<K extends keyof TierConfig>(
    tier: SubscriptionTier | string | null | undefined,
    feature: K
): boolean {
    const activeTier = resolveSubscriptionTier(tier as string);
    const featureLimit = TIER_CONFIGS[activeTier][feature];

    if (typeof featureLimit === "boolean") {
        return featureLimit;
    }
    return true;
}

export function getFeatureLimit<K extends keyof TierConfig>(
    tier: SubscriptionTier | string | null | undefined,
    feature: K
): TierConfig[K] {
    const activeTier = resolveSubscriptionTier(tier as string);
    return TIER_CONFIGS[activeTier][feature];
}
