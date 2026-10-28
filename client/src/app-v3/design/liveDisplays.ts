/* The maths behind the iOS Modern live displays, kept apart so they can be tested without rendering. */
import {
  PAYMENT_TIERS,
  calculateTransactionFees,
  resolveDepositPercentage,
  type PaymentTier,
} from "@shared/fees";

const mins = (t?: string) => {
  const [h, m] = String(t || "").split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
};

export type ScheduleDay = {
  day: string;
  enabled: boolean;
  start: string;
  end: string;
  type?: string;
  breaks?: { start: string; end: string }[];
};

/** Each day as a bar down a 24-hour column: where the working window sits, its breaks, and its hours. */
export function weekWindows(days: ScheduleDay[]) {
  const pct = (m: number) => (m / 1440) * 100;
  const out = days.map(d => {
    const s = mins(d.start);
    const e = mins(d.end);
    const on = d.enabled && s !== null && e !== null && e > s;
    const breaks = on
      ? (d.breaks || []).flatMap(b => {
          const a = mins(b.start);
          const z = mins(b.end);
          return a !== null && z !== null && z > a
            ? [{ top: pct(a), height: pct(z - a), minutes: z - a }]
            : [];
        })
      : [];
    const minutes = on
      ? e! - s! - breaks.reduce((sum, b) => sum + b.minutes, 0)
      : 0;
    return {
      day: d.day,
      on,
      type: d.type || "work",
      top: on ? pct(s!) : 0,
      height: on ? pct(e! - s!) : 0,
      breaks,
      hours: minutes / 60,
    };
  });
  const tattooHours = out
    .filter(d => d.type === "work")
    .reduce((sum, d) => sum + d.hours, 0);
  return { days: out, tattooHours };
}

/** What a client pays for one sitting and what the artist keeps, on the artist's plan. */
export function sittingSplit(
  priceCents: number,
  tier: PaymentTier,
  depositPercent?: number | null
) {
  const percent = resolveDepositPercentage(tier, depositPercent);
  const deposit = Math.round((priceCents * percent) / 100);
  const balance = priceCents - deposit;
  const a = calculateTransactionFees(deposit, tier);
  const b = calculateTransactionFees(balance, tier);
  return {
    percent,
    deposit,
    depositClient: a.clientTotalCents,
    depositFee: a.platformFeeCents,
    balance,
    balanceClient: b.clientTotalCents,
    balanceFee: b.platformFeeCents,
    keep: a.artistPayoutCents + b.artistPayoutCents,
    artistFee: a.artistFeeCents + b.artistFeeCents,
  };
}

/** For a month of takings, what each plan leaves the artist after its fee or subscription. */
export function planKeep(monthCents: number) {
  const plans = (["free", "pro", "top"] as PaymentTier[]).map(key => {
    const t = PAYMENT_TIERS[key];
    return {
      key,
      label: key === "top" ? "Studio" : t.label,
      keep: Math.round(monthCents * (1 - t.artistFeeRate)) - t.subscriptionPriceCents,
    };
  });
  const best = plans.reduce((a, b) => (b.keep > a.keep ? b : a));
  // Pro pays for itself once the free plan's fee is larger than its subscription.
  const proBreakEven = Math.ceil(
    PAYMENT_TIERS.pro.subscriptionPriceCents / PAYMENT_TIERS.free.artistFeeRate
  );
  return { plans, best: best.key, proBreakEven };
}

/** Elapsed share of a sitting, 0 before it starts and 1 once it ends. */
export function sittingProgress(start: string | Date, end: string | Date, now: number) {
  const a = new Date(start).getTime();
  const z = new Date(end).getTime();
  if (!(z > a)) return 0;
  return Math.max(0, Math.min(1, (now - a) / (z - a)));
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
/** The next payout dates for a Stripe payout schedule. Manual payouts have no dates. */
export function payoutDates(
  interval: "daily" | "weekly" | "monthly" | "manual",
  weeklyAnchor: string | null | undefined,
  monthlyAnchor: number | null | undefined,
  from: number,
  count = 4
) {
  const out: Date[] = [];
  if (interval === "manual") return out;
  const d = new Date(from);
  d.setHours(12, 0, 0, 0);
  for (let i = 0; out.length < count && i < 400; i++) {
    d.setDate(d.getDate() + 1);
    const hit =
      interval === "daily"
        ? d.getDay() !== 0 && d.getDay() !== 6
        : interval === "weekly"
          ? WEEKDAYS[d.getDay()] === (weeklyAnchor || "monday")
          : d.getDate() ===
            Math.min(
              monthlyAnchor || 1,
              new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
            );
    if (hit) out.push(new Date(d));
  }
  return out;
}
