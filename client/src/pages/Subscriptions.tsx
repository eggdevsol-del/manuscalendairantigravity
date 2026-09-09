import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { PageShell, PageHeader } from "@/components/ui/ssot";
import { Button } from "@/components/ui";
import { PricingPage } from "@/features/pricing/PricingPage";
export default function Subscriptions() {
  const [, navigate] = useLocation();
  const status = trpc.billing.subscriptionStatus.useQuery(undefined, {
    refetchInterval: 15000,
  });
  const offer = trpc.billing.artistOffer.useQuery();
  const checkout = trpc.billing.createArtistCheckoutSession.useMutation({
    onSuccess: data => {
      if (data.url) window.location.assign(data.url);
    },
  });
  const portal = trpc.billing.createArtistPortalSession.useMutation({
    onSuccess: data => {
      if (data.url) window.location.assign(data.url);
    },
  });
  const error = checkout.error || portal.error;
  return (
    <PageShell>
      <PageHeader title="Plans" onBack={() => navigate("/settings")} />
      <div className="flex-1 overflow-y-auto mobile-scroll pt-4">
        {status.isLoading && (
          <p className="p-6" role="status">
            Loading your plan…
          </p>
        )}
        {status.error && (
          <div className="p-6" role="alert">
            <p>We couldn’t load your plan.</p>
            <Button onClick={() => void status.refetch()}>Retry</Button>
          </div>
        )}
        {error && (
          <p className="px-4 py-3 text-destructive" role="alert">
            {error.message}
          </p>
        )}
        {status.data && (
          <PricingPage
            status={status.data}
            onUpgradePro={() => checkout.mutate({})}
            onStudio={() => navigate("/studio")}
            onManageSubscription={() => portal.mutate()}
            isLoading={checkout.isPending || portal.isPending}
            proAvailable={!!offer.data}
          />
        )}
      </div>
    </PageShell>
  );
}
