/**
 * Subscriptions Page — Container Component
 *
 * Fetches subscription status and tier configs via tRPC,
 * passes to PricingPage presentational component.
 * Handles upgrade/manage mutations. No rendering logic.
 */

import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { PageShell, PageHeader, LoadingState } from "@/components/ui/ssot";
import { PricingPage, type SubscriptionStatus, type TierDisplayConfig } from "@/features/pricing/PricingPage";

// Stripe Price ID for Pro plan (set in env)
const PRO_PRICE_ID = import.meta.env.VITE_STRIPE_PRO_PRICE_ID || "price_pro_monthly";

/**
 * Tier configs derived from PAYMENT_TIERS SSOT.
 * These MUST match the values in server/domain/fees.ts.
 *
 * TODO: Expose a tRPC query (e.g., billing.tierConfigs) so these are fetched
 * from the server SSOT instead of duplicated. For now, they match fees.ts exactly.
 */
const FREE_TIER: TierDisplayConfig = {
  artistFeeRate: 0.020,
  platformFeeRate: 0.034,
  subscriptionPriceCents: 0,
  defaultDepositPercent: 25,
};

const PRO_TIER: TierDisplayConfig = {
  artistFeeRate: 0.000,
  platformFeeRate: 0.034,
  subscriptionPriceCents: 6000,
  defaultDepositPercent: 25,
};

export default function Subscriptions() {
  const [, setLocation] = useLocation();

  // Fetch current subscription status
  const statusQuery = trpc.billing.subscriptionStatus.useQuery();

  // Mutations
  const createCheckout = trpc.billing.createArtistCheckoutSession.useMutation({
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (err) => {
      toast.error(err.message || "Failed to initiate checkout");
    },
  });

  const createPortal = trpc.billing.createArtistPortalSession.useMutation({
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (err) => {
      toast.error(err.message || "Failed to open billing portal");
    },
  });

  if (statusQuery.isLoading) {
    return (
      <PageShell>
        <PageHeader title="Pricing" onBack={() => setLocation("/settings")} />
        <LoadingState message="Loading subscription..." fullScreen />
      </PageShell>
    );
  }

  const status: SubscriptionStatus = statusQuery.data || {
    tier: "free" as const,
    tierLabel: "Free",
    artistFeeRate: 0.02,
    platformFeeRate: 0.034,
    subscriptionPriceCents: 0,
    stripeSubscriptionId: null,
    renewalDate: null,
    cancelAtPeriodEnd: false,
    isActive: false,
  };

  const handleUpgradePro = () => {
    createCheckout.mutate({ priceId: PRO_PRICE_ID });
  };

  const handleManageSubscription = () => {
    createPortal.mutate();
  };

  const isLoading = createCheckout.isPending || createPortal.isPending;

  return (
    <PageShell>
      <PageHeader title="Pricing" onBack={() => setLocation("/settings")} />
      <div className="flex-1 overflow-y-auto mobile-scroll touch-pan-y pt-4">
        <PricingPage
          status={status}
          freeTier={FREE_TIER}
          proTier={PRO_TIER}
          onUpgradePro={handleUpgradePro}
          onManageSubscription={handleManageSubscription}
          isLoading={isLoading}
        />
      </div>
    </PageShell>
  );
}
