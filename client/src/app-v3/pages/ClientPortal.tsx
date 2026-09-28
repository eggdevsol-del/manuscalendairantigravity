import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  MessageCircle,
  CreditCard,
  User,
  Send,
  RefreshCw,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { activateWaitingSWForPublicPage } from "@/lib/pwa";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import { InlineFormSigning } from "@/features/booking/components/InlineFormSigning";
import {
  bookingDate,
  money,
  statusLabel,
} from "@/features/workspace/bookingPresentation";
import { bookingProjectKey } from "@shared/clientBookingGroups";
import {
  orderedProjectGroups,
  nextProjectSitting,
} from "../data/projectProgress";
import { ProjectProgress } from "../components/ProjectProgress";
import { SittingCard } from "../components/SittingCard";
import { DetailsSheet } from "../components/DetailsSheet";
import { SessionPlanCheckoutSheet } from "./Checkout";
import { PaymentRequestPage } from "./PaymentLinks";
import {
  Action,
  Avatar,
  Feedback,
  Panel,
  Row,
  Screen,
  Section,
  Status,
  SummaryCard,
} from "../design/primitives";
import { messageText } from "../data/messagePresentation";
import "./client-portal.css";

export default function ClientPortal() {
  const [token] = useState(
    () =>
      new URLSearchParams(location.hash.slice(1)).get("access") ||
      sessionStorage.getItem("tattoi-portal-access") ||
      ""
  );
  const [active, setActive] = useState("projects");
  const [payment, setPayment] = useState<string | null>(null);
  const [planId, setPlanId] = useState<number | null>(null);
  const [formsOpen, setFormsOpen] = useState(false);
  const [text, setText] = useState("");
  const conversationRef = useRef<HTMLDivElement>(null);
  const latestSeen = useRef<number | undefined>(undefined);
  const api = trpc.useUtils().client;
  useEffect(() => {
    if (token) {
      sessionStorage.setItem("tattoi-portal-access", token);
      history.replaceState(null, "", location.pathname + location.search);
    }
    void activateWaitingSWForPublicPage();
  }, [token]);
  const workspace = useQuery({
    queryKey: ["portal-workspace", token],
    queryFn: () => api.clientPortal.workspace.mutate({ token }),
    enabled: !!token,
    retry: false,
    refetchInterval: 15000,
  });
  const messages = useInfiniteQuery({
    queryKey: ["portal-messages", token],
    initialPageParam: undefined as
      | { id: number; createdAt: string | null }
      | undefined,
    queryFn: ({ pageParam }) =>
      api.clientPortal.messages.mutate({ token, before: pageParam }),
    getNextPageParam: page =>
      page.length === 100
        ? { id: page[0].id, createdAt: page[0].createdAt }
        : undefined,
    enabled: !!workspace.data,
    retry: false,
    refetchInterval: 5000,
  });
  const forms = useQuery({
    queryKey: ["portal-forms", token],
    queryFn: () => api.clientPortal.pendingForms.mutate({ token }),
    enabled: !!workspace.data,
    retry: false,
  });
  const care = useQuery({
    queryKey: ["portal-care", token],
    queryFn: () => api.clientPortal.aftercare.mutate({ token }),
    enabled: !!workspace.data,
    retry: false,
  });
  const offers = useQuery({
    queryKey: ["portal-offers", token],
    queryFn: () => api.clientPortal.offers.mutate({ token }),
    enabled: !!workspace.data,
    retry: false,
  });
  const reply = trpc.clientPortal.reply.useMutation({
    onSuccess: () => {
      setText("");
      void messages.refetch();
    },
  });
  const latestMessageId = messages.data?.pages[0]?.at(-1)?.id;
  useEffect(() => {
    const el = conversationRef.current;
    if (!el || latestMessageId === latestSeen.current) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (latestSeen.current === undefined || nearBottom || reply.isSuccess)
      el.scrollTop = el.scrollHeight;
    latestSeen.current = latestMessageId;
  }, [latestMessageId, reply.isSuccess]);
  const data = workspace.data;
  const next = nextProjectSitting(data?.sessions || []);
  const groups = orderedProjectGroups(data?.sessions || []);
  const pendingPlans = (data?.plans || []).filter(
    p => p.requiresDeposit || p.paymentState
  );
  const refresh = () => {
    void workspace.refetch();
    void messages.refetch();
    void forms.refetch();
  };
  function jump(id: string) {
    setActive(id);
    document.getElementById(`portal-${id}`)?.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
  }
  useEffect(() => {
    if (!data) return;
    const requested = new URLSearchParams(location.search);
    const section = requested.get("section");
    if (
      section &&
      ["projects", "messages", "payments", "profile"].includes(section)
    )
      jump(section);
    const requestedPlan = Number(requested.get("plan"));
    if (requestedPlan && data.plans.some(p => p.id === requestedPlan))
      setPlanId(requestedPlan);
    const requestId = Number(requested.get("payment"));
    const request = data.sessions.find(
      s => s.pendingRequest?.id === requestId
    )?.pendingRequest;
    if (request) setPayment(request.token);
    const saved = sessionStorage.getItem("tattoi-portal-checkout");
    if (requested.has("redirect_status") && saved) {
      try {
        const pending = JSON.parse(saved);
        if (pending.access === token) {
          if (pending.payment) setPayment(pending.payment);
          if (pending.plan) setPlanId(pending.plan);
        }
      } catch {}
    }
    // Apply deep link once when the authenticated workspace first arrives.
  }, [!!data]);
  useEffect(() => {
    if (payment || planId)
      sessionStorage.setItem(
        "tattoi-portal-checkout",
        JSON.stringify({ access: token, payment, plan: planId })
      );
  }, [payment, planId, token]);
  const nav = [
    { id: "projects", label: "My Tattoos", icon: CalendarDays },
    { id: "messages", label: "Messages", icon: MessageCircle },
    { id: "payments", label: "Payments", icon: CreditCard },
    { id: "profile", label: "Profile", icon: User },
  ];
  return (
    <Screen
      publicView
      homeHref={location.pathname}
      title="My Tattoos"
      className="portal-page"
      subtitle={
        data?.artist?.name
          ? `With ${data.artist.name}`
          : "Your private client workspace"
      }
      action={
        <Action
          tone="quiet"
          aria-label="Refresh your tattoo details"
          onClick={refresh}
          disabled={!data}
        >
          <RefreshCw size={20} />
        </Action>
      }
    >
      {!token && (
        <Panel>
          <h2>Open your private link</h2>
          <p>
            Use the link your artist sent you. No download or registration
            required.
          </p>
        </Panel>
      )}
      <Feedback
        loading={workspace.isPending && !!token}
        error={workspace.error}
        onRetry={() => workspace.refetch()}
      />
      {data && (
        <>
          <section
            id="portal-projects"
            className="portal-section"
            aria-label="My Tattoos"
          >
            {next && (
              <Panel tone="next" className="simple-next">
                <div className="simple-between">
                  <span className="simple-eyebrow">Your next sitting</span>
                  <Status>
                    {next.rescheduled
                      ? "Rescheduled"
                      : statusLabel(next.status)}
                  </Status>
                </div>
                <h2>{bookingDate(next.startsAt, next.timeZone)}</h2>
                <p>
                  {next.projectName || next.title} ·{" "}
                  {money(next.remainingCents)} remaining
                </p>
                {data.location && <p className="v3-muted">{data.location}</p>}
                <Action tone="secondary" onClick={() => jump("messages")}>
                  Message your artist
                </Action>
              </Panel>
            )}
            {!!pendingPlans.length && (
              <Section title="Booking proposals">
                {pendingPlans.map(p => (
                  <SummaryCard
                    key={p.id}
                    title={p.projectName || "Booking proposal"}
                    detail={`${money(p.estimateCents)} estimate · ${p.paymentState ? "Check payment status" : `${money(p.depositCents)} deposit before fees`}`}
                    onClick={() => setPlanId(p.id)}
                  />
                ))}
              </Section>
            )}
            {!!forms.data?.length && (
              <Row
                title={`${forms.data.length} forms to complete`}
                detail="Review and sign before your sitting"
                onClick={() => setFormsOpen(true)}
              />
            )}
            <Section title="Your projects">
              {groups.length ? (
                groups.map(sittings => (
                  <Panel
                    key={bookingProjectKey(sittings[0])}
                    className="ivory-project-card"
                  >
                    <h2>
                      {sittings.find(s => s.projectName)?.projectName ||
                        sittings[0].title}
                    </h2>
                    <ProjectProgress sittings={sittings} />
                    <ul className="simple-project-dates">
                      {sittings.map(s => (
                        <li key={s.id} data-next={s.id === next?.id}>
                          <span>{bookingDate(s.startsAt, s.timeZone)}</span>
                          <Status
                            tone={
                              s.status === "completed" ? "success" : "neutral"
                            }
                          >
                            {s.rescheduled
                              ? "Rescheduled"
                              : statusLabel(s.status)}
                          </Status>
                        </li>
                      ))}
                    </ul>
                    <DetailsSheet title="Sittings & details">
                      {sittings.map((s, i) => (
                        <SittingCard
                          key={s.id}
                          title={`Sitting ${s.sessionIndex || i + 1}`}
                          detail={bookingDate(s.startsAt, s.timeZone)}
                        >
                          <p>{statusLabel(s.status)}</p>
                          <dl className="v3-facts">
                            <div>
                              <dt>Estimate</dt>
                              <dd>{money(s.estimateCents)}</dd>
                            </div>
                            <div>
                              <dt>Paid</dt>
                              <dd>{money(s.paidCents)}</dd>
                            </div>
                            <div>
                              <dt>Remaining</dt>
                              <dd>{money(s.remainingCents)}</dd>
                            </div>
                          </dl>
                          {s.pendingRequest && (
                            <Action
                              onClick={() =>
                                setPayment(s.pendingRequest!.token)
                              }
                            >
                              Review payment
                            </Action>
                          )}
                        </SittingCard>
                      ))}
                    </DetailsSheet>
                  </Panel>
                ))
              ) : (
                <Panel>
                  <h2>Your next project starts here</h2>
                  <p>
                    Discuss your idea below. Your artist’s proposal will appear
                    here.
                  </p>
                </Panel>
              )}
            </Section>
          </section>
          <section
            id="portal-messages"
            className="portal-section"
            aria-label="Messages"
          >
            <Section title="Messages">
              <Row
                title={data.artist?.name || "Your artist"}
                icon={
                  <Avatar name={data.artist?.name} src={data.artist?.avatar} />
                }
              />
              <Feedback
                loading={messages.isPending}
                error={messages.error}
                onRetry={() => messages.refetch()}
              />
              <div className="portal-conversation" ref={conversationRef}>
                {messages.hasNextPage && (
                  <Action
                    tone="quiet"
                    disabled={messages.isFetchingNextPage}
                    onClick={() => void messages.fetchNextPage()}
                  >
                    {messages.isFetchingNextPage
                      ? "Loading…"
                      : "Load older messages"}
                  </Action>
                )}
                {messages.data?.pages
                  .slice()
                  .reverse()
                  .flat()
                  .map(m => (
                    <div
                      className={`portal-bubble ${m.mine ? "is-own" : ""}`}
                      key={m.id}
                    >
                      {m.type === "image" && /^https:\/\//.test(m.text) ? (
                        <img
                          src={m.text}
                          alt="Shared tattoo reference"
                          loading="lazy"
                        />
                      ) : m.type === "session_plan" ? (
                        <button type="button" onClick={() => jump("projects")}>
                          Booking proposal · View in My Tattoos
                        </button>
                      ) : (
                        <p>
                          {m.type === "text" ? m.text : messageText(m.text)}
                        </p>
                      )}
                      <small>
                        {m.mine ? "You" : data.artist?.name}
                        {m.createdAt ? ` · ${bookingDate(m.createdAt)}` : ""}
                      </small>
                    </div>
                  ))}
              </div>
              <form
                className="portal-composer"
                onSubmit={e => {
                  e.preventDefault();
                  reply.mutate({ token, text });
                }}
              >
                <textarea
                  aria-label="Message your artist"
                  placeholder="Write a message…"
                  value={text}
                  onChange={e => setText(e.target.value)}
                  maxLength={4000}
                  required
                  rows={2}
                />
                <Action
                  type="submit"
                  aria-label="Send message"
                  disabled={reply.isPending || !text.trim()}
                >
                  <Send size={20} />
                </Action>
              </form>
              {reply.error && <p role="alert">{reply.error.message}</p>}
              {reply.isSuccess && (
                <span className="sr-only" role="status">
                  Message sent
                </span>
              )}
            </Section>
          </section>
          <section
            id="portal-payments"
            className="portal-section"
            aria-label="Payments"
          >
            <Section title="Payments">
              {data.sessions
                .filter(s => s.pendingRequest)
                .map(s => (
                  <SummaryCard
                    key={s.id}
                    title={s.projectName || s.title}
                    detail={`${money(s.pendingRequest!.amountCents)} requested · Sitting ${s.sessionIndex || 1}`}
                    onClick={() => setPayment(s.pendingRequest!.token)}
                  />
                ))}
              {!data.sessions.some(s => s.pendingRequest) && (
                <p className="v3-muted">No outstanding payment requests.</p>
              )}
              <DetailsSheet title="Payment history">
                {data.history.length ? (
                  data.history.map(p => (
                    <Row
                      key={p.id}
                      title={`${statusLabel(p.type)} · ${money(p.amountCents)}`}
                      detail={`${p.createdAt ? bookingDate(p.createdAt) : "Date unavailable"} · ${p.method || "Payment"}`}
                    />
                  ))
                ) : (
                  <p>No payments recorded yet.</p>
                )}
              </DetailsSheet>
            </Section>
          </section>
          <section
            id="portal-profile"
            className="portal-section"
            aria-label="Profile"
          >
            <Section title="Your details">
              <Row
                title={data.client?.name || "Your profile"}
                icon={
                  <Avatar name={data.client?.name} src={data.client?.avatar} />
                }
              />
              <p className="v3-muted">
                Your workspace with {data.artist?.name}. Message your artist if
                your contact details need updating.
              </p>
              <Feedback
                error={forms.error || care.error || offers.error}
                onRetry={() => {
                  void forms.refetch();
                  void care.refetch();
                  void offers.refetch();
                }}
              />
              <DetailsSheet title="Forms">
                {data.forms.map(f => (
                  <Row
                    key={f.id}
                    title={f.title || "Booking form"}
                    detail={statusLabel(f.status || "pending")}
                    onClick={
                      f.status === "pending"
                        ? () => setFormsOpen(true)
                        : undefined
                    }
                  />
                ))}
                {!data.forms.length && <p>No forms required yet.</p>}
              </DetailsSheet>
              <DetailsSheet title="Aftercare">
                {care.data?.phases?.length ? (
                  care.data.phases.map(p => (
                    <Panel key={p.id}>
                      <h3>{p.label}</h3>
                      <small>
                        Days {p.fromDay}–{p.toDay}
                      </small>
                      <p style={{ whiteSpace: "pre-wrap" }}>{p.instruction}</p>
                    </Panel>
                  ))
                ) : (
                  <p>
                    Your artist has not added aftercare guidance yet. Ask them
                    for instructions for your tattoo.
                  </p>
                )}
              </DetailsSheet>
              <DetailsSheet title="Your offers">
                {offers.data?.length ? (
                  offers.data.map(o => (
                    <Panel key={o.id}>
                      <h3>{o.name}</h3>
                      <p>
                        {o.valueType === "percentage"
                          ? `${o.value}%`
                          : money(o.remainingValue)}{" "}
                        · {o.code}
                      </p>
                      <Action
                        tone="secondary"
                        onClick={() => {
                          setText(
                            `I'd like to use my ${o.name} offer (${o.code}) for my tattoo.`
                          );
                          jump("messages");
                        }}
                      >
                        Discuss this offer
                      </Action>
                    </Panel>
                  ))
                ) : (
                  <p>No current offers from your artist.</p>
                )}
              </DetailsSheet>
            </Section>
          </section>
          <p className="v3-muted portal-privacy">
            Private link · Do not forward. Your access expires after 24 hours.
          </p>
          <div className="simple-nav-fade" aria-hidden="true" />
          <nav
            className="v3-navigation v3-navigation-client"
            aria-label="Client page sections"
          >
            <div className="v3-navigation-items">
              {nav.map(n => (
                <button
                  key={n.id}
                  className={`v3-navigation-item ${active === n.id ? "active" : ""}`}
                  aria-current={active === n.id ? "location" : undefined}
                  onClick={() => jump(n.id)}
                >
                  <span className="v3-navigation-icon">
                    <n.icon size={23} />
                  </span>
                  <span>{n.label}</span>
                </button>
              ))}
            </div>
          </nav>
        </>
      )}
      {payment && (
        <SheetShell
          isOpen
          title="Review your payment"
          onClose={() => {
            setPayment(null);
            sessionStorage.removeItem("tattoi-portal-checkout");
            history.replaceState(null, "", location.pathname);
            refresh();
          }}
        >
          <PaymentRequestPage
            paymentToken={payment}
            embedded
            onDone={() => {
              setPayment(null);
              sessionStorage.removeItem("tattoi-portal-checkout");
              history.replaceState(null, "", location.pathname);
              refresh();
            }}
          />
        </SheetShell>
      )}
      {planId && (
        <SessionPlanCheckoutSheet
          portalToken={token}
          sessionPlanId={planId}
          conversationId={0}
          onClose={() => {
            setPlanId(null);
            sessionStorage.removeItem("tattoi-portal-checkout");
            history.replaceState(null, "", location.pathname);
            refresh();
          }}
        />
      )}
      <SheetShell
        isOpen={formsOpen}
        title="Your booking forms"
        onClose={() => setFormsOpen(false)}
      >
        <Feedback
          loading={forms.isPending}
          error={forms.error}
          onRetry={() => forms.refetch()}
        />
        {forms.data && (
          <InlineFormSigning
            portalToken={token}
            pendingForms={forms.data}
            onSuccess={refresh}
            onClose={() => setFormsOpen(false)}
          />
        )}
      </SheetShell>
    </Screen>
  );
}
