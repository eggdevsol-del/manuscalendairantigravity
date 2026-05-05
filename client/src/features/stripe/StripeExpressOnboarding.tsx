/**
 * StripeExpressOnboarding — Embedded Connect Onboarding (Desktop Only)
 *
 * Renders the Stripe Connect embedded onboarding component for Custom accounts.
 * Uses @stripe/connect-js + @stripe/react-connect-js.
 *
 * This component is only rendered on desktop browsers where the embedded iframe
 * works reliably. Mobile/PWA uses redirect-based Account Links instead
 * (handled by BankPayoutsPage).
 */

import { useState } from "react";
import {
    ConnectComponentsProvider,
    ConnectAccountOnboarding,
} from "@stripe/react-connect-js";
import { loadConnectAndInitialize } from "@stripe/connect-js";
import { trpcVanilla } from "@/lib/trpcVanilla";
import { trpc } from "@/lib/trpc";
import { Loader2, CheckCircle2 } from "lucide-react";

interface StripeExpressOnboardingProps {
    onComplete?: () => void;
    isResuming?: boolean;
}

export function StripeExpressOnboarding({
    onComplete,
    isResuming = false,
}: StripeExpressOnboardingProps) {
    const [completed, setCompleted] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const utils = trpc.useUtils();

    const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "";

    const [stripeConnectInstance] = useState(() => {
        if (!publishableKey) return null;

        return loadConnectAndInitialize({
            publishableKey,
            fetchClientSecret: async () => {
                try {
                    const result = await trpcVanilla.artistSettings.createStripeAccountSession.mutate();
                    return result.clientSecret;
                } catch (err: any) {
                    console.error("[StripeExpressOnboarding] fetchClientSecret error:", err);
                    setFetchError(err.message || "Failed to initialize Stripe securely.");
                    return "";
                }
            },
            appearance: {
                overlays: "dialog",
                variables: {
                    colorPrimary: "#E09F3E",
                    colorBackground: "#0b1120",
                    colorText: "#ffffff",
                    colorDanger: "#ef4444",
                    borderRadius: "12px",
                },
            },
        });
    });

    const handleExit = () => {
        setCompleted(true);
        utils.artistSettings.get.invalidate();
        utils.artistSettings.getStripeConnectStatus.invalidate();
        onComplete?.();
    };

    if (!publishableKey) {
        return (
            <div className="text-center p-6">
                <p className="text-sm text-red-400">
                    Stripe configuration missing. Please contact support.
                </p>
            </div>
        );
    }

    if (completed) {
        return (
            <div className="text-center p-6 space-y-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <h3 className="font-bold text-foreground">Onboarding Complete</h3>
                <p className="text-sm text-muted-foreground">
                    Your Stripe account is now set up. Payouts will begin automatically.
                </p>
            </div>
        );
    }

    if (!stripeConnectInstance) {
        return (
            <div className="flex flex-col items-center justify-center p-8 mt-4 space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground animate-pulse">
                    Connecting to Stripe...
                </p>
            </div>
        );
    }

    if (fetchError) {
        return (
            <div className="text-center p-6 mt-10">
                <p className="text-sm text-red-500 font-semibold mb-2">Connection Error</p>
                <p className="text-xs text-muted-foreground">{fetchError}</p>
            </div>
        );
    }

    return (
        <div className="space-y-3 w-full">
            {isResuming && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                    <p className="text-xs text-amber-400 font-semibold">
                        Your onboarding is incomplete. Please finish the
                        remaining steps below.
                    </p>
                </div>
            )}

            <div style={{ width: "100%", minHeight: "600px" }}>
                <ConnectComponentsProvider connectInstance={stripeConnectInstance}>
                    <div style={{ width: "100%", minHeight: "600px" }}>
                        <ConnectAccountOnboarding onExit={handleExit} />
                    </div>
                </ConnectComponentsProvider>
            </div>
        </div>
    );
}
