import React from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { SubscriptionTier, canAccessFeature, TierConfig } from "../../../../server/_core/tierPermissions";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

interface FeatureLockProps {
    feature: keyof TierConfig;
    children: React.ReactNode;
    fallbackMessage?: string;
    requiredTierName?: string;
}

export function FeatureLock({
    feature,
    children,
    fallbackMessage = "This feature requires an upgraded subscription.",
    requiredTierName = "Pro",
}: FeatureLockProps) {
    const { user } = useAuth();
    const [, setLocation] = useLocation();

    // For safety, assume basic if role is not fully loaded or artistSettings is missing in user object
    // Depending on how user is loaded, artistSettings.subscriptionTier might be at user.artistSettings.subscriptionTier
    const currentTier = (user as any)?.artistSettings?.subscriptionTier as SubscriptionTier | undefined;

    const hasAccess = canAccessFeature(currentTier, feature);

    if (hasAccess) {
        return <>{children}</>;
    }

    return (
        <div className="relative isolate overflow-hidden rounded-xl border border-white/10 bg-black/40 p-6 shadow-2xl backdrop-blur-md w-full">
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent opacity-50" />
            <div className="flex flex-col items-center justify-center text-center space-y-4 py-8">
                <div className="rounded-full bg-white/10 p-4 border border-white/5 shadow-inner">
                    <Lock className="w-8 h-8 text-amber-500/80" />
                </div>
                <div className="space-y-2 max-w-sm">
                    <h3 className="text-xl font-light text-white tracking-wide">
                        {requiredTierName} Feature
                    </h3>
                    <p className="text-sm font-light text-muted-foreground leading-relaxed">
                        {fallbackMessage}
                    </p>
                </div>
                <Button
                    onClick={() => setLocation("/settings/billing")}
                    variant="hero"
                    className="mt-4 px-8"
                >
                    View Plans
                </Button>
            </div>
        </div>
    );
}
