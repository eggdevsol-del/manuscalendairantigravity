import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { PageHeader, PageShell } from "@/components/ui/ssot";
import { Button } from "@/components/ui";
export default function Reconciliation() {
  const { user } = useAuth();
  const query = trpc.reconciliation.overview.useQuery(undefined, {
    enabled: user?.role === "admin",
  });
  const reconcile = trpc.reconciliation.reconcilePlan.useMutation({
    onSuccess: () => {
      void query.refetch();
    },
  });
  const retry = trpc.reconciliation.retryNotification.useMutation({
    onSuccess: () => {
      void query.refetch();
    },
  });
  if (user?.role !== "admin")
    return <p className="p-6">Administrator access is required.</p>;
  return (
    <PageShell>
      <PageHeader
        title="Operations"
        subtitle="Payment confirmation, delivery and outstanding forms."
      />
      <div className="p-5 max-w-4xl mx-auto space-y-6">
        <Button
          variant="outline"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
        >
          Refresh
        </Button>
        {query.isLoading && <p role="status">Loading operational status…</p>}
        {(query.error || reconcile.error || retry.error) && (
          <p role="alert" className="text-destructive">
            {query.error?.message ||
              reconcile.error?.message ||
              retry.error?.message}
          </p>
        )}
        {reconcile.data && <p role="status">{reconcile.data.message}</p>}
        {query.data && (
          <>
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">
                Checkouts awaiting confirmation
              </h2>
              <p className="text-sm text-muted-foreground">
                These plans have a checkout attached. Check Stripe status before
                treating them as paid. Up to 100 most recent records.
              </p>
              {!query.data.plans.length && <p>No plans need checking.</p>}
              {query.data.plans.map(p => (
                <article
                  key={p.id}
                  className="border rounded-xl p-4 flex flex-wrap gap-4 justify-between items-center"
                >
                  <div>
                    <h3 className="font-semibold">Plan #{p.id}</h3>
                    <p className="text-sm text-muted-foreground">
                      Deposit: AUD ${(p.totalCents / 100).toFixed(2)}
                    </p>
                  </div>
                  <Button
                    disabled={reconcile.isPending}
                    onClick={() => reconcile.mutate({ id: p.id })}
                  >
                    Check payment and confirm
                  </Button>
                </article>
              ))}
            </section>
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Failed notifications</h2>
              {!query.data.notifications.length && <p>No failed deliveries.</p>}
              {query.data.notifications.map(n => (
                <article
                  className="border rounded-xl p-4 flex justify-between gap-4"
                  key={n.id}
                >
                  <div>
                    <h3>{n.eventType}</h3>
                    <p className="text-sm text-muted-foreground">
                      #{n.id} · {n.attemptCount} attempts
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    disabled={retry.isPending}
                    onClick={() => retry.mutate({ id: n.id })}
                  >
                    Queue retry
                  </Button>
                </article>
              ))}
            </section>
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Outstanding consent</h2>
              {!query.data.forms.length && <p>No outstanding forms.</p>}
              {query.data.forms.map(f => (
                <article key={f.id} className="border rounded-xl p-4">
                  <h3>{f.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    Form #{f.id} · Booking #{f.appointmentId || "unlinked"}
                  </p>
                </article>
              ))}
            </section>
          </>
        )}
      </div>
    </PageShell>
  );
}
