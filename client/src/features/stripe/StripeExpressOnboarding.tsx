/**
 * StripeExpressOnboarding — Embedded Connect Onboarding
 *
 * Renders the Stripe Connect embedded onboarding component for Express accounts.
 * Uses @stripe/connect-js + @stripe/react-connect-js.
 *
 * Props:
 *   - onComplete: called when onboarding finishes successfully
 *   - isResuming: if true, the artist is resuming incomplete onboarding (Branch 4)
 *
 * Architecture:
 *   - fetchClientSecret uses the vanilla tRPC client (not hooks) per spec
 *   - Returns "" on error (does not throw) per Stripe SDK requirements
 *   - loadConnectAndInitialize is called once on mount via useMemo
 */

import { useState, useMemo } from "react";
import {
    ConnectComponentsProvider,
    ConnectAccountOnboarding,
} from "@stripe/react-connect-js";
import { loadConnectAndInitialize } from "@stripe/connect-js";
import { trpcVanilla } from "@/lib/trpcVanilla";
import { trpc } from "@/lib/trpc";
import { tokens } from "@/ui/tokens";
import { cn } from "@/lib/utils";
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
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const utils = trpc.useUtils();

    // Publishable key from env — must be VITE_ prefixed for client exposure
    const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "";

    /**
     * Initialize the Stripe Connect instance using useState lazy initialization.
     * This prevents React 18/19 Strict Mode from double-invoking it and destroying the singleton.
     */
    const [stripeConnectInstance] = useState(() => {
        if (!publishableKey) {
            console.error(
                "[StripeExpressOnboarding] VITE_STRIPE_PUBLISHABLE_KEY is not set"
            );
            return null;
        }

        return loadConnectAndInitialize({
            publishableKey,
            fetchClientSecret: async () => {
                try {
                    const result =
                        await trpcVanilla.artistSettings.createStripeAccountSession.mutate();
                    return result.clientSecret;
                } catch (err: any) {
                    console.error(
                        "[StripeExpressOnboarding] fetchClientSecret error:",
                        err
                    );
                    setFetchError(err.message || "Failed to initialize Stripe securely.");
                    return "";
                }
            },
            appearance: {
                overlays: "dialog",
                variables: {
                    colorPrimary: "#E09F3E",
                    colorBackground: "#0b1120", // Changed to match Tattoi dark theme exactly
                    colorText: "#ffffff",
                    colorDanger: "#ef4444",
                    borderRadius: "12px",
                },
            },
        });
    });

    const handleExit = () => {
        setCompleted(true);
        // Invalidate all related queries so the UI refreshes
        utils.artistSettings.get.invalidate();
        utils.artistSettings.getStripeConnectStatus.invalidate();
        onComplete?.();
    };

    // Missing publishable key
    if (!publishableKey) {
        return (
            <div
                className={cn(
                    tokens.card.base,
                    tokens.card.bg,
                    "border-0 p-5 text-center"
                )}
            >
                <p className="text-sm text-red-400">
                    Stripe configuration missing. Please contact support.
                </p>
            </div>
        );
    }

    // Completed state
    if (completed) {
        return (
            <div
                className={cn(
                    tokens.card.base,
                    tokens.card.bg,
                    "border-0 p-6 text-center space-y-3"
                )}
            >
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <h3 className="font-bold text-foreground">
                    Onboarding Complete
                </h3>
                <p className="text-sm text-muted-foreground">
                    Your Stripe account is now set up. Payouts will begin
                    automatically.
                </p>
            </div>
        );
    }

    if (!stripeConnectInstance) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
        );
    }

    if (fetchError) {
        return (
            <div
                className={cn(
                    tokens.card.base,
                    tokens.card.bg,
                    "border-0 p-5 text-center mt-10"
                )}
            >
                <p className="text-sm text-red-500 font-semibold mb-2">Connection Error</p>
                <p className="text-xs text-muted-foreground">{fetchError}</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {isResuming && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                    <p className="text-xs text-amber-400 font-semibold">
                        Your onboarding is incomplete. Please finish the
                        remaining steps below.
                    </p>
                </div>
            )}

            <div
                className={cn(
                    tokens.card.base,
                    tokens.card.bg,
                    "border-0 overflow-hidden h-[650px] w-full flex flex-col relative"
                )}
            >
                <ConnectComponentsProvider
                    connectInstance={stripeConnectInstance}
                >
                    <div className="w-full flex-1 h-full pt-2">
                        <ConnectAccountOnboarding onExit={handleExit} />
                    </div>
                </ConnectComponentsProvider>
            </div>
        </div>
    );
}
