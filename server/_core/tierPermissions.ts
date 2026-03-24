export type SubscriptionTier = "basic" | "pro" | "elite"; // Keep elite in type to match DB enum safely

export interface TierConfig {
    maxAppointments: number;
    canUseDepositEngine: boolean;
    canUseWizard: boolean; // false = simple form only
    canUseAutomatedReminders: boolean;
    canUsePromotions: boolean;
    canRemoveBranding: boolean;
    canUseCustomMessaging: boolean;
    canUseMarketingBroadcasts: boolean;
    canUseWaitlist: boolean;
    canUseAIVoiceNotes: boolean;
    canProcessFinalPayments: boolean;
    maxStorageGB: number; // 0 for unlimited or large number
}

export const TIER_CONFIGS: Record<SubscriptionTier, TierConfig> = {
    basic: {
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
        maxStorageGB: 1, // Example: 1GB limit for free tier
    },
    pro: {
        maxAppointments: Infinity, // Unlimited
        canUseDepositEngine: true,
        canUseWizard: true,
        canUseAutomatedReminders: true,
        canUsePromotions: true,
        canRemoveBranding: true, // Pro gets everything now
        canUseCustomMessaging: true,
        canUseMarketingBroadcasts: true,
        canUseWaitlist: true,
        canUseAIVoiceNotes: true,
        canProcessFinalPayments: true,
        maxStorageGB: Infinity,
    },
    // We map elite to pro exactly, just in case any legacy data exists
    elite: {
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
    tier: SubscriptionTier | null | undefined,
    feature: K
): boolean {
    const activeTier = tier || "basic";
    const featureLimit = TIER_CONFIGS[activeTier][feature];

    if (typeof featureLimit === "boolean") {
        return featureLimit;
    }
    return true; // If it's a number (like maxAppointments), we handle that logic separately
}

export function getFeatureLimit<K extends keyof TierConfig>(
    tier: SubscriptionTier | null | undefined,
    feature: K
): TierConfig[K] {
    const activeTier = tier || "basic";
    return TIER_CONFIGS[activeTier][feature];
}
