import { DetailsSheet } from "../components/DetailsSheet";
import {
  Wallet,
  CalendarDays,
  UserRound,
  Package,
  Settings,
  Users,
  ListChecks,
  ArrowRight,
} from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  bookingDate,
  money,
  statusLabel,
} from "@/features/workspace/bookingPresentation";
import {
  ActionLink,
  Feedback,
  Panel,
  Row,
  Screen,
  Section,
  Tabs,
} from "../design/primitives";
export default function Business() {
  const earnings = trpc.payouts.earningsBreakdown.useQuery({ period: "30d" });
  return (
    <Screen title="Business" subtitle="Your studio, at a glance">
      <Feedback
        loading={earnings.isLoading}
        error={earnings.error}
        onRetry={() => earnings.refetch()}
      />
      {earnings.data && (
        <Panel tone="next">
          <span className="simple-eyebrow">Last 30 days</span>
          <h2>{money(earnings.data.netCents)}</h2>
          <p>Net earnings</p>
          <Row title="Income & payouts" href="/money" />
        </Panel>
      )}
      <div className="simple-business-list">
        <Row
          title="Income & payouts"
          detail="Payments, transactions and your balance"
          icon={<Wallet />}
          href="/money"
        />
        <Row
          title="Services & availability"
          detail="Pricing, working hours and time off"
          icon={<CalendarDays />}
          href="/work-hours"
        />
        <Row
          title="Profile & portfolio"
          detail="Your work and public booking page"
          icon={<UserRound />}
          href="/artist-profile"
        />
        <Row
          title="Shopfront"
          detail="Products, orders and events"
          icon={<Package />}
          href="/shopfront"
        />
        <Row
          title="Supplies"
          detail="Stock and supplier orders"
          icon={<Package />}
          href="/supplies"
        />
        <Row
          title="Studio"
          detail="Your people and shared workspace"
          icon={<Users />}
          href="/studio"
        />
        <Row
          title="Account & settings"
          detail="Notifications, subscriptions and preferences"
          icon={<Settings />}
          href="/settings"
        />
      </div>
      <DetailsSheet title="Daily tools">
        <Row
          title="Needs attention"
          detail="Your tasks and today's appointments"
          href="/dashboard"
        />
        <Row title="Cancellation waitlist" href="/waitlist" />
      </DetailsSheet>
    </Screen>
  );
}
export function Shopfront() {
  return (
    <Screen
      title="Shopfront"
      back="/business"
      subtitle="Your products and experiences"
    >
      <div className="simple-business-list">
        <Row
          title="Products"
          detail="Catalogue, prices and availability"
          icon={<Package />}
          href="/products"
        />
        <Row
          title="Orders"
          detail="Payments and fulfilment"
          icon={<ListChecks />}
          href="/store-orders"
        />
        <Row
          title="Events"
          detail="Workshops and registrations"
          icon={<CalendarDays />}
          href="/artist-events"
        />
        <Row
          title="Public profile"
          detail="Manage your public presence and booking link"
          icon={<UserRound />}
          href="/artist-profile"
        />
      </div>
    </Screen>
  );
}
export function Money() {
  const [period, setPeriod] = useState<
    "7 days" | "30 days" | "90 days" | "All time"
  >("30 days");
  const periods = {
    "7 days": "7d",
    "30 days": "30d",
    "90 days": "90d",
    "All time": "all",
  } as const;
  const earnings = trpc.payouts.earningsBreakdown.useQuery({
    period: periods[period],
  });
  const balance = trpc.payouts.nextPayout.useQuery();
  const history = trpc.payouts.payoutHistory.useQuery({ limit: 20 });
  const e = earnings.data,
    b = balance.data;
  return (
    <Screen
      title="Money"
      subtitle="Know what’s paid and what’s on its way"
      subheader={
        <Tabs
          items={["7 days", "30 days", "90 days", "All time"] as const}
          value={period}
          onChange={setPeriod}
          label="Earnings period"
        />
      }
      back="/business"
    >
      <div className="v3-grid">
        <Section title="Your balance">
          <Feedback
            loading={balance.isLoading}
            error={balance.error || (b && "error" in b ? b.error : null)}
            onRetry={() => balance.refetch()}
          />
          {b && !("error" in b) && (
            <Panel>
              <h2>
                {"availableAmountCents" in b &&
                typeof b.availableAmountCents === "number"
                  ? money(b.availableAmountCents, b.currency)
                  : "Connect payouts"}
              </h2>
              <p>Available balance</p>
              <dl className="v3-facts">
                <div>
                  <dt>Pending</dt>
                  <dd>{money(b.pendingAmountCents, b.currency)}</dd>
                </div>
                {b.nextPayoutAmountCents !== null && (
                  <div>
                    <dt>Next payout</dt>
                    <dd>{money(b.nextPayoutAmountCents, b.currency)}</dd>
                  </div>
                )}
                {b.nextPayoutArrivalDate && (
                  <div>
                    <dt>Expected</dt>
                    <dd>{bookingDate(b.nextPayoutArrivalDate)}</dd>
                  </div>
                )}
              </dl>
              <ActionLink href="/bank-payouts" tone="quiet">
                Manage payouts <ArrowRight />
              </ActionLink>
            </Panel>
          )}
        </Section>
        <Section title="Earnings">
          <Feedback
            loading={earnings.isLoading}
            error={earnings.error}
            onRetry={() => earnings.refetch()}
          />
          {e && (
            <dl className="v3-facts">
              <div>
                <dt>Clients paid you</dt>
                <dd>{money(e.grossCents)}</dd>
              </div>
              <div>
                <dt>Your platform fee</dt>
                <dd>−{money(e.artistFeeCents)}</dd>
              </div>
              <div>
                <dt>Refunds</dt>
                <dd>−{money(e.refundsCents)}</dd>
              </div>
              <div>
                <dt>You earned</dt>
                <dd>{money(e.netCents)}</dd>
              </div>
              <div>
                <dt>Processing paid by clients</dt>
                <dd>{money(e.platformFeeCents)}</dd>
              </div>
            </dl>
          )}
        </Section>
      </div>
      <Section title="Recent transactions">
        <Feedback
          loading={history.isLoading}
          error={history.error}
          onRetry={() => history.refetch()}
        />
        {history.data?.entries.map((entry: any) => (
          <DetailsSheet
            sheetTitle="Transaction details"
            key={entry.id}
            className="v3-divider"
            title={
              <>
                <span className="v3-row-copy">
                  <strong>
                    {statusLabel(entry.type)}
                    {entry.clientName ? ` · ${entry.clientName}` : ""}
                  </strong>
                  <span>{entry.createdAt && bookingDate(entry.createdAt)}</span>
                </span>
                <strong>{money(entry.amountCents)}</strong>
              </>
            }
          >
            <dl className="v3-facts">
              <div>
                <dt>Method</dt>
                <dd>{entry.paymentMethod || "Card"}</dd>
              </div>
              <div>
                <dt>Your fee</dt>
                <dd>{money(entry.artistFeeCents || 0)}</dd>
              </div>
              <div>
                <dt>Net</dt>
                <dd>{money(entry.netCents)}</dd>
              </div>
            </dl>
          </DetailsSheet>
        ))}
        <ActionLink href="/payout-history" tone="quiet">
          View payout history <ArrowRight />
        </ActionLink>
      </Section>
    </Screen>
  );
}
