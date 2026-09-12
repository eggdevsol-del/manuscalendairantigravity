import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Action, Feedback } from "./primitives";
export function DesignBrief({ conversationId }: { conversationId: number }) {
  const query = trpc.designBrief.get.useQuery(
    { conversationId },
    { enabled: conversationId > 0 }
  );
  const refresh = trpc.designBrief.refresh.useMutation({
    onSuccess: () => query.refetch(),
  });
  const [open, setOpen] = useState(() => {
    try {
      return (
        localStorage.getItem(`brief-collapsed-${conversationId}`) !== "true"
      );
    } catch {
      return true;
    }
  });
  return (
    <section className="v3-design-brief" aria-label="Design brief">
      <div className="v3-inline">
        <button
          className="v3-brief-toggle"
          aria-expanded={open}
          onClick={() => {
            setOpen(!open);
            try {
              localStorage.setItem(
                `brief-collapsed-${conversationId}`,
                String(open)
              );
            } catch {}
          }}
        >
          Design brief <span aria-hidden>{open ? "⌃" : "⌄"}</span>
        </button>
        <Action
          tone="quiet"
          aria-label="Refresh design brief"
          disabled={refresh.isPending}
          onClick={() => refresh.mutate({ conversationId })}
        >
          <RefreshCw size={18} />
        </Action>
      </div>
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
    </section>
  );
}
