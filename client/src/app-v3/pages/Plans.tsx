import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { PAYMENT_TIERS, MIN_PLATFORM_FEE_CENTS } from "@shared/fees";
import { money } from "@/features/workspace/bookingPresentation";
import { SubscriptionCheckoutSheet } from "./SubscriptionCheckout";
import {
  Action,
  ActionLink,
  Feedback,
  Panel,
  Screen,
  Section,
  Status,
} from "../design/primitives";

export default function Plans() {
  const status = trpc.billing.subscriptionStatus.useQuery(undefined, {
    refetchInterval: 15000,
  });
  const offer = trpc.billing.artistOffer.useQuery();
  const [secret, setSecret] = useState<string | null>(null);
  const checkout = trpc.billing.createArtistCheckoutSession.useMutation({
    onSuccess: data => setSecret(data.clientSecret),
  });
  const portal = trpc.billing.createArtistPortalSession.useMutation({
    onSuccess: data => window.location.assign(data.url),
  });
  const busy = checkout.isPending || portal.isPending;
  const plans = [
    {
      key: "free",
      features: [
        "Calendar, bookings and client messaging",
        "Deposits and client records",
        `${PAYMENT_TIERS.free.defaultDepositPercent}% deposit`,
        `${PAYMENT_TIERS.free.artistFeeRate * 100}% Tattoi artist fee`,
      ],
    },
    {
      key: "pro",
      features: [
        "Everything in Free",
        "No Tattoi artist fee on new payments",
        "Choose your deposit percentage",
        "Offer payment in full",
      ],
    },
    {
      key: "top",
      features: [
        "Pro benefits for up to 10 active artists",
        "Shared studio schedule",
        "Team invitations and access controls",
        "Your clients stay yours",
      ],
    },
  ] as const;
  return (
    <Screen
      title="Your plan"
      subtitle="Less admin. More time for your work."
      back="/settings"
      wide
    >
      <Feedback
        loading={status.isLoading}
        error={status.error}
        onRetry={() => status.refetch()}
      />
      {(checkout.error || portal.error) && (
        <p role="alert">{(checkout.error || portal.error)?.message}</p>
      )}
      {status.data && (
        <>
          <Panel>
            <div className="v3-inline">
              <h2>{status.data.tierLabel}</h2>
              <Status tone="success">Current plan</Status>
            </div>
            {status.data.renewalDate && (
              <p>
                {status.data.cancelAtPeriodEnd ? "Access ends" : "Renews"}{" "}
                {new Date(status.data.renewalDate).toLocaleDateString("en-AU")}
              </p>
            )}
            {status.data.stripeSubscriptionId && (
              <Action
                tone="secondary"
                disabled={busy}
                onClick={() => portal.mutate()}
              >
                Manage Pro billing
              </Action>
            )}
            {status.data.tier === "top" && (
              <ActionLink href="/studio">Manage studio membership</ActionLink>
            )}
          </Panel>
          <div className="v3-plan-grid">
            {plans.map(plan => (
              <Panel
                key={plan.key}
                tone={plan.key === status.data.tier ? "attention" : "plain"}
              >
                <h2>{PAYMENT_TIERS[plan.key].label}</h2>
                <p>
                  <strong className="v3-price">
                    {money(PAYMENT_TIERS[plan.key].subscriptionPriceCents)}
                  </strong>{" "}
                  AUD / month
                </p>
                <ul className="v3-feature-list">
                  {plan.features.map(feature => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                {plan.key === "free" ? (
                  <p className="v3-muted">
                    {status.data.tier === "free"
                      ? "Your current plan"
                      : "Cancel renewal in billing to return to Free after your paid period."}
                  </p>
                ) : plan.key === "pro" ? (
                  <>
                    <Action
                      disabled={
                        busy || status.data.tier !== "free" || !offer.data
                      }
                      onClick={() => checkout.mutate({})}
                    >
                      {status.data.tier === "pro"
                        ? "Current plan"
                        : status.data.tier === "top"
                          ? "Included in Studio"
                          : checkout.isPending
                            ? "Opening checkout…"
                            : "Choose Pro"}
                    </Action>
                    <Feedback
                      loading={offer.isLoading}
                      error={offer.error}
                      onRetry={() => offer.refetch()}
                    />
                    {!offer.isLoading && !offer.error && !offer.data && (
                      <p role="status">Pro billing is currently unavailable.</p>
                    )}
                  </>
                ) : (
                  <ActionLink href="/studio">
                    {status.data.tier === "top"
                      ? "Open studio"
                      : "Set up Studio"}
                  </ActionLink>
                )}
              </Panel>
            ))}
          </div>
          <Section title="When Pro makes sense">
            <Panel>
              <p>
                At{" "}
                {money(
                  Math.round(
                    PAYMENT_TIERS.pro.subscriptionPriceCents /
                      PAYMENT_TIERS.free.artistFeeRate
                  )
                )}{" "}
                in monthly artist payments, Free’s artist fees equal Pro’s
                monthly price. Above that, Pro reduces your Tattoi artist fees.
              </p>
              <p className="v3-muted">
                Free’s artist fee is deducted when payment is collected, before
                bank payout. Upgrading applies to new payments and does not
                refund past fees.
              </p>
            </Panel>
          </Section>
          <Section title="Payment fees">
            <p>
              Clients pay a{" "}
              {(PAYMENT_TIERS.free.platformFeeRate * 100).toFixed(1)}% platform
              fee, with a {money(MIN_PLATFORM_FEE_CENTS)} minimum per payment,
              on every plan. Checkout shows the total before payment.
            </p>
            <p className="v3-muted">
              Monthly subscriptions renew until cancelled. Studio covers up to
              10 active artists, including its owner. Checkout confirms the
              final subscription amount.
            </p>
          </Section>
        </>
      )}
      {secret && (
        <SubscriptionCheckoutSheet
          clientSecret={secret}
          name="Pro"
          active={status.data?.tier === "pro"}
          onClose={() => setSecret(null)}
          onRefresh={() => void status.refetch()}
        />
      )}
    </Screen>
  );
}
