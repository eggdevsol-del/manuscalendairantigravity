/**
 * PayoutWidgetContainer — Container Component
 *
 * Handles data fetching via tRPC and passes results to PayoutWidget.
 * Container components handle data fetching, mutations, and selector usage
 * and pass results to presentational components (per user rules).
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { PayoutWidget } from "./PayoutWidget";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { RefundConfirmationFAB } from "./RefundConfirmationFAB";

interface PayoutWidgetContainerProps {
    period?: "7d" | "30d" | "90d" | "all";
}

export function PayoutWidgetContainer({
    period = "30d",
}: PayoutWidgetContainerProps) {
    const [, setLocation] = useLocation();
    const [showTransactions, setShowTransactions] = useState(false);
    const [selectedRefundTransaction, setSelectedRefundTransaction] = useState<any | null>(null);

    // Fetch payout data
    const nextPayoutQuery = trpc.payouts.nextPayout.useQuery();
    const earningsQuery = trpc.payouts.earningsBreakdown.useQuery({ period });
    const connectStatusQuery = trpc.artistSettings.getStripeConnectStatus.useQuery();

    // Fetch transaction history only when expanded
    const historyQuery = trpc.payouts.payoutHistory.useQuery(
        { limit: 20 },
        { enabled: showTransactions }
    );

    // Connect Stripe mutation
    const connectStripe = trpc.artistSettings.connectStripe.useMutation();

    const accountType = connectStatusQuery.data?.accountType || "standard";

    const handleConnectStripe = async () => {
        try {
            toast.info("Connecting to Stripe...");
            const result = await connectStripe.mutateAsync();

            // Standard → redirect
            if (result.url) {
                window.location.href = result.url;
            } else if (result.accountType === "custom") {
                // Custom → redirect to bank payouts page for embedded onboarding
                setLocation("/bank-payouts");
            } else if (result.alreadyConnected) {
                toast.success("Stripe is already connected!");
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to connect Stripe");
        }
    };

    const handleToggleTransactions = () => {
        setShowTransactions((prev) => !prev);
    };

    const handleViewHistory = () => {
        setLocation("/payout-history");
    };

    // Loading state
    if (nextPayoutQuery.isLoading) {
        return (
            <div className="animate-pulse bg-secondary/50 rounded-2xl h-48" />
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

    // Express connected → no connect button (managed via Settings)
    // Standard connected → show Dashboard link via onConnectStripe={undefined}
    const showConnectButton = !payoutData.connected;

    // Derive transaction entries from history query
    const transactions = (historyQuery.data?.entries || []) as any[];

    return (
        <>
            <PayoutWidget
                {...payoutData}
                earnings={earningsQuery.data || undefined}
                showTransactions={showTransactions}
                transactions={transactions}
                isLoadingTransactions={historyQuery.isLoading}
                onToggleTransactions={handleToggleTransactions}
                onViewHistory={handleViewHistory}
                onConnectStripe={showConnectButton ? handleConnectStripe : undefined}
                onRefundRequest={(tx) => setSelectedRefundTransaction(tx)}
            />

            <RefundConfirmationFAB
                isOpen={!!selectedRefundTransaction}
                onClose={() => setSelectedRefundTransaction(null)}
                transaction={selectedRefundTransaction}
                onSuccess={() => {
                    historyQuery.refetch();
                    nextPayoutQuery.refetch();
                    earningsQuery.refetch();
                }}
            />
        </>
    );
}
