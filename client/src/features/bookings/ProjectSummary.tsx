import { useAuth } from "@/_core/hooks/useAuth";
import { Link, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/ui/ssot";
import { Button } from "@/components/ui";
const money = (cents: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(
    cents / 100
  );
const date = (value: string) =>
  new Date(
    value.includes("T") ? value : value.replace(" ", "T") + "Z"
  ).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });
export default function ProjectSummary() {
  const [, params] = useRoute("/projects/:id");
  const conversationId = Number(params?.id);
  const query = trpc.projects.summary.useQuery(
    { conversationId },
    { enabled: conversationId > 0 }
  );
  const { user } = useAuth();
  const join = trpc.waitlist.join.useMutation();
  const data = query.data;
  return (
    <main className="h-[calc(100dvh-5rem)] overflow-y-auto touch-pan-y bg-background text-foreground pb-24">
      <PageHeader
        title="Project details"
        subtitle="Sessions, forms and payment history"
      />
      <div className="max-w-3xl mx-auto p-5 space-y-6">
        <Link
          href={`/chat/${conversationId}`}
          className="inline-flex min-h-11 items-center underline"
        >
          Back to conversation
        </Link>
        {query.isLoading && <p role="status">Loading your project…</p>}
        {query.error && (
          <div role="alert">
            <p>{query.error.message}</p>
            <Button onClick={() => query.refetch()}>Try again</Button>
          </div>
        )}
        {data && (
          <>
            <section className="rounded-2xl border p-5">
              <h1 className="text-2xl font-semibold">
                {data.artist?.name} · {data.client?.name}
              </h1>
              {data.location && (
                <p className="mt-2 text-muted-foreground">{data.location}</p>
              )}
              <p className="mt-3 text-sm">
                Estimates can change with the agreed design. See the proposal in
                your conversation for its terms.
              </p>
            </section>
            {user?.role === "client" && (
              <section className="border rounded-2xl p-5 space-y-3">
                <h2 className="text-lg font-semibold">Want an earlier time?</h2>
                <p>
                  Your artist can offer cancellation slots. Joining does not
                  change your existing booking.
                </p>
                <Button
                  disabled={join.isPending || join.isSuccess}
                  onClick={() => join.mutate({ conversationId })}
                >
                  {join.isSuccess
                    ? "You’re on the waitlist"
                    : "Join cancellation waitlist"}
                </Button>
                {join.error && <p role="alert">{join.error.message}</p>}
                <Link
                  href="/waitlist"
                  className="block underline min-h-11 py-3"
                >
                  View cancellation offers
                </Link>
              </section>
            )}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Sessions</h2>
              {!data.sessions.length && (
                <p>
                  No sessions are booked yet. Review your proposal in the
                  conversation.
                </p>
              )}
              {data.sessions.map(s => (
                <article
                  key={s.id}
                  className="rounded-2xl border p-5 space-y-3"
                >
                  <div className="flex justify-between gap-3">
                    <h3 className="font-semibold">{s.title}</h3>
                    <span className="text-sm capitalize">{s.status}</span>
                  </div>
                  <p>{date(s.startsAt)}</p>
                  <dl className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <dt>Estimate</dt>
                      <dd className="font-semibold">
                        {money(s.estimateCents)}
                      </dd>
                    </div>
                    <div>
                      <dt>Recorded paid</dt>
                      <dd className="font-semibold">{money(s.paidCents)}</dd>
                    </div>
                    <div>
                      <dt>Balance</dt>
                      <dd className="font-semibold">
                        {money(s.remainingCents)}
                      </dd>
                    </div>
                  </dl>
                  <ul className="space-y-1 text-sm">
                    {data.forms
                      .filter(f => f.appointmentId === s.id)
                      .map(f => (
                        <li key={f.id}>
                          {f.title}: <strong>{f.status}</strong>
                        </li>
                      ))}
                  </ul>
                  <Link
                    href={`/chat/${conversationId}`}
                    className="inline-flex min-h-11 items-center underline"
                  >
                    {s.status === "completed"
                      ? "Ask your artist about aftercare"
                      : s.paymentStatus === "pending_deposit"
                        ? "Review payment with your artist"
                        : "Message your artist"}
                  </Link>
                </article>
              ))}
            </section>
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Proposals</h2>
              {!data.plans.length && <p>No session proposals yet.</p>}
              {data.plans.map(p => (
                <div
                  key={p.id}
                  className="border rounded-xl p-4 flex justify-between gap-3"
                >
                  <span>
                    Plan #{p.id} · {p.status}
                  </span>
                  <span>{money(p.estimateCents)} estimate</span>
                </div>
              ))}
            </section>
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Payment history</h2>
              <p className="text-sm text-muted-foreground">
                Recorded transactions linked to these sessions and proposals.
                Older or imported payments may appear only in the session
                totals; an absent transaction is not proof of non-payment.
              </p>
              {!data.history.length && (
                <p>No linked transactions are recorded.</p>
              )}
              {data.history.map(h => (
                <article key={h.id} className="border rounded-xl p-4">
                  <div className="flex justify-between gap-3">
                    <span className="capitalize font-medium">
                      {h.type} · {h.method || "Payment"}
                    </span>
                    <strong>{money(h.amountCents)}</strong>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {h.createdAt && date(h.createdAt)}
                    {h.bookingId
                      ? ` · Session #${h.bookingId}`
                      : " · Project payment"}
                  </p>
                  {h.platformFeeCents !== 0 && (
                    <p className="text-sm mt-1">
                      Platform fee: {money(h.platformFeeCents)}
                    </p>
                  )}
                </article>
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
