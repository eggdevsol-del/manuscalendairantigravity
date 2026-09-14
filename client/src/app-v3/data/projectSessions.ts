/** Session plans are stable booking identities; legacy standalone sessions stay separate. */
import { bookingProjectKey as projectKey } from "../../../../shared/clientBookingGroups";
export { projectKey };
export function projectSessions<
  T extends { id: number; sessionPlanId?: number | null },
>(sessions: T[], selected?: T) {
  return selected
    ? sessions.filter(s => projectKey(s) === projectKey(selected))
    : [];
}
