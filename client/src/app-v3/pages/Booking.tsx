import { ProjectProgress } from "../components/ProjectProgress";
import {
  ProjectSittings,
  ProjectDisclosure,
} from "../components/ProjectSittings";
import { orderedProjectGroups } from "../data/projectProgress";
import { SittingCard } from "../components/SittingCard";
import { projectKey, projectSessions } from "../data/projectSessions";
import { useState, useEffect, useRef } from "react";
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
import { isConversationClient } from "@/features/chat/conversationRole";
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
} from "../design/primitives";
import { Thread } from "./Thread";
import { SessionActions } from "./SessionActions";

export default function Booking() {
  const [, params] = useRoute("/projects/:id");
  const id = Number(params?.id);
  const search = useSearch();
  const { user } = useAuth();
  const query = trpc.projects.summary.useQuery(
    { conversationId: id },
    { enabled: id > 0 }
  );
  const selectedId = Number(new URLSearchParams(search).get("session"));
  const groups = orderedProjectGroups(query.data?.sessions || []);
  const arrived = useRef<number | null>(null);
  const keys = groups.map(g => projectKey(g[0]));
  for (const plan of query.data?.plans || []) {
    if (
      (plan.paymentState ||
        (plan.requiresDeposit ?? plan.status === "pending")) &&
      !keys.includes(`plan:${plan.id}`)
    )
      keys.push(`plan:${plan.id}`);
  }
  if (query.data && !keys.length) keys.push("request");
  const selected = query.data?.sessions.find(s => s.id === selectedId);
  const requestedProject = new URLSearchParams(search).get("project");
  const focusedKey = selected
    ? projectKey(selected)
    : requestedProject && keys.includes(requestedProject)
      ? requestedProject
      : keys[0];
  useEffect(() => {
    if (!query.data || arrived.current === id) return;
    arrived.current = id;
    if (selectedId || requestedProject)
      document
        .getElementById(`project-${focusedKey}`)
        ?.scrollIntoView({ block: "start" });
  }, [query.data, selectedId, focusedKey, requestedProject, id]);
  return (
    <Screen
      title="Tattoo projects"
      subtitle={
        user?.role === "client"
          ? query.data?.artist?.name
          : query.data?.client?.name
      }
      back={user?.role === "client" ? "/bookings" : "/conversations"}
      wide
    >
      <Feedback
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
      />
      {!(id > 0) && (
        <Feedback empty="This booking link is invalid. Open your bookings to choose a session." />
      )}
      {query.data && selectedId > 0 && !selected && (
        <Feedback empty="This sitting is no longer available. Your other projects are below." />
      )}
      <div className="ivory-project-list">
        {keys.map(key => (
          <section id={`project-${key}`} key={`${id}:${key}`}>
            <BookingProject projectId={key} focused={key === focusedKey} />
          </section>
        ))}
      </div>
    </Screen>
  );
}

