/**
 * PayoutWidgetContainer — Container Component
 *
 * Handles data fetching via tRPC and passes results to PayoutWidget.
 * Container components handle data fetching, mutations, and selector usage
 * and pass results to presentational components (per user rules).
 */

import { trpc } from "@/lib/trpc";
import { PayoutWidget } from "./PayoutWidget";
import { useLocation } from "wouter";
import { toast } from "sonner";

interface PayoutWidgetContainerProps {
    period?: "7d" | "30d" | "90d" | "all";
}

export function PayoutWidgetContainer({
    period = "30d",
}: PayoutWidgetContainerProps) {
    const [, setLocation] = useLocation();

    // Fetch payout data
    const nextPayoutQuery = trpc.payouts.nextPayout.useQuery();
    const earningsQuery = trpc.payouts.earningsBreakdown.useQuery({ period });

    // Connect Stripe mutation
    const connectStripe = trpc.artistSettings.connectStripe.useMutation();

    const handleConnectStripe = async () => {
        try {
            toast.info("Connecting to Stripe...");
            const result = await connectStripe.mutateAsync();
            if (result.url) {
                window.location.href = result.url;
            } else if (result.alreadyConnected) {
                toast.success("Stripe is already connected!");
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to connect Stripe");
        }
    };

    const handleViewHistory = () => {
        setLocation("/payout-history");
    };

    // Loading state
    if (nextPayoutQuery.isLoading) {
        return (
            <div className="animate-pulse bg-white/5 rounded-2xl h-48" />
        );
    }

    const payoutData = nextPayoutQuery.data || {
        connected: false,
        pendingAmountCents: 0,
        nextPayoutAmountCents: null,
        nextPayoutArrivalDate: null,
        nextPayoutStatus: null,
        currency: "aud",
    };

    return (
        <PayoutWidget
            {...payoutData}
            earnings={earningsQuery.data || undefined}
            onViewHistory={handleViewHistory}
            onConnectStripe={handleConnectStripe}
        />
    );
}
