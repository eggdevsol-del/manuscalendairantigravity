import { Button } from "@/components/ui";
import { PAYMENT_TIERS, MIN_PLATFORM_FEE_CENTS } from "@shared/fees";
export interface SubscriptionStatus {
  tier: "free" | "pro" | "top";
  tierLabel: string;
  artistFeeRate: number;
  platformFeeRate: number;
  subscriptionPriceCents: number;
  stripeSubscriptionId: string | null;
  renewalDate: string | null;
  cancelAtPeriodEnd: boolean;
  isActive: boolean;
}
export function PricingPage({
  status,
  onUpgradePro,
  onStudio,
  onManageSubscription,
  isLoading,
  proAvailable,
}: {
  status: SubscriptionStatus;
  onUpgradePro: () => void;
  onStudio: () => void;
  onManageSubscription: () => void;
  isLoading: boolean;
  proAvailable: boolean;
}) {
  const dollars = (cents: number) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 0,
    }).format(cents / 100);
  const plans = [
    {
      key: "free",
      features: [
        "Calendar and client messaging",
        "Bookings and deposits",
        "25% deposit",
        "2% Tattoi artist fee",
      ],
    },
    {
      key: "pro",
      features: [
        "Everything in Free",
        "0% Tattoi artist fee",
        "Custom deposit percentage",
        "Optional payment in full",
      ],
    },
    {
      key: "top",
      features: [
        "Pro payment benefits for up to 10 artists",
        "Shared studio schedule",
        "Team invitations and access management",
        "One studio subscription",
      ],
    },
  ] as const;
  return (
    <div className="max-w-5xl mx-auto px-4 pb-32 space-y-6">
      <section className="rounded-2xl bg-secondary p-5">
        <p className="text-sm text-muted-foreground">Your plan</p>
        <h2 className="text-2xl font-semibold">{status.tierLabel}</h2>
        {status.renewalDate && (
          <p className="text-sm mt-2">
            {status.cancelAtPeriodEnd ? "Access ends" : "Renews"}{" "}
            {new Date(status.renewalDate).toLocaleDateString("en-AU")}
          </p>
        )}
        {status.stripeSubscriptionId && (
          <Button
            className="mt-3"
            variant="outline"
            disabled={isLoading}
            onClick={onManageSubscription}
          >
            Manage Pro billing
          </Button>
        )}
        {status.tier === "top" && (
          <Button className="mt-3" variant="outline" onClick={onStudio}>
            Open studio
          </Button>
        )}
      </section>
      <div className="grid md:grid-cols-3 gap-4">
        {plans.map(plan => {
          const config = PAYMENT_TIERS[plan.key];
          return (
            <section
              key={plan.key}
              className="rounded-2xl border bg-card p-5 flex flex-col gap-4"
            >
              <h2 className="text-xl font-semibold">{config.label}</h2>
              <p>
                <strong className="text-3xl">
                  {dollars(config.subscriptionPriceCents)}
                </strong>
                <span className="text-sm text-muted-foreground">
                  {" "}
                  AUD / month
                </span>
              </p>
              <ul className="space-y-3 flex-1">
                {plan.features.map(feature => (
                  <li key={feature} className="text-sm">
                    ✓ {feature}
                  </li>
                ))}
              </ul>
              {plan.key === "free" ? (
                <p className="text-sm text-muted-foreground">
                  {status.tier === "free"
                    ? "Your current plan"
                    : "Manage billing to cancel renewal."}
                </p>
              ) : plan.key === "pro" ? (
                <Button
                  disabled={
                    isLoading || status.tier !== "free" || !proAvailable
                  }
                  onClick={onUpgradePro}
                >
                  {status.tier === "pro"
                    ? "Current plan"
                    : status.tier === "top"
                      ? "Included in Studio"
                      : !proAvailable
                        ? "Billing unavailable"
                        : "Choose Pro"}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  disabled={isLoading}
                  onClick={onStudio}
                >
                  {status.tier === "top" ? "Manage studio" : "Set up Studio"}
                </Button>
              )}
            </section>
          );
        })}
      </div>
      <section className="rounded-2xl border p-5 space-y-3">
        <h2 className="text-lg font-semibold">When does Pro pay for itself?</h2>
        <p className="text-sm">
          At{" "}
          {dollars(
            Math.round(
              PAYMENT_TIERS.pro.subscriptionPriceCents /
                PAYMENT_TIERS.free.artistFeeRate
            )
          )}{" "}
          in monthly artist payments, Free’s 2% artist fees equal Pro’s monthly
          price. Above that, Pro reduces your Tattoi artist fees.
        </p>
        <p className="text-sm text-muted-foreground">
          On Free, the artist fee is deducted when payment is collected, before
          payout to your bank. Pro and active Studio members pay no Tattoi
          artist fee on new payments. Upgrading does not refund fees on past
          payments.
        </p>
      </section>
      <section className="rounded-2xl border p-5 space-y-3">
        <h2 className="text-lg font-semibold">Clear payment fees</h2>
        <p className="text-sm">
          Clients pay the same{" "}
          {(PAYMENT_TIERS.free.platformFeeRate * 100).toFixed(1)}% platform fee
          on every plan, with a {dollars(MIN_PLATFORM_FEE_CENTS)} minimum per
          payment. The checkout shows the total before payment.
        </p>
        <p className="text-sm text-muted-foreground">
          Studio covers up to 10 active artists, including its owner. Members
          retain their own clients and personal history. Monthly subscriptions
          renew until cancelled; Stripe checkout shows the final subscription
          amount.
        </p>
      </section>
    </div>
  );
}
