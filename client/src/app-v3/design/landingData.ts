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
export function lowStock<T extends Product>(products: T[], threshold: number) {
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

// ── Artist landing ─────────────────────────────────────────

/** Calendar rows from connected calendars (Google and others) are blocked time, not sittings. */
export function isExternalEvent(a: {
  id: unknown;
  isExternal?: unknown;
  source?: unknown;
}) {
  return (
    typeof a.id !== "number" ||
    a.id < 0 ||
    !!a.isExternal ||
    a.source === "google" ||
    a.source === "external"
  );
}

type SittingRow = {
  startTime: string | Date;
  endTime?: string | Date | null;
  totalExpectedAmountCents?: number | null;
  totalPaidAmountCents?: number | null;
  remainingBalanceCents?: number | null;
  price?: number | null;
  amountPaid?: number | null;
  depositPaid?: number | boolean | null;
  depositAmount?: number | null;
  paymentStatus?: string | null;
};

/** A sitting's estimate, paid and remaining amounts in cents, read the same way the server reads them:
 *  explicit cents win over the older dollar columns, and a missing balance is derived, never assumed. */
export function sittingMoney(row: SittingRow) {
  const estimateCents =
    row.totalExpectedAmountCents ?? Math.round((row.price ?? 0) * 100);
  const paidCents =
    row.totalPaidAmountCents ??
    Math.round(
      (row.amountPaid ?? (row.depositPaid ? row.depositAmount : 0) ?? 0) * 100
    );
  const remainingCents =
    row.remainingBalanceCents ??
    (row.paymentStatus === "fully_paid"
      ? 0
      : Math.max(0, estimateCents - paidCents));
  return { estimateCents, paidCents, remainingCents };
}

/** Money still to come from sittings booked over the next `days` days. */
export function bookedAhead(sittings: SittingRow[], now: number, days = 56) {
  const until = now + days * DAY;
  return sittings
    .filter(s => {
      const t = new Date(s.startTime).getTime();
      return t > now && t < until;
    })
    .reduce((sum, s) => sum + sittingMoney(s).remainingCents, 0);
}

/** Weeks for the money river, Monday to Sunday: what was earned in each past week (from the daily
 *  earnings), and what is still to come from sittings booked in each week from now on. */
export function moneyWeeks(
  daily: { date: string; netCents: number }[],
  sittings: SittingRow[],
  now: number,
  past = 10,
  ahead = 8
) {
  const today = new Date(midnight(now));
  const monday = today.getTime() - ((today.getDay() + 6) % 7) * DAY;
  const key = (t: number) => new Date(t).toLocaleDateString("en-CA");
  const weeks = [];
  for (let w = -(past - 1); w <= ahead; w++) {
    const start = new Date(monday);
    start.setDate(start.getDate() + w * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const from = key(start.getTime());
    const to = key(end.getTime());
    weeks.push({
      w,
      start: start.getTime(),
      earned:
        w <= 0
          ? daily
              .filter(d => d.date >= from && d.date < to)
              .reduce((sum, d) => sum + d.netCents, 0)
          : 0,
      booked: sittings
        .filter(s => {
          const t = new Date(s.startTime).getTime();
          return t > now && t >= start.getTime() && t < end.getTime();
        })
        .reduce((sum, s) => sum + sittingMoney(s).remainingCents, 0),
    });
  }
  return weeks;
}

/** Each client's next sitting from now, soonest first. */
export function nextSittingByClient<
  T extends { clientId?: string | null; startTime: string | Date },
>(sittings: T[], now: number) {
  const next = new Map<string, T>();
  for (const s of sittings) {
    if (!s.clientId || new Date(s.startTime).getTime() <= now) continue;
    const seen = next.get(s.clientId);
    if (!seen || new Date(s.startTime) < new Date(seen.startTime))
      next.set(s.clientId, s);
  }
  return [...next.values()].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );
}

type BookedSitting = {
  id: number;
  sessionPlanId?: number | null;
  conversationId: number | null;
  projectName?: string | null;
  serviceName?: string | null;
  title?: string | null;
  imageUrl?: string | null;
  status: string;
  startsAt: string;
  sessionTotal?: number | null;
  artist: { name: string };
};

/** A client's tattoos as projects: the sittings of one proposal together (a sitting without a proposal
 *  stands alone), with the first reference image, the artist, and how many sittings are done. Projects
 *  with a sitting still to come are first, then the most recent. */
export function clientProjects<T extends BookedSitting>(sittings: T[]) {
  const groups = new Map<string, T[]>();
  const seen = new Set<number>();
  for (const s of sittings) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    const key = s.sessionPlanId ? `plan:${s.sessionPlanId}` : `sitting:${s.id}`;
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  const closed = ["cancelled", "no-show"];
  return [...groups.entries()]
    .map(([key, list]) => {
      const sorted = [...list].sort(
        (a, b) => +new Date(a.startsAt) - +new Date(b.startsAt)
      );
      const kept = sorted.filter(s => !closed.includes(s.status));
      const done = kept.filter(s => s.status === "completed").length;
      const total = Math.max(
        1,
        kept.length,
        ...kept.map(s => s.sessionTotal || 0)
      );
      const next = kept.find(s => s.status !== "completed");
      const shown = next ?? sorted[sorted.length - 1];
      return {
        key,
        name:
          sorted.find(s => s.projectName)?.projectName ||
          sorted[0].serviceName ||
          sorted[0].title ||
          "Your tattoo",
        artist: sorted[0].artist.name,
        image: sorted.find(s => s.imageUrl)?.imageUrl ?? null,
        done,
        total,
        next: next ?? null,
        last: +new Date(sorted[sorted.length - 1].startsAt),
        href: shown.conversationId
          ? `/projects/${shown.conversationId}?session=${shown.id}`
          : "/bookings",
      };
    })
    .sort((a, b) =>
      !!a.next !== !!b.next
        ? a.next
          ? -1
          : 1
        : a.next && b.next
          ? +new Date(a.next.startsAt) - +new Date(b.next.startsAt)
          : b.last - a.last
    );
}

type FeedCard = {
  id: number;
  artistId: string;
  artistName: string;
  artistAvatar?: string | null;
  artistCity?: string | null;
  artistSlug?: string | null;
  keywords?: string[];
  tags?: string[];
  imageUrl?: string | null;
  mediaType?: string | null;
};

/** One card for each artist in the discover feed: their newest picture, name, city and styles. */
export function discoverArtists<T extends FeedCard>(cards: T[]) {
  const artists = new Map<string, T[]>();
  for (const c of cards)
    if (c.artistSlug)
      artists.set(c.artistId, [...(artists.get(c.artistId) ?? []), c]);
  return [...artists.values()].map(list => {
    const newest = [...list].sort((a, b) => b.id - a.id);
    const first = newest[0];
    const styles = first.keywords?.length
      ? first.keywords
      : [...new Set(newest.flatMap(c => c.tags ?? []))];
    return {
      id: first.artistId,
      name: first.artistName,
      avatar: first.artistAvatar ?? null,
      city: first.artistCity ?? null,
      slug: first.artistSlug as string,
      styles: styles.slice(0, 3),
      image:
        newest.find(c => c.imageUrl && c.mediaType !== "video")?.imageUrl ??
        null,
    };
  });
}

// ── Ring scales ──────────────────────────────────────────
// Each landing ring fills against a measure from the same data, never a fixed amount.

/** How much of a whole a part is, from 0 to 1. Nothing to measure against gives an empty ring. */
export function share(part: number, whole: number) {
  return whole > 0 ? Math.max(0, Math.min(1, part / whole)) : 0;
}

/** Net earnings in the last `days` days, from the daily earnings. */
export function earnedSince(
  daily: { date: string; netCents: number }[],
  now: number,
  days = 56
) {
  const from = new Date(midnight(now) - days * DAY).toLocaleDateString("en-CA");
  const today = new Date(now).toLocaleDateString("en-CA");
  return daily
    .filter(d => d.date >= from && d.date <= today)
    .reduce((sum, d) => sum + (d.netCents || 0), 0);
}

/** Takings from paid and fulfilled orders placed between two times. */
export function soldBetween(orders: Order[], from: number, to: number) {
  return orders
    .filter(o => {
      const t = o.createdAt ? new Date(o.createdAt).getTime() : NaN;
      return (o.status === "paid" || o.status === "fulfilled") && t > from && t <= to;
    })
    .reduce((sum, o) => sum + (o.totalAmountCents || 0), 0);
}

/** Paid and fulfilled orders placed in the last `days` days. */
export function ordersSince(orders: Order[], now: number, days = 30) {
  return orders.filter(o => {
    const t = o.createdAt ? new Date(o.createdAt).getTime() : NaN;
    return (o.status === "paid" || o.status === "fulfilled") && t > now - days * DAY;
  }).length;
}

/** Requests still in progress: everything until the deposit is verified, or the request is lost or archived. */
export function openRequests<T extends { status: string }>(leads: T[]) {
  const closed = ["deposit_verified", "scheduled", "completed", "lost", "archived"];
  return leads.filter(l => !closed.includes(l.status));
}
