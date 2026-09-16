import { trpc } from "@/lib/trpc";
import {
  bookingDate,
  money,
  statusLabel,
} from "@/features/workspace/bookingPresentation";
import { ActionLink, Feedback } from "../design/primitives";

/** All linked sitting disclosures read the same authorized project summary/cache. */
export function SittingSummary({
  conversationId,
  appointmentId,
}: {
  conversationId: number;
  appointmentId: number;
}) {
  const query = trpc.projects.summary.useQuery({ conversationId });
  const session = query.data?.sessions.find(s => s.id === appointmentId);
  return (
    <div className="v3-stack">
      <Feedback
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
      />
      {session ? (
        <>
          <p>
            {bookingDate(session.startsAt, session.timeZone)} ·{" "}
            {statusLabel(session.status)}
          </p>
          {query.data?.location && <p>{query.data.location}</p>}
          <dl className="v3-facts">
            <div>
              <dt>Session estimate</dt>
              <dd>{money(session.estimateCents)}</dd>
            </div>
            <div>
              <dt>Recorded paid</dt>
              <dd>{money(session.paidCents)}</dd>
            </div>
            <div>
              <dt>Balance due</dt>
              <dd>{money(session.remainingCents)}</dd>
            </div>
          </dl>
          {query.data?.forms
            .filter(f => f.appointmentId === appointmentId)
            .map(f => (
              <p key={f.id}>
                {f.title} · {statusLabel(f.status)}
              </p>
            ))}
          <ActionLink
            href={`/projects/${conversationId}?session=${appointmentId}`}
          >
            Open sitting & actions
          </ActionLink>
        </>
      ) : (
        !query.isLoading &&
        !query.error && (
          <Feedback empty="This sitting is no longer available." />
        )
      )}
    </div>
  );
}