function BookingProject({
  projectId,
  focused,
}: {
  projectId: string;
  focused: boolean;
}) {
  const [, params] = useRoute("/projects/:id");
  const id = Number(params?.id);
  const search = useSearch();
  const [, go] = useLocation();
  const qs = new URLSearchParams(search);
  const selectedId = focused ? Number(qs.get("session")) || null : null;
  const active = focused ? qs.get("view") : null;
  const tab =
    active === "Messages" || active === "Files" || active === "Payments"
      ? active
      : "Overview";
  const { user } = useAuth();
  const query = trpc.projects.summary.useQuery(
    { conversationId: id },
    { enabled: id > 0 }
  );
  const data = query.data && {
    ...query.data,
    sessions: query.data.sessions.filter(s => projectKey(s) === projectId),
    plans: query.data.plans.filter(p => `plan:${p.id}` === projectId),
  };
  const client = isConversationClient(user, data?.client?.id);
  const session = selectedId
    ? data?.sessions.find(s => s.id === selectedId)
    : data?.sessions.find(
        s =>
          !["cancelled", "completed", "no-show"].includes(s.status) &&
          instant(s.endsAt) > new Date()
      ) || data?.sessions.at(-1);
  const [collapsedSitting, setCollapsedSitting] = useState<number | null>(null);
  const [namingFailed, setNamingFailed] = useState(false);
  const [namingRetry, setNamingRetry] = useState(0);
  const [requestDraft, setRequestDraft] = useState("");
  const namingAttempts = useRef(new Set<number>());
  const nameProject = trpc.projects.nameProject.useMutation({
    onSuccess: () => query.refetch(),
  });
  useEffect(() => {
    let stopped = false;
    void (async () => {
      const unnamed = [
        ...new Set(
          (data?.sessions || [])
            .filter(s => !s.projectName && s.sessionPlanId)
            .map(s => s.sessionPlanId!)
        ),
      ];
      for (const sessionPlanId of unnamed) {
        if (stopped) return;
        if (namingAttempts.current.has(sessionPlanId)) continue;
        namingAttempts.current.add(sessionPlanId);
        try {
          await nameProject.mutateAsync({ conversationId: id, sessionPlanId });
        } catch {
          setNamingFailed(true);
        }
      }
    })();
    return () => {
      stopped = true;
    };
  }, [id, data?.sessions, namingRetry]);
  const [sign, setSign] = useState(false),
    [balance, setBalance] = useState(false);
  const [plan, setPlan] = useState<number | null>(null);
  const forms = trpc.forms.getPendingForms.useQuery(
    { appointmentId: session?.id },
    { enabled: client && focused && !!session }
  );
  const formAction = useRef("");
  useEffect(() => {
    const key = `${id}:${session?.id}`;
    if (
      focused &&
      qs.get("action") === "forms" &&
      forms.data?.length &&
      formAction.current !== key
    ) {
      formAction.current = key;
      setSign(true);
    }
  }, [search, id, session?.id, forms.data, focused]);
  const siblings = projectSessions(data?.sessions || [], session);
  // A returning client's new proposal must remain reachable before sessions exist.
  const pending =
    data?.plans.filter(
      p =>
        (!session || p.id === session.sessionPlanId) &&
        (p.paymentState || (p.requiresDeposit ?? p.status === "pending"))
    ) || [];
  const selectedKey = projectId === "request" ? null : projectId;
  const briefs = (data?.briefs || []).filter(
    b => !selectedKey || b.projectKeys?.includes(selectedKey)
  );
  const unassignedBriefs = (data?.briefs || []).filter(
    b => !b.projectKeys?.length
  );
  const unassignedHistory = (data?.history || []).filter(
    h => !h.projectKeys?.length
  );
  const history = (data?.history || []).filter(
    h => !selectedKey || h.projectKeys?.includes(selectedKey)
  );
  const [filesOpen, setFilesOpen] = useState(tab === "Files");
  const [paymentsOpen, setPaymentsOpen] = useState(tab === "Payments");
  useEffect(() => {
    if (tab === "Files") setFilesOpen(true);
    if (tab === "Payments") setPaymentsOpen(true);
  }, [tab]);
  const refresh = () => {
    void query.refetch();
    if (client) void forms.refetch();
  };
  const navigate = (view: string, sessionId = session?.id) => {
    const q = new URLSearchParams();
    q.set("project", projectId);
    if (sessionId) q.set("session", String(sessionId));
    if (view !== "Overview") q.set("view", view);
    go(`/projects/${id}?${q}`);
  };
  const overview = data && (
    <div className="v3-grid">
      <div className="v3-stack">
        {client &&
          pending.map(p => (
            <Panel tone="attention" key={p.id}>
              <h2>{p.projectName || "Review your booking proposal"}</h2>
              <p>
                {p.paymentState
                  ? "Your payment is being checked. Do not pay again while we confirm the booking."
                  : "Review the dates, terms and deposit to secure your booking."}
              </p>
              <Action onClick={() => setPlan(p.id)}>
                {p.paymentState ? (
                  "Check payment confirmation"
                ) : (
                  <>Review {money(p.depositCents)} deposit</>
                )}
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
            {data.location && <Row title={data.location} icon={<MapPin />} />}
            <Section title="Ready for the session">
              <Row
                title={
                  session.paidCents > 0
                    ? "Payment received"
                    : "Payment outstanding"
                }
                detail={money(session.paidCents)}
                icon={session.paidCents > 0 ? <CheckCircle2 /> : <Circle />}
                onClick={() => navigate("Payments")}
              />
              {data.forms
                .filter(f => f.appointmentId === session.id)
                .map(f => (
                  <Row
                    key={f.id}
                    title={f.title}
                    detail={statusLabel(f.status)}
                    icon={f.status === "signed" ? <CheckCircle2 /> : <Circle />}
                    onClick={
                      client && f.status !== "signed"
                        ? () => setSign(true)
                        : undefined
                    }
                  />
                ))}
              {!data.forms.some(f => f.appointmentId === session.id) && (
                <p className="v3-muted">No forms attached to this session.</p>
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
              Your proposal and appointment details will appear here when ready.
            </p>
          </Panel>
        )}
        {briefs.length > 0 && (
          <Section title="Project design notes">
            <p className="v3-muted">
              These references are linked to this tattoo project.
            </p>
            {briefs.map(b => (
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
            {client && session.pendingRequest && (
              <ActionLink
                tone="primary"
                href={`/pay/${session.pendingRequest.token}`}
              >
                Review {money(session.pendingRequest.amountCents)} request
              </ActionLink>
            )}
            {client &&
              !session.pendingRequest &&
              session.remainingCents > 0 &&
              !["cancelled", "no-show"].includes(session.status) && (
                <Action onClick={() => setBalance(true)}>Review balance</Action>
              )}
          </Section>
        )}
        <ActionLink
          href={`/projects/${id}?project=${encodeURIComponent(projectId)}&${session ? `session=${session.id}&` : ""}view=Messages`}
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
        {client &&
          session &&
          !["cancelled", "completed", "no-show"].includes(session.status) && (
            <Section title="Change this sitting">
              <p className="v3-muted">
                Send a request to your artist. Your appointment stays booked
                until they confirm a change. Their cancellation policy applies.
              </p>
              {["Request a date change", "Request cancellation"].map(label => (
                <Action
                  key={label}
                  tone="secondary"
                  onClick={() => {
                    setRequestDraft(
                      `${label} for ${session.projectName || "my tattoo project"}, sitting ${session.sessionIndex || 1} on ${bookingDate(session.startsAt, session.timeZone)}. `
                    );
                    navigate("Messages");
                  }}
                >
                  {label}
                </Action>
              ))}
            </Section>
          )}
        {client && <EarlierAppointment conversationId={id} />}
      </aside>
    </div>
  );
  const projectForms =
    data?.forms.filter(
      f =>
        siblings.some(
          s =>
            s.id === f.appointmentId &&
            !["cancelled", "no-show", "completed"].includes(s.status)
        ) && f.status !== "signed"
    ) || [];
  return (
    <Panel className="ivory-project-card">
      {data && (
        <>
          <div className="ivory-project-heading">
            <h2>
              {session?.projectName ||
                data.plans[0]?.projectName ||
                "Tattoo project"}
            </h2>
            <p className="v3-muted">
              {client ? data.artist?.name : data.client?.name}
            </p>
            {!!siblings.length && <ProjectProgress sittings={siblings} />}
            <div className="ivory-project-actions">
              {client &&
                siblings
                  .filter(s => s.pendingRequest)
                  .map(s => (
                    <ActionLink
                      key={s.id}
                      href={`/pay/${s.pendingRequest!.token}`}
                      tone="primary"
                    >
                      Sitting {s.sessionIndex || siblings.indexOf(s) + 1}:
                      review {money(s.pendingRequest!.amountCents)} request
                    </ActionLink>
                  ))}
              {client && projectForms.length > 0 && (
                <ActionLink
                  href={`/projects/${id}?session=${projectForms[0].appointmentId}&action=forms`}
                  tone="secondary"
                >
                  Complete consent forms · {projectForms.length}
                </ActionLink>
              )}
            </div>
          </div>
          {namingFailed && (
            <Panel>
              <p>
                We couldn’t name every project. Your bookings are still
                available.
              </p>
              <Action
                tone="secondary"
                onClick={() => {
                  namingAttempts.current.clear();
                  setNamingFailed(false);
                  setNamingRetry(n => n + 1);
                }}
              >
                Retry project names
              </Action>
            </Panel>
          )}
          <ProjectDisclosure
            sittings={siblings}
            reveal={
              !!selectedId ||
              tab !== "Overview" ||
              (focused && qs.get("action") === "forms")
            }
          >
            {siblings.length > 0 && (
              <ProjectSittings
                sittings={siblings}
                selectedId={selectedId}
                render={(s, i) => (
                  <SittingCard
                    title={`Sitting ${s.sessionIndex || i + 1} · ${statusLabel(s.status)}${s.rescheduled ? " · Rescheduled" : ""}`}
                    detail={bookingDate(s.startsAt, s.timeZone)}
                    expanded={
                      tab === "Overview" &&
                      !!selectedId &&
                      s.id === session?.id &&
                      collapsedSitting !== s.id
                    }
                    onExpandedChange={open => {
                      setCollapsedSitting(open ? null : s.id);
                      if (open) navigate("Overview", s.id);
                    }}
                  >
                    {s.id === session?.id && overview}
                  </SittingCard>
                )}
              />
            )}
            <Action tone="quiet" onClick={() => navigate("Messages")}>
              Message{" "}
              {client
                ? data.artist?.name || "your artist"
                : data.client?.name || "client"}
            </Action>
            <SheetShell
              isOpen={tab === "Messages"}
              onClose={() => navigate("Overview")}
              title="Project messages"
            >
              {tab === "Messages" && (
                <Thread id={id} initialDraft={requestDraft} />
              )}
            </SheetShell>
            {tab === "Overview" && siblings.length === 0 && overview}
            <details
              open={filesOpen}
              onToggle={event => setFilesOpen(event.currentTarget.open)}
              className="ivory-project-resource"
            >
              <summary className="v3-row">Design & references</summary>
              <Section title="Project reference images">
                {briefs.map(b => (
                  <div key={b.id}>
                    <p style={{ whiteSpace: "pre-wrap" }}>{b.description}</p>
                    {b.placement && (
                      <p className="v3-muted">Placement: {b.placement}</p>
                    )}
                  </div>
                ))}
                {!briefs.some(b => b.images.length) && (
                  <Feedback empty="No references are linked to this project yet. Older, unassigned references remain available in Messages." />
                )}
                <div className="v3-file-grid">
                  {briefs
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
                {!!unassignedBriefs.length && selectedKey && (
                  <details>
                    <summary className="v3-row">
                      Older conversation references · unassigned
                    </summary>
                    <p className="v3-muted">
                      These references have no verified project link and may
                      concern a different tattoo.
                    </p>
                    {unassignedBriefs.map(b => (
                      <div key={b.id}>
                        <p>{b.description}</p>
                        <div className="v3-file-grid">
                          {b.images.map((url, i) => (
                            <a
                              key={`${url}-${i}`}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <img
                                src={url}
                                alt={`Unassigned reference ${i + 1}`}
                                loading="lazy"
                              />
                            </a>
                          ))}
                        </div>
                      </div>
                    ))}
                  </details>
                )}
                <ActionLink
                  href={`/projects/${id}?project=${encodeURIComponent(projectId)}&${session ? `session=${session.id}&` : ""}view=Messages`}
                  tone="quiet"
                >
                  Share photos in Messages
                </ActionLink>
              </Section>
            </details>
            <details
              open={paymentsOpen}
              onToggle={event => setPaymentsOpen(event.currentTarget.open)}
              className="ivory-project-resource"
            >
              <summary className="v3-row">Payments</summary>
              <Section title="Project payment history · AUD">
                <p className="v3-muted">
                  Session totals can include imported payments without a linked
                  transaction.
                </p>
                {!history.length && (
                  <Feedback empty="No linked transactions recorded." />
                )}
                {!!unassignedHistory.length && selectedKey && (
                  <details>
                    <summary className="v3-row">
                      Other conversation transactions · unassigned
                    </summary>
                    <p className="v3-muted">
                      These transactions have no verified project link. They are
                      not included as this project’s payments.
                    </p>
                    {unassignedHistory.map(h => (
                      <Row
                        key={h.id}
                        title={statusLabel(h.type)}
                        detail={h.createdAt && bookingDate(h.createdAt)}
                        trailing={<strong>{money(h.amountCents)}</strong>}
                      />
                    ))}
                  </details>
                )}
                {history.map(h => (
                  <Row
                    key={h.id}
                    title={`${statusLabel(h.type)} · ${h.method || "Payment"}`}
                    detail={h.createdAt && bookingDate(h.createdAt)}
                    trailing={<strong>{money(h.amountCents)}</strong>}
                  />
                ))}
              </Section>
            </details>
          </ProjectDisclosure>
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
          projectName={session.projectName || "Tattoo project"}
        />
      )}
    </Panel>
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
