import { and, eq, inArray } from "drizzle-orm";
import { appointmentLogs } from "../../drizzle/schema";
import { getDb } from "./core";

/** Read existing audit history; a date change never creates a different project. */
export async function rescheduledSittingIds(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  appointmentIds: number[]
) {
  if (!appointmentIds.length) return new Set<number>();
  const rows = await db
    .selectDistinct({ appointmentId: appointmentLogs.appointmentId })
    .from(appointmentLogs)
    .where(
      and(
        inArray(appointmentLogs.appointmentId, appointmentIds),
        eq(appointmentLogs.action, "rescheduled")
      )
    );
  return new Set(rows.map(row => row.appointmentId));
}
