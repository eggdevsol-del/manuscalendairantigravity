/**
 * StripeExpressOnboarding — Embedded Connect Onboarding
 *
 * Renders the Stripe Connect embedded onboarding component for Custom accounts.
 * Uses @stripe/connect-js + @stripe/react-connect-js.
 * Custom accounts use disable_stripe_user_authentication for popup-free onboarding.
 *
 * Props:
 *   - onComplete: called when onboarding finishes successfully
 *   - isResuming: if true, the artist is resuming incomplete onboarding (Branch 4)
 *
 * Architecture:
 *   - fetchClientSecret uses the vanilla tRPC client (not hooks) per spec
 *   - Returns "" on error (does not throw) per Stripe SDK requirements
 *   - loadConnectAndInitialize is called once on mount via useState lazy init
 *   - MutationObserver detects and forces iframe dimensions on Android PWA
 *     where the Stripe shadow DOM iframe collapses to 0px height
 */

import { useState, useEffect, useRef, useCallback } from "react";
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
    const [iframeVisible, setIframeVisible] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const utils = trpc.useUtils();

    // Publishable key from env — must be VITE_ prefixed for client exposure
    const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "";

    /**
     * Initialize the Stripe Connect instance strictly inside a useState lazy initializer.
     * This protects loadConnectAndInitialize from React Strict Mode double-invocations
     * that otherwise throw synchronous terminal errors during useEffect remounts.
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
                    colorBackground: "#0b1120", // Matches Tattoi dark theme
                    colorText: "#ffffff",
                    colorDanger: "#ef4444",
                    borderRadius: "12px",
                },
            },
        });
    });

    /**
     * Android PWA iframe fix:
     * The Stripe Connect SDK renders a custom element with a shadow DOM containing
     * an iframe. On Android PWA (standalone webview), the iframe collapses to 0px
     * because the shadow DOM's resize postMessage mechanism fails.
     *
     * This effect uses a MutationObserver to detect when the custom element appears,
     * then polls for the iframe inside the shadow DOM and forces its dimensions.
     */
    useEffect(() => {
        if (!containerRef.current || !stripeConnectInstance) return;

        let pollInterval: ReturnType<typeof setInterval> | null = null;

        const forceIframeDimensions = () => {
            const el = containerRef.current?.querySelector(
                "stripe-connect-account-onboarding"
            ) as HTMLElement | null;

            if (!el) return false;

            // Force the host element to be visible and sized
            el.style.display = "block";
            el.style.width = "100%";
            el.style.minHeight = "600px";

            // Try open shadow DOM
            const shadow = (el as any).shadowRoot;
            if (shadow) {
                const iframes = shadow.querySelectorAll("iframe");
                if (iframes.length > 0) {
                    iframes.forEach((iframe: HTMLIFrameElement) => {
                        iframe.style.width = "100%";
                        iframe.style.minHeight = "600px";
                        iframe.style.height = "auto";
                        iframe.style.display = "block";
                    });

                    // Also force any wrapper divs
                    const divs = shadow.querySelectorAll("div");
                    divs.forEach((div: HTMLDivElement) => {
                        if (div.style.height === "0px" || div.offsetHeight === 0) {
                            div.style.minHeight = "600px";
                        }
                    });

                    setIframeVisible(true);
                    return true;
                }
            }

            // Fallback: try querySelectorAll on the element itself
            // (works if custom element doesn't use closed shadow DOM)
            const directIframes = el.querySelectorAll("iframe");
            if (directIframes.length > 0) {
                directIframes.forEach((iframe) => {
                    (iframe as HTMLIFrameElement).style.width = "100%";
                    (iframe as HTMLIFrameElement).style.minHeight = "600px";
                    (iframe as HTMLIFrameElement).style.display = "block";
                });
                setIframeVisible(true);
                return true;
            }

            return false;
        };

        // Start polling immediately and on DOM changes
        const observer = new MutationObserver(() => {
            forceIframeDimensions();
        });

        observer.observe(containerRef.current, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["style"],
        });

        // Also poll on interval as a safety net (shadow DOM mutations
        // may not be caught by the light DOM observer)
        pollInterval = setInterval(() => {
            const found = forceIframeDimensions();
            if (found && pollInterval) {
                // Keep polling but less frequently once found
                clearInterval(pollInterval);
                pollInterval = setInterval(forceIframeDimensions, 3000);
            }
        }, 500);

        return () => {
            observer.disconnect();
            if (pollInterval) clearInterval(pollInterval);
        };
    }, [stripeConnectInstance]);

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

            <div className="w-full min-h-[600px] relative">
                <ConnectComponentsProvider
                    connectInstance={stripeConnectInstance}
                >
                    <div className="w-full min-h-[600px]">
                        <ConnectAccountOnboarding onExit={handleExit} />
                    </div>
                </ConnectComponentsProvider>

                {/* Loading overlay — shown until iframe content becomes visible */}
                {!iframeVisible && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 pointer-events-none">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <p className="text-xs text-muted-foreground animate-pulse">
                            Loading onboarding form...
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
