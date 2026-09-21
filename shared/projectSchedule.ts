/** Calendar-day gaps are evaluated in the artist's time zone, including DST. */
export function calendarDay(value: string | Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: string) =>
    Number(parts.find(p => p.type === type)?.value);
  return Date.UTC(part("year"), part("month") - 1, part("day")) / 86400000;
}
export function scheduleGapDays(
  previous: string | Date,
  next: string | Date,
  zone: string
): number {
  return Math.max(0, calendarDay(next, zone) - calendarDay(previous, zone) - 1);
}
export function scheduleGapNote(days: number): string {
  return `Schedule gap · ${days} day${days === 1 ? "" : "s"} between sittings. A complete consecutive run was not available before the project deadline.`;
}
/** Fewest calendar-day breaks, then shortest gaps and earliest finish. */
export function selectConsecutiveSlots(
  dates: Date[],
  count: number,
  zone: string,
  allowSplits: boolean
): Date[] {
  if (count < 1 || dates.length < count) return [];
  const days = dates.map(d => calendarDay(d, zone));
  const scores = dates.map(() => Array(count + 1).fill(Infinity));
  const parents = dates.map(() => Array(count + 1).fill(-1));
  for (let i = 0; i < dates.length; i++) {
    scores[i][1] = 0;
    for (let k = 2; k <= count; k++)
      for (let j = k - 2; j < i; j++) {
        const cost =
          scores[j][k - 1] +
          (days[i] === days[j] + 1 ? 0 : 1000 + days[i] - days[j] - 1);
        if (cost < scores[i][k]) {
          scores[i][k] = cost;
          parents[i][k] = j;
        }
      }
  }
  let end = -1,
    best = Infinity;
  for (let i = 0; i < dates.length; i++)
    if (scores[i][count] < best) {
      best = scores[i][count];
      end = i;
    }
  if (end < 0 || (!allowSplits && best > 0)) return [];
  const chosen: Date[] = [];
  for (let k = count; k > 0; k--) {
    chosen.unshift(dates[end]);
    end = parents[end][k];
  }
  return chosen;
}
