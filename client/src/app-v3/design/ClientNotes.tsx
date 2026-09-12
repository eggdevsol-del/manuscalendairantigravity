import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Action, Feedback, Panel } from "./primitives";
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
  const add = trpc.clientProfile.addClientNote.useMutation({
    onSuccess: () => {
      setDraft("");
      void query.refetch();
    },
  });
  return (
    <Panel>
      <h3>Private notes</h3>
      <p className="v3-muted">Artist notes · not sent to the client</p>
      <Feedback
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
      />
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
      {query.data?.map((note: any) => (
        <p className="v3-divider" key={note.id}>
          {note.note || note.content}
        </p>
      ))}
    </Panel>
  );
}
