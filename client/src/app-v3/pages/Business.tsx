import { EarningsChart } from "../components/EarningsChart";
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
import { useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { LiveStage, StageNumber, TouchSlider } from "../design/live";
import { MoneyRiver } from "../design/MoneyRiver";
import { initials, startOfDay, useNow } from "../design/LockParts";
import { addDays } from "../design/calendarDays";
import { isExternalEvent, moneyWeeks, sittingMoney } from "../design/landingData";
import { trpc } from "@/lib/trpc";
import {
  bookingDate,
  money,
  statusLabel,
} from "@/features/workspace/bookingPresentation";
import {
  Action,
  ActionLink,
  Feedback,
  Panel,
  Row,
  Screen,
  Section,
  Tabs,
} from "../design/primitives";
export default function Business() {
  const earnings = trpc.payouts.earningsBreakdown.useQuery({
    period: "30d",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  return (
    <Screen title="Business" subtitle="Your studio, at a glance">
      <Feedback
        loading={earnings.isLoading}
        error={earnings.error}
        onRetry={() => earnings.refetch()}
      />
      {earnings.data && (
        <Panel tone="next">
          <span className="simple-eyebrow" data-tour-title="Last 30 days">Last 30 days</span>
          <h2>{money(earnings.data.netCents)}</h2>
          <p>Net earnings</p>
          <EarningsChart
            daily={earnings.data.daily || []}
            timeZone={earnings.data.timeZone || "UTC"}
          />
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
/** Money, as in the prototype: a river of what you earned week by week and what is still to come from
 *  bookings, with a slider that moves through time; three key figures; the earnings breakdown; and a
 *  ledger where each payment opens its details. Every figure comes from the payouts and calendar data. */
export function Money() {
  const { user } = useAuth();
  const now = useNow();
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [period, setPeriod] = useState<"7d" | "30d" | "90d" | "all">("30d");
  const [week, setWeek] = useState(0);
  const [allRows, setAllRows] = useState(false);
  const today0 = startOfDay(now);
  const range = useMemo(
    () => ({ start: new Date(today0), end: new Date(addDays(today0, 366)) }),
    [today0]
  );
  // The daily series for the river: the "all" period has no daily figures, so use the last 90 days.
  const daily = trpc.payouts.earningsBreakdown.useQuery({ period: "90d", timeZone: zone });
  const month = trpc.payouts.earningsBreakdown.useQuery({ period: "30d", timeZone: zone });
  const earnings = trpc.payouts.earningsBreakdown.useQuery({ period, timeZone: zone });
  const balance = trpc.payouts.nextPayout.useQuery();
  const history = trpc.payouts.payoutHistory.useQuery({ limit: 20 });
  const calendar = trpc.appointments.getArtistCalendar.useQuery(
    { artistId: user?.id ?? "", startDate: range.start, endDate: range.end },
    { enabled: !!user?.id }
  );
  const b = balance.data && !("error" in balance.data) ? balance.data : null;
  const currency = b?.currency?.toUpperCase() || "AUD";
  const sittings = ((calendar.data ?? []) as any[]).filter(a => !isExternalEvent(a));
  const weeks = moneyWeeks(daily.data?.daily ?? [], sittings, now);
  const shown = weeks.find(w => w.w === week) ?? weeks[weeks.length - 1];
  const value = shown ? (shown.w <= 0 ? shown.earned : shown.booked) : 0;
  const held = sittings
    .filter(a => new Date(a.startTime).getTime() > now)
    .reduce((sum, a) => sum + sittingMoney(a).paidCents, 0);
  const e = earnings.data;
  const entries = (history.data?.entries ?? []) as any[];
  const weekName = (w: number) =>
    w === 0 ? "This week" : w < 0 ? `${-w} week${w === -1 ? "" : "s"} ago` : `${w} week${w === 1 ? "" : "s"} ahead`;
  const date = (t: string | number | Date) =>
    new Date(t).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  return (
    <Screen
      title="Money"
      subtitle={
        b?.nextPayoutAmountCents != null && b.nextPayoutArrivalDate
          ? `${money(b.nextPayoutAmountCents, currency)} lands ${date(b.nextPayoutArrivalDate)}`
          : "Know what’s paid and what’s on its way"
      }
    >
      <Feedback
        loading={daily.isLoading || calendar.isLoading}
        error={daily.error || calendar.error}
        onRetry={() => {
          void daily.refetch();
          void calendar.refetch();
        }}
      />
      {shown && (
        <LiveStage className="iosm-money-stage" label={`${weekName(shown.w)}: ${money(value, currency)}`}>
          <StageNumber
            over={`${weekName(shown.w)} · week of ${date(shown.start)}`}
            value={money(value, currency).replace(/\.00$/, "")}
            under={
              shown.w < 0
                ? "earned"
                : shown.w === 0
                  ? "earned so far"
                  : "still to come from bookings"
            }
          />
          <MoneyRiver weeks={weeks} height={150} scrub={week} />
        </LiveStage>
      )}
      <TouchSlider
        label="Drag through time"
        tone="money"
        value={week}
        min={weeks[0]?.w ?? -9}
        max={weeks[weeks.length - 1]?.w ?? 8}
        format={weekName}
        onChange={setWeek}
      />
      <div className="iosm-facts">
        <div>
          <b>
            {b && typeof b.availableAmountCents === "number"
              ? money(b.availableAmountCents, currency).replace(/\.00$/, "")
              : "–"}
          </b>
          <span>{b ? "ready to pay out" : "connect payouts"}</span>
        </div>
        <div>
          <b>{month.data ? money(month.data.netCents, currency).replace(/\.00$/, "") : "–"}</b>
          <span>earned, 30 days</span>
        </div>
        <div>
          <b>{calendar.data ? money(held, currency).replace(/\.00$/, "") : "–"}</b>
          <span>paid on upcoming sittings</span>
        </div>
      </div>
      <Section title="Earnings breakdown">
        <div className="iosm-chips" role="group" aria-label="Earnings period">
          {(
            [
              ["7d", "7 days"],
              ["30d", "30 days"],
              ["90d", "90 days"],
              ["all", "All time"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={period === key}
              onClick={() => setPeriod(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <Feedback
          loading={earnings.isLoading}
          error={earnings.error}
          onRetry={() => earnings.refetch()}
        />
        {e && (
          <dl className="v3-facts">
            <div>
              <dt>Clients paid you</dt>
              <dd>{money(e.grossCents, currency)}</dd>
            </div>
            <div>
              <dt>Your platform fee</dt>
              <dd>−{money(e.artistFeeCents, currency)}</dd>
            </div>
            <div>
              <dt>Refunds</dt>
              <dd>−{money(e.refundsCents, currency)}</dd>
            </div>
            <div>
              <dt>You earned</dt>
              <dd>{money(e.netCents, currency)}</dd>
            </div>
            <div>
              <dt>Processing paid by clients</dt>
              <dd>{money(e.platformFeeCents, currency)}</dd>
            </div>
          </dl>
        )}
      </Section>
      <Section title="Payments">
        <Feedback
          loading={history.isLoading}
          error={history.error}
          onRetry={() => history.refetch()}
        />
        {(allRows ? entries : entries.slice(0, 6)).map(entry => (
          <DetailsSheet
            sheetTitle="Transaction details"
            key={entry.id}
            className="iosm-ledger-row"
            title={
              <>
                <span className="iosm-ledger-face" aria-hidden="true">
                  {initials(entry.clientName || statusLabel(entry.type))}
                </span>
                <span className="v3-row-copy">
                  <strong>{entry.clientName || statusLabel(entry.type)}</strong>
                  <span>
                    {statusLabel(entry.type)}
                    {entry.createdAt ? `, ${bookingDate(entry.createdAt)}` : ""}
                  </span>
                </span>
                <strong className={entry.type === "refund" ? "iosm-ledger-out" : ""}>
                  {entry.type === "refund" ? "−" : "+"}
                  {money(Math.abs(entry.netCents ?? entry.amountCents), currency)}
                </strong>
              </>
            }
          >
            <dl className="v3-facts">
              {entry.type === "refund" ? (
                <div>
                  <dt>Refunded</dt>
                  <dd>{money(Math.abs(entry.amountCents), currency)}</dd>
                </div>
              ) : (
                <>
                  <div>
                    <dt>Client paid</dt>
                    <dd>{money(entry.amountCents + (entry.platformFeeCents || 0), currency)}</dd>
                  </div>
                  <div>
                    <dt>Card fee, paid by the client</dt>
                    <dd>{money(entry.platformFeeCents || 0, currency)}</dd>
                  </div>
                  <div>
                    <dt>Your fee</dt>
                    <dd>{money(entry.artistFeeCents || 0, currency)}</dd>
                  </div>
                  <div>
                    <dt>Reached you</dt>
                    <dd>{money(entry.netCents ?? entry.amountCents, currency)}</dd>
                  </div>
                </>
              )}
              <div>
                <dt>Method</dt>
                <dd>{entry.paymentMethod || "Card"}</dd>
              </div>
              <div>
                <dt>Payout</dt>
                <dd>{statusLabel(entry.payoutStatus || "pending")}</dd>
              </div>
            </dl>
          </DetailsSheet>
        ))}
        {!history.isLoading && !entries.length && (
          <Feedback empty="Payments from clients appear here." />
        )}
        {entries.length > 6 && (
          <Action tone="quiet" onClick={() => setAllRows(v => !v)}>
            {allRows ? "Show less" : `Show all ${entries.length}`}
          </Action>
        )}
      </Section>
      <div className="iosm-row2">
        <ActionLink href="/bank-payouts" tone="secondary">
          Payouts
        </ActionLink>
        <ActionLink href="/subscriptions" tone="secondary">
          Your plan
        </ActionLink>
      </div>
      <ActionLink href="/payout-history" tone="quiet">
        View payout history <ArrowRight />
      </ActionLink>
    </Screen>
  );
}
