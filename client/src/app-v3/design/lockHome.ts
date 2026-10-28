/* Pure helpers for the iOS Modern landing page, kept apart so they can be tested without the API. */

export type DaySitting = {
  id: number | string;
  startTime: string | Date;
  endTime?: string | Date | null;
  status: string;
};

const ms = (v: string | Date) => new Date(v).getTime();
const DEFAULT_MINUTES = 120;

export function sittingEnd(s: DaySitting) {
  return s.endTime ? ms(s.endTime) : ms(s.startTime) + DEFAULT_MINUTES * 60000;
}

/** Lays a day's sittings along a timeline, as percentages of the working window, so each block is as
 *  wide as the sitting is long. The window grows to fit sittings that start early or run late. */
export function dayTimeline(
  sittings: DaySitting[],
  now: number,
  dayStart: number,
  open = 9,
  close = 18
) {
  let from = dayStart + open * 3600000;
  let to = dayStart + close * 3600000;
  for (const s of sittings) {
    from = Math.min(from, ms(s.startTime));
    to = Math.max(to, sittingEnd(s));
  }
  const pct = (t: number) => ((t - from) / (to - from)) * 100;
  const blocks = sittings.map(s => {
    const start = ms(s.startTime);
    const end = sittingEnd(s);
    return {
      id: s.id,
      left: pct(start),
      width: pct(end) - pct(start),
      done: end <= now,
      live: start <= now && end > now,
    };
  });
  const done = blocks.filter(b => b.done).length;
  const hoursLeft =
    sittings.reduce(
      (sum, s) =>
        sum + Math.max(0, sittingEnd(s) - Math.max(now, ms(s.startTime))),
      0
    ) / 3600000;
  const ticks: { label: string; left: number }[] = [];
  for (let t = Math.ceil(from / 3600000) * 3600000; t <= to; t += 3 * 3600000) {
    ticks.push({
      label: new Date(t)
        .toLocaleTimeString("en-AU", { hour: "numeric" })
        .replace(" ", "")
        .toLowerCase(),
      left: pct(t),
    });
  }
  return {
    blocks,
    ticks,
    done,
    hoursLeft,
    now: now > from && now < to ? pct(now) : null,
  };
}

/** "in 25 min", "now", or a time later today. */
export function relativeStart(start: string | Date, now: number) {
  const mins = Math.round((ms(start) - now) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `in ${mins} min`;
  return new Date(start).toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Reference images arrive as JSON text or an array; return the first usable URL. */
export function firstImage(value: unknown): string | null {
  let list: unknown = value;
  if (typeof value === "string") {
    try {
      list = JSON.parse(value);
    } catch {
      return /^https?:|^data:|^\//.test(value) ? value : null;
    }
  }
  if (!Array.isArray(list)) return null;
  const item = list.find(
    x => typeof x === "string" || (x && typeof x === "object")
  );
  if (typeof item === "string") return item;
  if (item && typeof item === "object" && "url" in item)
    return String((item as { url: unknown }).url);
  return null;
}

/** A project title worth showing: placeholder text such as "N/A", "none" or "-" counts as no title. */
export function projectTitle(...values: (string | null | undefined)[]) {
  for (const v of values) {
    const t = v?.trim();
    if (t && !/^(n\/?a|none|null|undefined|-+)$/i.test(t)) return t;
  }
  return null;
}

/** When a sitting starts: "now", "in 25 min" or a time today; a weekday and time on any other day. */
export function startLabel(start: string | Date, now: number) {
  const d = new Date(start);
  if (d.toDateString() === new Date(now).toDateString()) return relativeStart(start, now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const time = d.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" }).replace(" ", "").toLowerCase();
  return d.toDateString() === tomorrow.toDateString()
    ? `tomorrow ${time}`
    : `${d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}, ${time}`;
}
