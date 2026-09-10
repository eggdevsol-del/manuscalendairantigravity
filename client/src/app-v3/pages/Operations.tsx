import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import {
  Action,
  ActionLink,
  Feedback,
  Panel,
  Row,
  Screen,
  Section,
  Tabs,
} from "../design/primitives";
import { bookingDate, money } from "@/features/workspace/bookingPresentation";
export function Operations() {
  const { user } = useAuth();
  const query = trpc.reconciliation.overview.useQuery(undefined, {
    enabled: user?.role === "admin",
  });
  const check = trpc.reconciliation.reconcilePlan.useMutation({
    onSuccess: () => void query.refetch(),
  });
  const retry = trpc.reconciliation.retryNotification.useMutation({
    onSuccess: () => void query.refetch(),
  });
  return (
    <Screen
      title="Operations"
      subtitle="Payment confirmation, delivery and outstanding forms."
      back="/business"
    >
      {user?.role !== "admin" ? (
        <Feedback empty="Administrator access is required." />
      ) : (
        <>
          <div className="v3-inline">
            <Action disabled={query.isFetching} onClick={() => query.refetch()}>
              Refresh
            </Action>
            <ActionLink href="/admin/errors">Error reports</ActionLink>
          </div>
          <Feedback
            loading={query.isLoading}
            error={query.error}
            onRetry={() => query.refetch()}
          />
          {(check.error || retry.error) && (
            <p role="alert">{(check.error || retry.error)?.message}</p>
          )}
          {check.data && <p role="status">{check.data.message}</p>}
          {query.data && (
            <>
              <Section title="Checkouts awaiting confirmation">
                {!query.data.plans.length && (
                  <Feedback empty="No unconfirmed checkouts." />
                )}
                {query.data.plans.map(plan => (
                  <Panel key={plan.id}>
                    <Row
                      title={`Plan #${plan.id}`}
                      detail={`Deposit ${money(plan.totalCents)} AUD`}
                    />
                    <Action
                      disabled={check.isPending}
                      onClick={() => check.mutate({ id: plan.id })}
                    >
                      Verify payment and confirm
                    </Action>
                  </Panel>
                ))}
              </Section>
              <Section title="Failed notifications">
                {!query.data.notifications.length && (
                  <Feedback empty="No failed deliveries." />
                )}
                {query.data.notifications.map(item => (
                  <Panel key={item.id}>
                    <Row
                      title={item.eventType}
                      detail={`#${item.id} · ${item.attemptCount} attempts`}
                    />
                    <Action
                      tone="secondary"
                      disabled={retry.isPending}
                      onClick={() => retry.mutate({ id: item.id })}
                    >
                      Queue retry
                    </Action>
                  </Panel>
                ))}
              </Section>
              <Section title="Outstanding forms">
                {query.data.forms.map(form => (
                  <Row
                    key={form.id}
                    title={form.title}
                    detail={`Appointment #${form.appointmentId}`}
                  />
                ))}
                {!query.data.forms.length && (
                  <Feedback empty="No pending forms." />
                )}
              </Section>
            </>
          )}
        </>
      )}
    </Screen>
  );
}
export function ErrorReports() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<"Unresolved" | "Resolved" | "All">(
    "Unresolved"
  );
  const [page, setPage] = useState(0);
  const [cleanup, setCleanup] = useState<"all" | "old" | null>(null);
  const query = trpc.errorLog.list.useQuery(
    {
      limit: 50,
      offset: page * 50,
      resolved: filter === "All" ? undefined : filter === "Resolved",
    },
    { enabled: user?.role === "admin" }
  );
  const refresh = () => {
    void query.refetch();
    setCleanup(null);
  };
  const resolve = trpc.errorLog.resolve.useMutation({ onSuccess: refresh });
  const clear = trpc.errorLog.clearResolved.useMutation({ onSuccess: refresh });
  const purge = trpc.errorLog.purgeOld.useMutation({ onSuccess: refresh });
  const busy = resolve.isPending || clear.isPending || purge.isPending;
  const error = resolve.error || clear.error || purge.error;
  return (
    <Screen title="Error reports" back="/admin/operations">
      {user?.role !== "admin" ? (
        <Feedback empty="Administrator access is required." />
      ) : (
        <>
          <Tabs
            items={["Unresolved", "Resolved", "All"] as const}
            value={filter}
            label="Error status"
            onChange={value => {
              setFilter(value);
              setPage(0);
            }}
          />
          <Feedback
            loading={query.isLoading}
            error={query.error}
            onRetry={() => query.refetch()}
          />
          {error && <p role="alert">{error.message}</p>}
          {query.data?.errors.map(item => (
            <Panel key={item.id}>
              <details>
                <summary>{item.message}</summary>
                <p>
                  {bookingDate(item.createdAt)} · {item.boundary || "App"} ·{" "}
                  {item.appVersion || "Unknown version"}
                </p>
                <p className="v3-muted">{item.url}</p>
                <pre className="v3-error-stack">
                  {item.stack || item.componentStack || "No stack provided."}
                </pre>
                {!item.resolved && (
                  <Action
                    disabled={busy}
                    onClick={() => resolve.mutate({ id: item.id })}
                  >
                    Mark resolved
                  </Action>
                )}
              </details>
            </Panel>
          ))}
          {query.data?.errors.length === 0 && (
            <Feedback empty="No error reports in this view." />
          )}
          <div className="v3-inline">
            <Action
              tone="secondary"
              disabled={!page || query.isFetching}
              onClick={() => setPage(value => value - 1)}
            >
              Previous
            </Action>
            <span>Page {page + 1}</span>
            <Action
              tone="secondary"
              disabled={
                !query.data ||
                (page + 1) * 50 >= query.data.total ||
                query.isFetching
              }
              onClick={() => setPage(value => value + 1)}
            >
              Next
            </Action>
          </div>
          <Section title="Record cleanup">
            <Action
              tone="quiet"
              disabled={busy}
              onClick={() => setCleanup("old")}
            >
              Clear resolved reports older than 30 days
            </Action>
            <Action
              tone="quiet"
              disabled={busy}
              onClick={() => setCleanup("all")}
            >
              Clear all resolved reports
            </Action>
          </Section>
          <SheetShell
            isOpen={!!cleanup}
            title="Remove resolved reports?"
            onClose={() => {
              if (!busy) setCleanup(null);
            }}
          >
            <div className="v3-stack">
              <p>
                {cleanup === "old"
                  ? "Resolved reports older than 30 days will be removed."
                  : "All resolved reports will be removed."}{" "}
                Unresolved reports are retained. This cannot be undone.
              </p>
              {error && <p role="alert">{error.message}</p>}
              <Action
                tone="danger"
                disabled={busy}
                onClick={() =>
                  cleanup === "old" ? purge.mutate() : clear.mutate()
                }
              >
                {busy ? "Removing…" : "Remove resolved reports"}
              </Action>
            </div>
          </SheetShell>
        </>
      )}
    </Screen>
  );
}
