/**
 * StripeExpressOnboarding — Embedded Connect Onboarding
 *
 * Renders the Stripe Connect embedded onboarding component for Custom accounts.
 * Uses @stripe/connect-js + @stripe/react-connect-js.
 * Custom accounts use disable_stripe_user_authentication for popup-free onboarding.
 *
 * On Android PWA, the Stripe iframe may fail to render inside the standalone
 * webview. After a timeout, a fallback button is shown to open onboarding
 * via Stripe Account Links (redirect-based) in the system browser.
 */

import { useState, useEffect, useRef } from "react";
import {
    ConnectComponentsProvider,
    ConnectAccountOnboarding,
} from "@stripe/react-connect-js";
import { loadConnectAndInitialize } from "@stripe/connect-js";
import { trpcVanilla } from "@/lib/trpcVanilla";
import { trpc } from "@/lib/trpc";
import { Loader2, CheckCircle2, ExternalLink } from "lucide-react";

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
    const [showFallback, setShowFallback] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
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

    /**
     * Fallback timer: if the Stripe iframe hasn't rendered any visible content
     * after 12 seconds, show a fallback "Open in browser" button.
     * This handles Android PWA where the embedded iframe silently fails.
     */
    useEffect(() => {
        if (!stripeConnectInstance || fetchError || completed) return;

        const timer = setTimeout(() => {
            // Check if the Stripe element has rendered visible content
            const el = containerRef.current?.querySelector(
                "stripe-connect-account-onboarding"
            ) as HTMLElement | null;

            if (!el || el.offsetHeight < 50) {
                console.warn("[StripeExpressOnboarding] Stripe iframe not visible after timeout, showing fallback");
                setShowFallback(true);
            }
        }, 12000);

        return () => clearTimeout(timer);
    }, [stripeConnectInstance, fetchError, completed]);

    const handleExit = () => {
        setCompleted(true);
        utils.artistSettings.get.invalidate();
        utils.artistSettings.getStripeConnectStatus.invalidate();
        onComplete?.();
    };

    const handleOpenInBrowser = async () => {
        try {
            const result = await trpcVanilla.artistSettings.getStripeAccountLink.mutate();
            if (result.url) {
                window.open(result.url, "_blank");
            }
        } catch (err: any) {
            setFetchError(err.message || "Failed to open onboarding.");
        }
    };

    // Missing publishable key
    if (!publishableKey) {
        return (
            <div className="text-center p-6">
                <p className="text-sm text-red-400">
                    Stripe configuration missing. Please contact support.
                </p>
            </div>
        );
    }

    // Completed state
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
        <div className="space-y-3 w-full" ref={containerRef}>
            {isResuming && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                    <p className="text-xs text-amber-400 font-semibold">
                        Your onboarding is incomplete. Please finish the
                        remaining steps below.
                    </p>
                </div>
            )}

            {/* Stripe embedded component — full width, no overflow constraints */}
            <div
                style={{ width: "100%", minHeight: "600px" }}
            >
                <ConnectComponentsProvider connectInstance={stripeConnectInstance}>
                    <div style={{ width: "100%", minHeight: "600px" }}>
                        <ConnectAccountOnboarding onExit={handleExit} />
                    </div>
                </ConnectComponentsProvider>
            </div>

            {/* Fallback for Android PWA: shown after timeout if iframe doesn't render */}
            {showFallback && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-center space-y-3">
                    <p className="text-sm text-amber-400 font-semibold">
                        Having trouble loading?
                    </p>
                    <p className="text-xs text-muted-foreground">
                        The onboarding form may not work in this browser.
                        You can complete setup in your system browser instead.
                    </p>
                    <button
                        onClick={handleOpenInBrowser}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#E09F3E]/80 hover:bg-[#E09F3E] text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        <ExternalLink className="w-4 h-4" />
                        Open in Browser
                    </button>
                </div>
            )}
        </div>
    );
}
