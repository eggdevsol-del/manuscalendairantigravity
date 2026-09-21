import { DetailsSheet } from "../components/DetailsSheet";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Action, Feedback } from "./primitives";
export function DesignBrief({
  conversationId,
  inline = false,
}: {
  conversationId: number;
  inline?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const query = trpc.designBrief.get.useQuery(
    { conversationId },
    { enabled: (open || inline) && conversationId > 0 }
  );
  const refresh = trpc.designBrief.refresh.useMutation({
    onSuccess: () => query.refetch(),
  });
  const content = (
    <>
      <Action
        tone="quiet"
        aria-label="Refresh design brief"
        disabled={refresh.isPending}
        onClick={() => refresh.mutate({ conversationId })}
      >
        <RefreshCw size={18} />
      </Action>
      {(open || inline) && (
        <>
          <Feedback
            loading={query.isLoading}
            error={query.error || refresh.error}
            onRetry={() => query.refetch()}
          />
          {query.data?.brief ? (
            <p>{query.data.brief}</p>
          ) : (
            !query.isLoading &&
            !query.error && (
              <p className="v3-muted">
                A brief will appear as the conversation develops.
              </p>
            )
          )}
          {query.data?.isStale && (
            <small>
              Showing the last available summary. Refresh to include recent
              messages.
            </small>
          )}
        </>
      )}
    </>
  );
  return inline ? (
    <section className="v3-stack">
      <h3>Design brief</h3>
      {content}
    </section>
  ) : (
    <DetailsSheet
      title="Design brief"
      open={open}
      onOpenChange={setOpen}
      className="v3-design-brief"
    >
      {content}
    </DetailsSheet>
  );
}
