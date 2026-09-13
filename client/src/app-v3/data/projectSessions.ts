/** Session plans are stable booking identities; legacy standalone sessions stay separate. */
export function projectKey(session: {
  id: number;
  sessionPlanId?: number | null;
}) {
  return session.sessionPlanId
    ? `plan:${session.sessionPlanId}`
    : `session:${session.id}`;
}
export function projectSessions<
  T extends { id: number; sessionPlanId?: number | null },
>(sessions: T[], selected?: T) {
  return selected
    ? sessions.filter(s => projectKey(s) === projectKey(selected))
    : [];
}
