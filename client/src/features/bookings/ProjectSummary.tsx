import { useState } from "react";
import { ProjectFormsSheet } from "./ProjectFormsSheet";
import { projectNextStep } from "./projectStatus";
import { toast } from "sonner";
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
  const [formsFor, setFormsFor] = useState<number | null>(null);
  const data = query.data;
  const isArtist = user?.role === "artist" || user?.role === "admin";
  const next = data ? projectNextStep(data, isArtist) : null;
  const firstPendingForm = data?.forms.find(
    f =>
      f.status === "pending" &&
      data.sessions.some(
        s =>
          s.id === f.appointmentId &&
          !["cancelled", "completed", "no-show"].includes(s.status)
      )
  );
  const projectUrl = `${window.location.origin}/projects/${conversationId}`;
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(projectUrl);
      toast.success("Project link copied");
    } catch {
      toast.error("Could not copy. You can copy this page’s address instead.");
    }
  };
  return (
    <main className="app-document h-[calc(100dvh-5rem)] overflow-y-auto touch-pan-y bg-background text-foreground pb-24">
      <PageHeader
        title="Project"
        subtitle="Brief, sessions, forms and payments"
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
            {next && (
              <section
                className="rounded-2xl border border-primary/30 bg-primary/5 p-5 space-y-3"
                aria-label="Next step"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Next step
                </p>
                <h2 className="text-xl font-semibold">{next.title}</h2>
                <p className="text-sm text-muted-foreground">{next.body}</p>
                {next.action === "Review forms" &&
                firstPendingForm?.appointmentId ? (
                  <Button
                    onClick={() => setFormsFor(firstPendingForm.appointmentId)}
                  >
                    Review & sign forms
                  </Button>
                ) : (
                  <Link
                    href={`/chat/${conversationId}`}
                    className="inline-flex rounded-full bg-primary text-primary-foreground px-5 py-3 font-medium"
                  >
                    {next.action}
                  </Link>
                )}
              </section>
            )}
            <div className="flex flex-wrap gap-3 items-center">
              <Button variant="outline" onClick={copyLink}>
                Copy project link
              </Button>
              {isArtist && (
                <a
                  className="min-h-11 inline-flex items-center underline"
                  href={`sms:?body=${encodeURIComponent(`Your tattoo project with ${data.artist?.name || "your artist"}: ${projectUrl} — keep this link for your brief, bookings and payments. Sign in with your Tattoi account when asked.`)}`}
                >
                  Prepare SMS link
                </a>
              )}
              <p className="text-xs text-muted-foreground w-full">
                This reusable link opens your project after sign-in. It does not
                grant access to anyone you forward it to.
              </p>
            </div>
            <section className="space-y-3" aria-label="Design brief">
              <h2 className="text-xl font-semibold">
                Design brief & references
              </h2>
              {!data.briefs.length && (
                <p className="text-sm text-muted-foreground">
                  Discuss your design in the conversation. No separate brief is
                  recorded yet.
                </p>
              )}
              {data.briefs.map(brief => (
                <article
                  key={brief.id}
                  className="rounded-2xl border bg-card p-5 space-y-2"
                >
                  <h3 className="font-semibold">{brief.subject}</h3>
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                    {brief.description}
                  </p>
                </article>
              ))}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {data.references.map((ref, i) => (
                  <a
                    key={`${ref.url}-${i}`}
                    href={ref.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-2xl border overflow-hidden"
                  >
                    <img
                      loading="lazy"
                      src={ref.url}
                      alt={`${ref.kind} image ${i + 1}`}
                      className="aspect-square w-full object-cover"
                    />
                    <span className="block p-2 text-xs">{ref.kind}</span>
                  </a>
                ))}
              </div>
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
                          {!isArtist &&
                            f.status === "pending" &&
                            !["cancelled", "completed", "no-show"].includes(
                              s.status
                            ) && (
                              <button
                                className="ml-3 min-h-11 underline"
                                onClick={() => setFormsFor(s.id)}
                              >
                                Review & sign
                              </button>
                            )}
                        </li>
                      ))}
                  </ul>
                  <Link
                    href={`/chat/${conversationId}`}
                    className="inline-flex min-h-11 items-center underline"
                  >
                    {isArtist
                      ? "Open client conversation"
                      : s.status === "completed"
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
      {formsFor && (
        <ProjectFormsSheet
          appointmentId={formsFor}
          onClose={() => {
            setFormsFor(null);
            void query.refetch();
          }}
          onSigned={() => {
            void query.refetch();
          }}
        />
      )}
    </main>
  );
}
