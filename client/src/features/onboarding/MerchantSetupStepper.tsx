import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui";

export function MerchantSetupStepper() {
  const status = trpc.merchantAuth.getMerchantStripeStatus.useQuery(undefined, {
    refetchInterval: 30000,
  });
  const connect = trpc.merchantAuth.connectStripe.useMutation({
    onSuccess: ({ url }) => {
      window.location.assign(url);
    },
  });
  const ready = status.data?.chargesEnabled && status.data?.payoutsEnabled;
  return (
    <section className="rounded-2xl border bg-card p-5 space-y-3">
      <h2 className="font-semibold">Payments and payouts</h2>
      {status.isLoading ? (
        <p role="status">Checking your payment account…</p>
      ) : status.error ? (
        <p role="alert">We couldn't check your payment account. Try again.</p>
      ) : (
        <p className="text-sm text-muted-foreground">
          {ready
            ? "Stripe is ready to accept payments and send payouts."
            : status.data?.connected
              ? "Your Stripe account needs more information or verification. Resume setup to see the next step."
              : "Connect your business account to accept payments and receive payouts."}
        </p>
      )}
      {connect.error && (
        <p role="alert" className="text-destructive">
          {connect.error.message}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        {!ready && (
          <Button
            className="min-h-12"
            disabled={connect.isPending || status.isLoading}
            onClick={() => connect.mutate()}
          >
            {connect.isPending
              ? "Opening Stripe…"
              : status.data?.connected
                ? "Resume Stripe setup"
                : "Connect Stripe"}
          </Button>
        )}
        <Button
          variant="outline"
          className="min-h-12"
          disabled={status.isFetching}
          onClick={() => void status.refetch()}
        >
          Check status
        </Button>
      </div>
    </section>
  );
}
