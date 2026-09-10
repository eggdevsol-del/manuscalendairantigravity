import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link, useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { PageShell, PageHeader } from "@/components/ui/ssot";
import { Button } from "@/components/ui";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import { InlineFormSigning } from "@/features/booking/components/InlineFormSigning";
import { BalanceCheckoutSheet } from "./BalanceCheckoutSheet";
import { SessionPlanCheckoutSheet } from "./SessionPlanCheckoutSheet";
import {
  bookingDate,
  money,
  instant,
  statusLabel,
} from "@/features/workspace/bookingPresentation";
import {
  CheckCircle2,
  MessageCircle,
  MapPin,
  CalendarDays,
} from "lucide-react";
export default function ProjectSummary() {
  const [, params] = useRoute("/projects/:id");
  const id = Number(params?.id);
  const [, go] = useLocation();
  const { user } = useAuth();
  const client = user?.role === "client";
  const query = trpc.projects.summary.useQuery(
    { conversationId: id },
    { enabled: id > 0 }
  );
  const data = query.data;
  const [tab, setTab] = useState("Overview");
  const [selectedId, setSelectedId] = useState<number | null>(
    () => Number(new URLSearchParams(location.search).get("session")) || null
  );
  const [signing, setSigning] = useState(false);
  const [balance, setBalance] = useState(false);
  const [planId, setPlanId] = useState<number | null>(null);
  const sessions = data?.sessions || [];
  const session =
    sessions.find(s => s.id === selectedId) ||
    sessions.find(
      s =>
        s.status !== "cancelled" &&
        s.status !== "completed" &&
        instant(s.endsAt) > new Date()
    ) ||
    sessions.at(-1);
  const forms = trpc.forms.getPendingForms.useQuery(
    { appointmentId: session?.id },
    { enabled: client && !!session?.id }
  );
  const sessionForms =
    data?.forms.filter(f => f.appointmentId === session?.id) || [];
  const pending = data?.plans.find(p => p.status === "pending");
  const join = trpc.waitlist.join.useMutation();
  const refresh = () => {
    void query.refetch();
    void forms.refetch();
  };
  return (
    <PageShell>
      <PageHeader
        title={session?.title || "Your booking"}
        subtitle={client ? data?.artist?.name || "" : data?.client?.name || ""}
        onBack={() => go(client ? "/bookings" : "/dashboard")}
      />
      <main className="workspace-scroll">
        <div className="workspace-content space-y-6">
          {query.isLoading && <p role="status">Loading booking…</p>}
          {query.error && (
            <div role="alert">
              <p>{query.error.message}</p>
              <Button onClick={() => query.refetch()}>Try again</Button>
            </div>
          )}
          {data && (
            <>
              <div
                className="workspace-tabs"
                role="tablist"
                aria-label="Booking sections"
              >
                {["Overview", "Files", "Payments"].map(t => (
                  <button
                    key={t}
                    role="tab"
                    aria-selected={tab === t}
                    onClick={() => setTab(t)}
                  >
                    {t}
                  </button>
                ))}
                <Link
                  className="inline-flex items-center min-h-12 text-muted-foreground"
                  href={`/chat/${id}`}
                >
                  Messages
                </Link>
              </div>
              {sessions.length > 1 && (
                <label className="block text-sm">
                  Session
                  <select
                    value={session?.id}
                    onChange={e => setSelectedId(Number(e.target.value))}
                    className="block mt-2 border border-border rounded-xl min-h-12 w-full px-3 bg-background"
                  >
                    {sessions.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.title} · {bookingDate(s.startsAt, s.timeZone)} ·{" "}
                        {statusLabel(s.status)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {tab === "Overview" && (
                <div className="grid gap-7 lg:grid-cols-[1.3fr_1fr]">
                  <section className="space-y-6">
                    {client && pending && (
                      <div className="workspace-card !bg-accent">
                        <h2 className="font-semibold text-lg">
                          Confirm your appointment
                        </h2>
                        <p className="workspace-subtitle">
                          Review the dates, terms and deposit to secure your
                          booking.
                        </p>
                        <Button
                          className="w-full mt-4"
                          onClick={() => setPlanId(pending.id)}
                        >
                          Review {money(pending.depositCents)} deposit
                        </Button>
                      </div>
                    )}
                    {session ? (
                      <>
                        <span
                          className="workspace-status"
                          data-tone={
                            session.status === "confirmed"
                              ? "success"
                              : undefined
                          }
                        >
                          {statusLabel(session.status)}
                        </span>
                        <div className="space-y-3">
                          <p className="flex gap-3 items-center">
                            <CalendarDays size={20} />
                            {bookingDate(session.startsAt, session.timeZone)}
                          </p>
                          {data.location && (
                            <p className="flex gap-3 items-center">
                              <MapPin size={20} />
                              {data.location}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Times in {session.timeZone.replaceAll("_", " ")}
                          </p>
                        </div>
                        <section>
                          <h2 className="workspace-section-title">
                            Ready for the session
                          </h2>
                          <div className="workspace-menu-row !py-3">
                            {session.paidCents > 0 && (
                              <CheckCircle2
                                size={18}
                                className="text-status-success-text"
                              />
                            )}
                            <span>
                              {session.paidCents > 0
                                ? `${money(session.paidCents)} payment received`
                                : "No payment recorded"}
                            </span>
                          </div>
                          {sessionForms.map(f => (
                            <div
                              className="workspace-menu-row !py-3"
                              key={f.id}
                            >
                              {f.status === "signed" && (
                                <CheckCircle2
                                  size={18}
                                  className="text-status-success-text"
                                />
                              )}
                              <span className="flex-1">{f.title}</span>
                              <span className="text-sm text-muted-foreground">
                                {f.status}
                              </span>
                            </div>
                          ))}
                          {!sessionForms.length && (
                            <p className="workspace-subtitle text-sm">
                              No forms attached to this session.
                            </p>
                          )}
                          {client && !!forms.data?.length && (
                            <Button
                              className="w-full mt-4"
                              onClick={() => setSigning(true)}
                            >
                              Complete your consent forms
                            </Button>
                          )}
                          {forms.error && client && (
                            <Button
                              variant="outline"
                              onClick={() => forms.refetch()}
                            >
                              Retry consent forms
                            </Button>
                          )}
                        </section>
                      </>
                    ) : (
                      <div className="workspace-card">
                        <h2 className="font-semibold">
                          Your request is with your artist
                        </h2>
                        <p className="workspace-subtitle">
                          Use Messages to discuss your piece. Your proposal and
                          appointment will appear here when ready.
                        </p>
                      </div>
                    )}
                    {!!data.briefs.length && (
                      <section>
                        <h2 className="workspace-section-title">
                          Design notes
                        </h2>
                        {data.briefs.map(b => (
                          <div key={b.id} className="pb-4">
                            <p className="whitespace-pre-wrap">
                              {b.description ||
                                "Discuss your design in Messages."}
                            </p>
                            {b.placement && (
                              <p className="workspace-subtitle">
                                Placement: {b.placement}
                              </p>
                            )}
                          </div>
                        ))}
                      </section>
                    )}
                  </section>
                  <aside className="space-y-6">
                    {session && (
                      <section className="workspace-card">
                        <h2 className="workspace-section-title">
                          Payment · AUD
                        </h2>
                        <dl className="workspace-facts">
                          <div>
                            <dt>Session estimate</dt>
                            <dd>{money(session.estimateCents)}</dd>
                          </div>
                          <div>
                            <dt>Recorded paid</dt>
                            <dd>{money(session.paidCents)}</dd>
                          </div>
                          <div>
                            <dt>Balance</dt>
                            <dd>{money(session.remainingCents)}</dd>
                          </div>
                        </dl>
                        {client &&
                          session.remainingCents > 0 &&
                          session.status !== "cancelled" && (
                            <Button
                              variant="outline"
                              className="w-full mt-4"
                              onClick={() => setBalance(true)}
                            >
                              Review balance
                            </Button>
                          )}
                        <p className="text-xs text-muted-foreground mt-3">
                          Final pricing follows your agreed design and session
                          terms.
                        </p>
                      </section>
                    )}
                    <Button asChild variant="outline" className="w-full">
                      <Link href={`/chat/${id}`}>
                        <MessageCircle />
                        Message{" "}
                        {client
                          ? data.artist?.name || "your artist"
                          : data.client?.name || "client"}
                      </Link>
                    </Button>
                    {!client && session && (
                      <Button
                        className="w-full"
                        onClick={() =>
                          go(
                            `/calendar?appointment=${session.id}&date=${encodeURIComponent(session.startsAt)}`
                          )
                        }
                      >
                        Manage session
                      </Button>
                    )}
                    {client && (
                      <details className="border-t pt-4">
                        <summary className="min-h-12 cursor-pointer">
                          Want an earlier appointment?
                        </summary>
                        <p className="workspace-subtitle text-sm mb-3">
                          Join your artist’s cancellation waitlist. Your
                          existing booking stays in place.
                        </p>
                        <Button
                          variant="outline"
                          disabled={join.isPending || join.isSuccess}
                          onClick={() => join.mutate({ conversationId: id })}
                        >
                          {join.isSuccess
                            ? "You’re on the waitlist"
                            : "Join waitlist"}
                        </Button>
                        {join.error && <p role="alert">{join.error.message}</p>}
                      </details>
                    )}
                  </aside>
                </div>
              )}
              {tab === "Files" && (
                <section>
                  <h2 className="workspace-section-title">Reference images</h2>
                  {!data.briefs.some(b => b.images.length) && (
                    <p className="workspace-subtitle">
                      No reference images attached yet. Share images in
                      Messages.
                    </p>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {data.briefs
                      .flatMap(b => b.images)
                      .map((url, index) => (
                        <a
                          key={`${url}-${index}`}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <img
                            src={url}
                            loading="lazy"
                            alt={`Design reference ${index + 1}`}
                            className="aspect-square object-cover rounded-xl border border-border"
                          />
                        </a>
                      ))}
                  </div>
                </section>
              )}
              {tab === "Payments" && (
                <section>
                  <h2 className="workspace-section-title">
                    Payment history · AUD
                  </h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Older imported payments may appear in session totals without
                    a linked transaction.
                  </p>
                  {!data.history.length && (
                    <p>No linked transactions recorded.</p>
                  )}
                  {data.history.map(h => (
                    <div className="workspace-menu-row" key={h.id}>
                      <div className="flex-1">
                        <strong className="capitalize">
                          {h.type} · {h.method || "Payment"}
                        </strong>
                        <p className="text-sm text-muted-foreground">
                          {h.createdAt && bookingDate(h.createdAt)}
                        </p>
                      </div>
                      <strong>{money(h.amountCents)}</strong>
                    </div>
                  ))}
                </section>
              )}
            </>
          )}
        </div>
      </main>
      {signing && (
        <SheetShell
          isOpen
          onClose={() => setSigning(false)}
          title="Consent forms"
        >
          <InlineFormSigning
            pendingForms={forms.data || []}
            onSuccess={refresh}
            onClose={() => {
              setSigning(false);
              refresh();
            }}
          />
        </SheetShell>
      )}
      {session && (
        <BalanceCheckoutSheet
          open={balance}
          onClose={() => {
            setBalance(false);
            refresh();
          }}
          appointmentId={session.id}
          balanceDueCents={session.remainingCents}
          artistName={data?.artist?.name || "Your artist"}
          projectName={session.title}
        />
      )}{" "}
      {planId && (
        <SessionPlanCheckoutSheet
          sessionPlanId={planId}
          conversationId={id}
          onClose={() => {
            setPlanId(null);
            refresh();
          }}
        />
      )}
    </PageShell>
  );
}
