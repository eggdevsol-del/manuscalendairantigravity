import { projectProgress } from "../data/projectProgress";
import { BookingProject } from "../pages/Booking";
import { projectKey } from "../data/projectSessions";
import { useState } from "react";
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
  const [expanded, setExpanded] = useState<string | null>(null);
  const keys = [
    ...new Set([
      ...(query.data?.sessions || []).map(projectKey),
      ...(query.data?.plans || [])
        .filter(
          p => p.paymentState || (p.requiresDeposit ?? p.status === "pending")
        )
        .map(p => `plan:${p.id}`),
    ]),
  ];
  return (
    <aside
      className="v3-conversation-context"
      aria-label="Client and booking context"
    >
      <Feedback
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
      />
      {keys.map(key => {
        const sessions = query.data!.sessions.filter(
          s => projectKey(s) === key
        );
        const plan = query.data!.plans.find(p => `plan:${p.id}` === key);
        const progress = projectProgress(sessions);
        const title =
          sessions.find(s => s.projectName)?.projectName ||
          plan?.projectName ||
          "Tattoo project";
        return (
          <section className="v3-conversation-project" key={key}>
            <button
              className="v3-row"
              aria-expanded={expanded === key}
              onClick={() => setExpanded(expanded === key ? null : key)}
              data-tour-repeat="conversation-project"
              data-tour-description="Expand one project to review its sittings, progress, forms and payments without leaving the conversation. Keeping returning clients' projects separate helps you avoid changing or collecting payment for the wrong work."
            >
              <span className="v3-row-copy">
                <strong>{title}</strong>
                <span>
                  {sessions.length
                    ? `${progress.completed}${progress.total === null ? "" : ` of ${progress.total}`} sittings complete`
                    : "Proposal"}
                </span>
              </span>
              <span aria-hidden="true">{expanded === key ? "−" : "+"}</span>
            </button>
            {expanded === key && (
              <div className="v3-inline-project">
                <BookingProject
                  conversationId={id}
                  projectId={key}
                  focused
                  embedded
                />
              </div>
            )}
          </section>
        );
      })}
      {!keys.length && (
        <p className="v3-muted">
          No tattoo projects yet. Start a new booking to propose dates.
        </p>
      )}
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
