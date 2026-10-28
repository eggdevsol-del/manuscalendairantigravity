/* Pure helpers for the client and supplier landing pages, kept apart so they can be tested without the API. */

const DAY = 86400000;
const midnight = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Whole calendar days from today until a date: 0 today, 1 tomorrow. */
export function daysUntil(date: string | Date, now: number) {
  return Math.max(0, Math.round((midnight(new Date(date).getTime()) - midnight(now)) / DAY));
}

/** The most recent finished sitting that may still be healing (within `window` days), and which day of
 *  healing it is. The artist's aftercare guide decides the real length once it loads. */
export function healingDay<
  T extends { status: string; endsAt: string; completedAt?: string | Date | null },
>(past: T[], now: number, window = 30) {
  const done = past
    .filter(a => a.status === "completed")
    .map(a => ({ sitting: a, at: new Date(a.completedAt || a.endsAt).getTime() }))
    .filter(x => Number.isFinite(x.at) && x.at <= now)
    .sort((a, b) => b.at - a.at)[0];
  if (!done) return null;
  const day = Math.floor((midnight(now) - midnight(done.at)) / DAY) + 1;
  return day <= window ? { sitting: done.sitting, day } : null;
}

type Order = {
  id: number;
  status: string;
  totalAmountCents: number;
  createdAt?: string | Date | null;
};

/** Orders along the belt: paid ones to pack, fulfilled ones on their way. Cancelled ones drop off. */
export function orderBelt<T extends Order>(orders: T[]) {
  return {
    toPack: orders.filter(o => o.status === "paid"),
    shipped: orders.filter(o => o.status === "fulfilled"),
  };
}

/** Takings from paid and fulfilled orders in the last `days` days. */
export function soldSince(orders: Order[], now: number, days = 30) {
  return orders
    .filter(
      o =>
        (o.status === "paid" || o.status === "fulfilled") &&
        o.createdAt &&
        new Date(o.createdAt).getTime() > now - days * DAY
    )
    .reduce((sum, o) => sum + (o.totalAmountCents || 0), 0);
}

type Product = {
  id: number;
  title: string;
  inventoryCount?: number | null;
  variants?: { name: string; inventoryCount?: number | null }[];
};

/** Products at or below the threshold. A product with variants is low when any variant is. */
export function lowStock<T extends Product>(products: T[], threshold = 5) {
  return products.flatMap(p => {
    const variants = p.variants ?? [];
    const low = variants.length
      ? variants.filter(v => (v.inventoryCount ?? 0) <= threshold)
      : (p.inventoryCount ?? 0) <= threshold
        ? [{ name: "", inventoryCount: p.inventoryCount ?? 0 }]
        : [];
    return low.length ? [{ product: p, low }] : [];
  });
}

/** The aftercare stage covering a day of healing, or the last one once past every stage. */
export function aftercareStage<T extends { fromDay: number; toDay: number }>(
  phases: T[],
  day: number
) {
  return (
    phases.find(p => day >= p.fromDay && day <= p.toDay) ??
    (phases.length && day > phases[phases.length - 1].toDay
      ? phases[phases.length - 1]
      : null)
  );
}
