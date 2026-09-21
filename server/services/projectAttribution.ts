import { bookingProjectKey } from "../../shared/clientBookingGroups";
type Session = {
  id: number;
  sessionPlanId: number | null;
  depositPaymentId: string | null;
  balancePaymentId: string | null;
};
type Plan = { id: number; stripeSessionId: string | null };
export function paymentSessions<T extends Session>(
  entry: { bookingId: number | null; stripePaymentId: string | null },
  sessions: T[]
): T[] {
  return sessions.filter(
    s =>
      s.id === entry.bookingId ||
      (!!entry.stripePaymentId &&
        [s.depositPaymentId, s.balancePaymentId].includes(
          entry.stripePaymentId
        ))
  );
}
/** Only stable record/payment links establish project ownership; a shared conversation is not evidence. */
export function paymentProjectKeys(
  entry: { bookingId: number | null; stripePaymentId: string | null },
  sessions: Session[],
  plans: Plan[]
) {
  const paymentId = entry.stripePaymentId;
  return [
    ...new Set(
      paymentSessions(entry, sessions)
        .map(bookingProjectKey)
        .concat(
          plans
            .filter(p => !!paymentId && p.stripeSessionId === paymentId)
            .map(p => `plan:${p.id}`)
        )
    ),
  ];
}
export function briefProjectKeys(
  lead: { id: number; paymentId: string | null },
  plans: (Plan & { message?: { metadata: string | null } | null })[]
) {
  return plans
    .filter(p => {
      let metadata: Record<string, unknown> = {};
      try {
        metadata = JSON.parse(p.message?.metadata || "{}");
      } catch {}
      return (
        metadata?.leadId === lead.id ||
        (!!lead.paymentId && lead.paymentId === p.stripeSessionId)
      );
    })
    .map(p => `plan:${p.id}`);
}
