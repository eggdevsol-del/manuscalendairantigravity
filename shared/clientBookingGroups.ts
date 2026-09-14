export function bookingProjectKey(a: {
  id: number;
  sessionPlanId?: number | null;
}) {
  return a.sessionPlanId ? `plan:${a.sessionPlanId}` : `session:${a.id}`;
}
export function isActiveBooking(a: {
  status: string;
  remainingBalanceCents?: number | null;
}) {
  return (
    !["completed", "cancelled", "no-show"].includes(a.status) ||
    (a.status === "completed" && (a.remainingBalanceCents || 0) > 0)
  );
}
export function selectBookingProjects<
  T extends {
    id: number;
    sessionPlanId?: number | null;
    status: string;
    remainingBalanceCents?: number | null;
  },
>(rows: T[], tab: "upcoming" | "past") {
  const active = new Set(rows.filter(isActiveBooking).map(bookingProjectKey));
  return rows.filter(
    a => active.has(bookingProjectKey(a)) === (tab === "upcoming")
  );
}
