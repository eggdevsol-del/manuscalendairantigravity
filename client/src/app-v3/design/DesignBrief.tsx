import { DetailsSheet } from "../components/DetailsSheet";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Action, Feedback } from "./primitives";
export function DesignBrief({ conversationId }: { conversationId: number }) {
  const [open, setOpen] = useState(false);
  const query = trpc.designBrief.get.useQuery(
    { conversationId },
    { enabled: open && conversationId > 0 }
  );
  const refresh = trpc.designBrief.refresh.useMutation({
    onSuccess: () => query.refetch(),
  });
  return (
    <DetailsSheet
      title="Design brief"
      open={open}
      onOpenChange={setOpen}
      className="v3-design-brief"
    >
      <Action
        tone="quiet"
        aria-label="Refresh design brief"
        disabled={refresh.isPending}
        onClick={() => refresh.mutate({ conversationId })}
      >
        <RefreshCw size={18} />
      </Action>
      {open && (
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
    </DetailsSheet>
  );
}
