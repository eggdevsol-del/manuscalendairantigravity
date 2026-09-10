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
  return (
    <Screen title="Business" subtitle="More time for the work you love">
      <div className="v3-grid">
        <Section title="Your studio day">
          <Row
            title="Money"
            detail="Income, balances and payouts"
            icon={<Wallet />}
            href="/money"
          />
          <Row
            title="Working hours & services"
            detail="Availability, session lengths and pricing"
            icon={<CalendarDays />}
            href="/work-hours"
          />
          <Row
            title="Your profile & booking link"
            detail="The front door for your clients"
            icon={<UserRound />}
            href="/artist-profile"
          />
          <Row
            title="Cancellation waitlist"
            detail="Fill available appointments"
            icon={<ListChecks />}
            href="/waitlist"
          />
        </Section>
        <Section title="Behind the scenes">
          <Row
            title="Supplies"
            detail="Stock and supplier orders"
            icon={<Package />}
            href="/supplies"
          />
          <Row
            title="Studio"
            detail="People and shared workspace"
            icon={<Users />}
            href="/studio"
          />
          <Row
            title="Settings"
            detail="Your account, business and preferences"
            icon={<Settings />}
            href="/settings"
          />
        </Section>
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
      back="/business"
    >
      <Tabs
        items={["7 days", "30 days", "90 days", "All time"] as const}
        value={period}
        onChange={setPeriod}
        label="Earnings period"
      />
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
                  ? money(b.availableAmountCents)
                  : "Connect payouts"}
              </h2>
              <p>Available balance</p>
              <dl className="v3-facts">
                <div>
                  <dt>Pending</dt>
                  <dd>{money(b.pendingAmountCents)}</dd>
                </div>
                {b.nextPayoutAmountCents !== null && (
                  <div>
                    <dt>Next payout</dt>
                    <dd>{money(b.nextPayoutAmountCents)}</dd>
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
          <details key={entry.id} className="v3-divider">
            <summary className="v3-row">
              <span className="v3-row-copy">
                <strong>
                  {statusLabel(entry.type)}
                  {entry.clientName ? ` · ${entry.clientName}` : ""}
                </strong>
                <span>{entry.createdAt && bookingDate(entry.createdAt)}</span>
              </span>
              <strong>
                {entry.type === "refund" ? "−" : ""}
                {money(entry.amountCents)}
              </strong>
            </summary>
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
          </details>
        ))}
        <ActionLink href="/payout-history" tone="quiet">
          View payout history <ArrowRight />
        </ActionLink>
      </Section>
    </Screen>
  );
}
