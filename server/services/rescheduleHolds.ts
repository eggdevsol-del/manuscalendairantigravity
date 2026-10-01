import { and, eq, gt, lt, ne } from "drizzle-orm";
import * as s from "../../drizzle/schema";
export async function hasRescheduleHold(
  db: any,
  artistId: string,
  start: Date,
  end: Date,
  excludeAppointmentId?: number
) {
  const stamp = (date: Date) =>
    date.toISOString().slice(0, 19).replace("T", " ");
  const conditions = [
    eq(s.rescheduleRequests.artistId, artistId),
    eq(s.rescheduleRequests.status, "pending"),
    gt(s.rescheduleRequests.expiresAt, stamp(new Date())),
    lt(s.rescheduleRequests.startsAt, stamp(end)),
    gt(s.rescheduleRequests.endsAt, stamp(start)),
  ];
  if (excludeAppointmentId)
    conditions.push(
      ne(s.rescheduleRequests.appointmentId, excludeAppointmentId)
    );
  const rows = await db
    .select({ id: s.rescheduleRequests.id })
    .from(s.rescheduleRequests)
    .where(and(...conditions))
    .limit(1);
  return rows.length > 0;
}
