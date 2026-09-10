import { useState } from "react";
import { useRoute, useSearch, useLocation } from "wouter";
import {
  CheckCircle2,
  Circle,
  CalendarDays,
  MapPin,
  MessageCircle,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import { InlineFormSigning } from "@/features/booking/components/InlineFormSigning";
import { SessionPlanCheckoutSheet } from "./Checkout";
import { BalanceCheckoutSheet } from "./Checkout";
import {
  bookingDate,
  money,
  instant,
  statusLabel,
} from "@/features/workspace/bookingPresentation";
import {
  Action,
  ActionLink,
  Feedback,
  Panel,
  Row,
  Screen,
  Section,
  Status,
  Tabs,
} from "../design/primitives";
import { Thread } from "./Thread";
import { SessionActions } from "./SessionActions";

export default function Booking() {
  const [, params] = useRoute("/projects/:id");
  const id = Number(params?.id);
  const search = useSearch();
  const [, go] = useLocation();
  const qs = new URLSearchParams(search);
  const selectedId = Number(qs.get("session")) || null;
  const active = qs.get("view");
  const tab =
    active === "Messages" || active === "Files" || active === "Payments"
      ? active
      : "Overview";
  const { user } = useAuth();
  const client = user?.role === "client";
  const query = trpc.projects.summary.useQuery(
    { conversationId: id },
    { enabled: id > 0 }
  );
  const data = query.data;
  const session =
    data?.sessions.find(s => s.id === selectedId) ||
    data?.sessions.find(
      s =>
        !["cancelled", "completed", "no-show"].includes(s.status) &&
        instant(s.endsAt) > new Date()
    ) ||
    data?.sessions.at(-1);
  const [sign, setSign] = useState(false),
    [balance, setBalance] = useState(false);
  const [plan, setPlan] = useState<number | null>(null);
  const forms = trpc.forms.getPendingForms.useQuery(
    { appointmentId: session?.id },
    { enabled: client && !!session }
  );
  const pending = data?.plans.filter(p => p.status === "pending") || [];
  const refresh = () => {
    void query.refetch();
    if (client) void forms.refetch();
  };
  const navigate = (view: string, sessionId = session?.id) => {
    const q = new URLSearchParams();
    if (sessionId) q.set("session", String(sessionId));
    if (view !== "Overview") q.set("view", view);
    go(`/projects/${id}?${q}`);
  };
  const subtitle = [
    client ? data?.artist?.name : data?.client?.name,
    session && data
      ? `Session ${session.sessionIndex || data.sessions.findIndex(s => s.id === session.id) + 1} of ${session.sessionTotal || data.sessions.length}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Screen
      title={session?.title || "Your booking"}
      subtitle={subtitle}
      back={client ? "/bookings" : "/calendar"}
    >
      <Feedback
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
      />
      {!(id > 0) && (
        <Feedback empty="This booking link is invalid. Open your bookings to choose a session." />
      )}
      {data && (
        <>
          <Tabs
            items={["Overview", "Messages", "Files", "Payments"] as const}
            value={tab}
            onChange={t => navigate(t)}
            label="Booking sections"
          />
          {data.sessions.length > 1 && (
            <div className="v3-form">
              <label>
                Session
                <select
                  value={session?.id}
                  onChange={e => navigate(tab, Number(e.target.value))}
                >
                  {data.sessions.map((s, i) => (
                    <option key={s.id} value={s.id}>
                      Session {i + 1} · {bookingDate(s.startsAt, s.timeZone)} ·{" "}
                      {statusLabel(s.status)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {tab === "Messages" && <Thread id={id} />}
          {tab === "Overview" && (
            <div className="v3-grid">
              <div className="v3-stack">
                {client &&
                  pending.map(p => (
                    <Panel tone="attention" key={p.id}>
                      <h2>Confirm your appointment</h2>
                      <p>
                        Review the dates, terms and deposit to secure your
                        booking.
                      </p>
                      <Action onClick={() => setPlan(p.id)}>
                        Review {money(p.depositCents)} deposit
                      </Action>
                    </Panel>
                  ))}
                {session ? (
                  <>
                    <div>
                      <Status
                        tone={
                          session.status === "confirmed" ||
                          session.status === "completed"
                            ? "success"
                            : session.status === "cancelled"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {statusLabel(session.status)}
                      </Status>
                    </div>
                    <Row
                      title={bookingDate(session.startsAt, session.timeZone)}
                      detail={`Times in ${session.timeZone.replaceAll("_", " ")}`}
                      icon={<CalendarDays />}
                    />
                    {data.location && (
                      <Row title={data.location} icon={<MapPin />} />
                    )}
                    <Section title="Ready for the session">
                      <Row
                        title={
                          session.paidCents > 0
                            ? "Payment received"
                            : "Payment outstanding"
                        }
                        detail={money(session.paidCents)}
                        icon={
                          session.paidCents > 0 ? <CheckCircle2 /> : <Circle />
                        }
                        onClick={() => navigate("Payments")}
                      />
                      {data.forms
                        .filter(f => f.appointmentId === session.id)
                        .map(f => (
                          <Row
                            key={f.id}
                            title={f.title}
                            detail={statusLabel(f.status)}
                            icon={
                              f.status === "signed" ? (
                                <CheckCircle2 />
                              ) : (
                                <Circle />
                              )
                            }
                            onClick={
                              client && f.status !== "signed"
                                ? () => setSign(true)
                                : undefined
                            }
                          />
                        ))}
                      {!data.forms.some(
                        f => f.appointmentId === session.id
                      ) && (
                        <p className="v3-muted">
                          No forms attached to this session.
                        </p>
                      )}
                      {client && !!forms.data?.length && (
                        <Action onClick={() => setSign(true)}>
                          Complete your consent forms
                        </Action>
                      )}
                      <Feedback
                        error={client ? forms.error : undefined}
                        onRetry={() => forms.refetch()}
                      />
                    </Section>
                  </>
                ) : (
                  <Panel>
                    <h2>Your request is with your artist</h2>
                    <p>
                      Your proposal and appointment details will appear here
                      when ready.
                    </p>
                  </Panel>
                )}
                {data.briefs.length > 0 && (
                  <Section title="Design notes">
                    {data.briefs.map(b => (
                      <div key={b.id} className="v3-stack">
                        <p style={{ whiteSpace: "pre-wrap" }}>
                          {b.description || "Discuss your design in Messages."}
                        </p>
                        {b.placement && (
                          <p className="v3-muted">Placement: {b.placement}</p>
                        )}
                      </div>
                    ))}
                  </Section>
                )}
                {session?.status === "completed" && (
                  <Aftercare appointmentId={session.id} />
                )}
              </div>
              <aside className="v3-stack">
                {session && (
                  <Section title="Payment · AUD">
                    <dl className="v3-facts">
                      <div>
                        <dt>Session estimate</dt>
                        <dd>{money(session.estimateCents)}</dd>
                      </div>
                      <div>
                        <dt>Recorded paid</dt>
                        <dd>{money(session.paidCents)}</dd>
                      </div>
                      <div>
                        <dt>Balance due</dt>
                        <dd>{money(session.remainingCents)}</dd>
                      </div>
                    </dl>
                    {client &&
                      session.remainingCents > 0 &&
                      !["cancelled", "no-show"].includes(session.status) && (
                        <Action onClick={() => setBalance(true)}>
                          Review balance
                        </Action>
                      )}
                  </Section>
                )}
                <ActionLink
                  href={`/projects/${id}?${session ? `session=${session.id}&` : ""}view=Messages`}
                >
                  <MessageCircle />
                  Message{" "}
                  {client
                    ? data.artist?.name || "your artist"
                    : data.client?.name || "client"}
                </ActionLink>
                {!client && session && (
                  <SessionActions session={session} onChange={refresh} />
                )}{" "}
                {client && <EarlierAppointment conversationId={id} />}
              </aside>
            </div>
          )}
          {tab === "Files" && (
            <Section title="Reference images">
              {!data.briefs.some(b => b.images.length) && (
                <Feedback empty="No references attached yet. Add photos in Messages." />
              )}
              <div className="v3-file-grid">
                {data.briefs
                  .flatMap(b => b.images)
                  .map((url, i) => (
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      key={`${url}-${i}`}
                    >
                      <img
                        src={url}
                        alt={`Design reference ${i + 1}`}
                        loading="lazy"
                      />
                    </a>
                  ))}
              </div>
              <ActionLink href={`/projects/${id}?view=Messages`} tone="quiet">
                Share photos in Messages
              </ActionLink>
            </Section>
          )}
          {tab === "Payments" && (
            <Section title="Payment history · AUD">
              <p className="v3-muted">
                Session totals can include imported payments without a linked
                transaction.
              </p>
              {!data.history.length && (
                <Feedback empty="No linked transactions recorded." />
              )}
              {data.history.map(h => (
                <Row
                  key={h.id}
                  title={`${statusLabel(h.type)} · ${h.method || "Payment"}`}
                  detail={h.createdAt && bookingDate(h.createdAt)}
                  trailing={<strong>{money(h.amountCents)}</strong>}
                />
              ))}
            </Section>
          )}
        </>
      )}
      <SheetShell
        isOpen={sign}
        onClose={() => setSign(false)}
        title="Consent forms"
      >
        {sign && (
          <InlineFormSigning
            pendingForms={forms.data || []}
            onSuccess={refresh}
            onClose={() => {
              setSign(false);
              refresh();
            }}
          />
        )}
      </SheetShell>
      {plan && (
        <SessionPlanCheckoutSheet
          sessionPlanId={plan}
          conversationId={id}
          onClose={() => {
            setPlan(null);
            refresh();
          }}
        />
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
      )}
    </Screen>
  );
}
function EarlierAppointment({ conversationId }: { conversationId: number }) {
  const join = trpc.waitlist.join.useMutation();
  return (
    <details className="v3-divider">
      <summary className="v3-row">Want an earlier appointment?</summary>
      <p className="v3-muted">
        Join your artist’s cancellation waitlist. Your existing booking stays in
        place.
      </p>
      <Action
        tone="secondary"
        disabled={join.isPending || join.isSuccess}
        onClick={() => join.mutate({ conversationId })}
      >
        {join.isSuccess ? "You’re on the waitlist" : "Join waitlist"}
      </Action>
      {join.error && <p role="alert">{join.error.message}</p>}
    </details>
  );
}
function Aftercare({ appointmentId }: { appointmentId: number }) {
  const query = trpc.aftercare.getForBooking.useQuery({ appointmentId });
  if (!query.data?.template)
    return <Feedback error={query.error} onRetry={() => query.refetch()} />;
  return (
    <Section title="Your aftercare">
      <Panel>
        <h3>{query.data.template.name}</h3>
        {query.data.template.phases?.map((phase: any) => (
          <Row
            key={phase.id}
            title={phase.label}
            detail={phase.instruction}
            icon={<span className="v3-step-number">{phase.fromDay}</span>}
          />
        ))}
      </Panel>
    </Section>
  );
}
