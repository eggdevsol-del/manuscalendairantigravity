import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Action, Feedback, Panel } from "./primitives";

/** Shown in place of details the server keeps back until the client has replied, booked or paid. */
export const CLIENT_DETAILS_PENDING =
  "Their contact details and your private notes open up once they reply to you, book or pay. Until then you can message them as usual.";
export const CLIENT_NOTES_PENDING =
  "You can add private notes once they reply to you, book or pay.";

export const isForbidden = (error: unknown) =>
  (error as { data?: { code?: string } } | null)?.data?.code === "FORBIDDEN";

export function ClientNotes({
  clientId,
  draft: sharedDraft,
  onDraftChange,
}: {
  clientId: string;
  draft?: string;
  onDraftChange?: (value: string) => void;
}) {
  const [localDraft, setLocalDraft] = useState("");
  const draft = sharedDraft ?? localDraft;
  const setDraft = onDraftChange ?? setLocalDraft;
  const query = trpc.clientProfile.getClientNotes.useQuery(
    { clientId },
    { enabled: !!clientId }
  );
  // The client list says whether notes are open for this person; it is
  // usually already loaded by the home and clients screens.
  const listed = trpc.conversations.getClients
    .useQuery(undefined, { enabled: !!clientId, staleTime: 5 * 60_000 })
    .data?.find(c => c?.id === clientId);
  const add = trpc.clientProfile.addClientNote.useMutation({
    onSuccess: () => {
      setDraft("");
      void query.refetch();
    },
  });
  // The server may also refuse a save for someone the list has not caught up on.
  const pending = listed?.profileAvailable === false || isForbidden(add.error);
  return (
    <Panel>
      <h3>Private notes</h3>
      <p className="v3-muted">Artist notes · not sent to the client</p>
      <Feedback
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
      />
      {pending ? (
        <p className="v3-muted">{CLIENT_NOTES_PENDING}</p>
      ) : (
        <form
          className="v3-form"
          onSubmit={e => {
            e.preventDefault();
            if (draft.trim() && !add.isPending)
              add.mutate({ clientId, note: draft.trim() });
          }}
        >
          <label>
            New note
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              disabled={add.isPending}
            />
          </label>
          {add.error && (
            <p role="alert">
              Couldn’t save. Your draft is still here. Try again.
            </p>
          )}
          <Action type="submit" disabled={!draft.trim() || add.isPending}>
            {add.isPending ? "Saving…" : "Save note"}
          </Action>
        </form>
      )}
      {query.data?.map((note: any) => (
        <p className="v3-divider" key={note.id}>
          {note.note || note.content}
        </p>
      ))}
    </Panel>
  );
}
