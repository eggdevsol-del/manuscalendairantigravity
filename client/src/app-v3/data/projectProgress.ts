import { bookingProjectKey } from "../../../../shared/clientBookingGroups";

export type ProjectSitting = {
  id: number;
  sessionPlanId?: number | null;
  sessionIndex?: number | null;
  sessionTotal?: number | null;
  status: string;
  startsAt?: string | null;
  endsAt?: string | null;
};
const inactive = new Set(["completed", "cancelled", "no-show"]);
function timestamp(value?: string | null) {
  if (!value) return Infinity;
  const parsed = Date.parse(
    /(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : value.replace(" ", "T") + "Z"
  );
  return Number.isFinite(parsed) ? parsed : Infinity;
}
export function nextProjectSitting<T extends ProjectSitting>(
  sittings: T[],
  now = Date.now()
) {
  const active = sittings
    .filter(s => !inactive.has(s.status))
    .sort(
      (a, b) => timestamp(a.startsAt) - timestamp(b.startsAt) || a.id - b.id
    );
  return active.find(s => timestamp(s.endsAt || s.startsAt) > now) || active[0];
}
export function orderedProjectGroups<T extends ProjectSitting>(
  sittings: T[],
  now = Date.now()
) {
  const groups = new Map<string, T[]>();
  for (const sitting of sittings) {
    const key = bookingProjectKey(sitting);
    groups.set(key, [...(groups.get(key) || []), sitting]);
  }
  return [...groups.values()]
    .map(group =>
      group.sort(
        (a, b) =>
          (a.sessionIndex || Infinity) - (b.sessionIndex || Infinity) ||
          timestamp(a.startsAt) - timestamp(b.startsAt) ||
          a.id - b.id
      )
    )
    .sort(
      (a, b) =>
        timestamp(nextProjectSitting(a, now)?.startsAt) -
          timestamp(nextProjectSitting(b, now)?.startsAt) || a[0].id - b[0].id
    );
}
/** Do not infer artwork completion from payment, dates, or the number of loaded rows. */
export function projectProgress(sittings: ProjectSitting[]) {
  const unique = [...new Map(sittings.map(s => [s.id, s])).values()];
  const completed = unique.filter(s => s.status === "completed").length;
  const totals = unique
    .map(s => s.sessionTotal)
    .filter((n): n is number => Number.isInteger(n) && !!n && n! > 0);
  const reported =
    totals.length && new Set(totals).size === 1 ? totals[0] : null;
  // Conflicting/incomplete legacy data must not manufacture a percentage.
  const total =
    reported && reported >= unique.length && reported >= completed
      ? reported
      : null;
  return {
    completed,
    total,
    remaining: total === null ? null : total - completed,
    cancelled: unique.filter(s => s.status === "cancelled").length,
    missed: unique.filter(s => s.status === "no-show").length,
  };
}
