import { trpc } from "@/lib/trpc";
import {
  bookingDate,
  money,
  statusLabel,
} from "@/features/workspace/bookingPresentation";
import { ActionLink, Feedback, Panel, Status } from "./primitives";
import { ClientNotes } from "./ClientNotes";
export function ConversationContext({
  id,
  clientId,
  draft,
  onDraftChange,
  media = [],
}: {
  media?: string[];
  id: number;
  clientId: string;
  draft: string;
  onDraftChange: (value: string) => void;
}) {
  const query = trpc.projects.summary.useQuery({ conversationId: id });
  return (
    <aside
      className="v3-conversation-context"
      aria-label="Client and booking context"
    >
      <Panel>
        <h3>Session plan</h3>
        <Feedback
          loading={query.isLoading}
          error={query.error}
          onRetry={() => query.refetch()}
        />
        {query.data?.sessions.map(session => (
          <div key={session.id} className="v3-context-session">
            <strong>{bookingDate(session.startsAt)}</strong>
            <p>{session.title}</p>
            <Status>{statusLabel(session.status)}</Status>
            <p className="v3-muted">
              {money(session.remainingCents)} remaining
            </p>
            <ActionLink
              tone="quiet"
              href={`/projects/${id}?session=${session.id}`}
            >
              Forms & payments
            </ActionLink>
          </div>
        ))}
        {query.data && !query.data.sessions.length && (
          <p className="v3-muted">
            No sessions scheduled yet. Use Book to create a plan.
          </p>
        )}
      </Panel>
      <Panel>
        <h3>Shared references</h3>
        <div className="v3-file-grid">
          {[
            ...new Set([
              ...media,
              ...(query.data?.briefs.flatMap(b => b.images) || []),
            ]),
          ].map(url => (
            <a key={url} href={url} target="_blank" rel="noreferrer">
              <img src={url} alt="Shared design reference" loading="lazy" />
            </a>
          ))}
        </div>
        {!media.length && !query.data?.briefs.some(b => b.images.length) && (
          <p className="v3-muted">
            Photos shared in this conversation appear here.
          </p>
        )}
      </Panel>
      <ClientNotes
        key={clientId}
        clientId={clientId}
        draft={draft}
        onDraftChange={onDraftChange}
      />
    </aside>
  );
}
