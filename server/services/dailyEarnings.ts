import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
type LedgerRow = {
  createdAt: string | null;
  transactionType: string;
  amountCents: number;
  artistFeeCents: number;
  platformFeeCents?: number;
};
export function ledgerContribution(row: LedgerRow) {
  const sale = ["deposit", "balance", "store_order"].includes(
      row.transactionType
    ),
    refund = row.transactionType === "refund";
  return {
    grossCents: sale ? Number(row.amountCents) : 0,
    totalPlatformFeeCents: sale ? Number(row.platformFeeCents || 0) : 0,
    totalArtistFeeCents: sale || refund ? Number(row.artistFeeCents) : 0,
    refundsCents: refund ? Math.abs(Number(row.amountCents)) : 0,
    disputesCents:
      row.transactionType === "dispute" ? Math.abs(Number(row.amountCents)) : 0,
    transactionCount: sale ? 1 : 0,
  };
}
export function sumLedgerEarnings(rows: LedgerRow[]) {
  const total = {
    grossCents: 0,
    totalPlatformFeeCents: 0,
    totalArtistFeeCents: 0,
    refundsCents: 0,
    disputesCents: 0,
    transactionCount: 0,
  };
  for (const row of rows) {
    const contribution = ledgerContribution(row);
    for (const key of Object.keys(total) as (keyof typeof total)[])
      total[key] += contribution[key];
  }
  return total;
}
export function dailyEarnings(
  rows: LedgerRow[],
  start: Date,
  end: Date,
  zone: string
) {
  const sums = new Map<string, number>();
  for (const row of rows) {
    if (!row.createdAt) continue;
    const instant = new Date(
      row.createdAt.includes("T")
        ? row.createdAt
        : row.createdAt.replace(" ", "T") + "Z"
    );
    const key = formatInTimeZone(instant, zone, "yyyy-MM-dd");
    const value = ledgerContribution(row);
    const net =
      value.grossCents - value.totalArtistFeeCents - value.refundsCents;
    sums.set(key, (sums.get(key) || 0) + net);
  }
  const first = formatInTimeZone(start, zone, "yyyy-MM-dd"),
    last = formatInTimeZone(end, zone, "yyyy-MM-dd");
  const points = [];
  for (
    let day = new Date(first + "T12:00:00Z");
    day.toISOString().slice(0, 10) <= last;
    day.setUTCDate(day.getUTCDate() + 1)
  ) {
    const date = day.toISOString().slice(0, 10);
    points.push({ date, netCents: sums.get(date) || 0 });
  }
  return points;
}

/** Include today and the previous days-1 calendar dates in the artist's timezone. */
export function earningsPeriodStart(now: Date, days: number, zone: string) {
  const date = new Date(
    formatInTimeZone(now, zone, "yyyy-MM-dd") + "T12:00:00Z"
  );
  date.setUTCDate(date.getUTCDate() - days + 1);
  return fromZonedTime(date.toISOString().slice(0, 10) + "T00:00:00", zone);
}
