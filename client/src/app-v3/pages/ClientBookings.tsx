import { SittingCard } from "../components/SittingCard";
import { SittingSummary } from "../components/SittingSummary";
import { ProposedSittingCard } from "../components/ProposedSittingCard";
import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { bookingProjectKey } from "../../../../shared/clientBookingGroups";
import {
  bookingDate,
  money,
  statusLabel,
  instant,
} from "@/features/workspace/bookingPresentation";
import { SessionPlanCheckoutSheet } from "./Checkout";
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

export default function ClientBookings() {
  const [tab, setTab] = useState<"Upcoming" | "Past">("Upcoming");
  const bookings = trpc.appointments.getClientBookings.useQuery({
    tab: tab === "Upcoming" ? "upcoming" : "past",
  });
  const plans = trpc.sessionPlans.getByClient.useQuery();
  const [plan, setPlan] = useState<{
    id: number;
    conversationId: number;
  } | null>(null);
  const pending =
    tab === "Upcoming"
      ? (plans.data || []).filter(
          p => p.paymentState || (p.requiresDeposit ?? p.status === "pending")
        )
      : [];
  const appointments = bookings.data?.appointments || [];
  const attemptedNames = useRef(new Set<number>());
  const [nameError, setNameError] = useState(false);
  const [nameRetry, setNameRetry] = useState(0);
  const nameProject = trpc.projects.nameProject.useMutation();
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      for (const a of bookings.data?.appointments || []) {
        if (cancelled) return;
        if (
          a.projectName ||
          !a.sessionPlanId ||
          !a.conversationId ||
          attemptedNames.current.has(a.sessionPlanId)
        )
          continue;
        attemptedNames.current.add(a.sessionPlanId);
        try {
          await nameProject.mutateAsync({
            conversationId: a.conversationId,
            sessionPlanId: a.sessionPlanId,
          });
          if (!cancelled) await bookings.refetch();
        } catch {
          if (!cancelled) setNameError(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookings.data, nameRetry]);
  const groups = [...new Set(appointments.map(bookingProjectKey))].map(key =>
    appointments.filter(a => bookingProjectKey(a) === key)
  );
  const requests =
    tab === "Upcoming" ? bookings.data?.pendingRequests || [] : [];
  const consults =
    tab === "Upcoming" ? bookings.data?.pendingConsults || [] : [];
  return (
    <Screen
      title="Bookings"
      subtitle="Your tattoos, sittings and next steps"
      subheader={
        <Tabs
          items={["Upcoming", "Past"] as const}
          value={tab}
          onChange={setTab}
          label="Your bookings"
        />
      }
      wide
    >
      <Feedback
        loading={bookings.isLoading || (tab === "Upcoming" && plans.isLoading)}
        error={bookings.error || (tab === "Upcoming" ? plans.error : undefined)}
        onRetry={() => {
          void bookings.refetch();
          void plans.refetch();
        }}
      />
      {nameError && (
        <Panel>
          <p>
            Some project names couldn’t be loaded. Your sitting dates are still
            available.
          </p>
          <Action
            tone="secondary"
            onClick={() => {
              attemptedNames.current.clear();
              setNameError(false);
              setNameRetry(n => n + 1);
            }}
          >
            Retry project names
          </Action>
        </Panel>
      )}
      {pending.map(p => (
        <Panel key={p.id} tone="attention">
          <h2>{p.projectName || "Booking proposal"}</h2>
          <p>
            {p.artist?.name || "Your artist"} · {p.items.length} sittings
          </p>
          <p>
            {p.paymentState
              ? "We’re checking the payment status. Don’t submit another payment."
              : "Review your proposed dates and deposit before confirming."}
          </p>
          <div className="v3-sitting-list">
            {p.items.map(i => (
              <ProposedSittingCard key={i.id} item={i} />
            ))}
          </div>
          <Action
            onClick={() =>
              setPlan({ id: p.id, conversationId: p.conversationId || 0 })
            }
          >
            {p.paymentState
              ? "Check payment status"
              : `Review ${money(p.depositTotalCents + (p.platformFeeCents || 0))} deposit & fee`}
          </Action>
        </Panel>
      ))}
      <div className="v3-booking-cards">
        {groups.map(sittings => {
          const first = sittings[0];
          const next =
            sittings.find(
              a =>
                !["completed", "cancelled", "no-show"].includes(a.status) &&
                instant(a.endsAt) > new Date()
            ) ||
            sittings.find(
              a => !["completed", "cancelled", "no-show"].includes(a.status)
            ) ||
            sittings.find(
              a => a.status === "completed" && a.balanceDueCents > 0
            ) ||
            first;
          const requested = sittings.find(a => a.paymentRequest);
          const forms = sittings.find(
            a =>
              a.pendingFormCount > 0 &&
              !["completed", "cancelled", "no-show"].includes(a.status)
          );
          const formCount = sittings.reduce(
            (sum, a) => sum + (a.pendingFormCount || 0),
            0
          );
          const destination = (a: typeof first) =>
            `/projects/${a.conversationId}?session=${a.id}`;
          return (
            <Panel key={bookingProjectKey(first)}>
              <div className="v3-stack">
                <div>
                  <h2>
                    {sittings.find(a => a.projectName)?.projectName ||
                      first.serviceName ||
                      "Tattoo project"}
                  </h2>
                  <p>
                    {first.artist.name} · {sittings.length}{" "}
                    {sittings.length === 1 ? "sitting" : "sittings"}
                  </p>
                </div>
                {tab === "Upcoming" && (
                  <p className="v3-next-sitting">
                    {!["completed", "cancelled", "no-show"].includes(
                      next.status
                    )
                      ? `Next: sitting ${next.sessionIndex || sittings.indexOf(next) + 1} · ${bookingDate(next.startsAt, next.timeZone)}`
                      : "Session finished · payment outstanding"}
                  </p>
                )}
                <div className="v3-inline">
                  <Status>
                    {formCount > 0
                      ? `${formCount} ${formCount === 1 ? "form" : "forms"} to complete`
                      : "No forms outstanding"}
                  </Status>
                  <Status>
                    {money(
                      sittings.reduce(
                        (sum, a) => sum + (a.amountPaidCents || 0),
                        0
                      )
                    )}{" "}
                    paid
                  </Status>
                </div>
                {requested?.paymentRequest ? (
                  <ActionLink
                    href={`/pay/${requested.paymentRequest.token}`}
                    tone="primary"
                  >
                    Review {money(requested.paymentRequest.amountCents)} request
                  </ActionLink>
                ) : forms?.conversationId ? (
                  <ActionLink
                    href={destination(forms) + "&action=forms"}
                    tone="primary"
                  >
                    Complete sitting {forms.sessionIndex || 1} forms
                  </ActionLink>
                ) : next.conversationId ? (
                  <ActionLink href={destination(next)} tone="primary">
                    {tab === "Past"
                      ? "View session & aftercare"
                      : next.status === "completed"
                        ? "Review outstanding balance"
                        : "View next sitting"}
                  </ActionLink>
                ) : null}
                <ol className="v3-sitting-list" aria-label="Project sittings">
                  {sittings.map((a, index) => (
                    <li
                      key={a.id}
                      data-next={a.id === next.id && tab === "Upcoming"}
                    >
                      <SittingCard
                        title={`Sitting ${a.sessionIndex || index + 1} · ${statusLabel(a.status)}`}
                        detail={bookingDate(a.startsAt, a.timeZone)}
                      >
                        {a.conversationId ? (
                          <SittingSummary
                            conversationId={a.conversationId}
                            appointmentId={a.id}
                          />
                        ) : (
                          <>
                            <p className="v3-muted">
                              {a.depositPaidCents > 0
                                ? "Deposit received"
                                : "No deposit recorded"}{" "}
                              · {money(a.balanceDueCents)} remaining
                              {a.pendingFormCount
                                ? ` · ${a.pendingFormCount} ${a.pendingFormCount === 1 ? "form" : "forms"} to complete`
                                : ""}
                            </p>
                            {a.paymentRequest && a.id !== requested?.id && (
                              <ActionLink
                                href={`/pay/${a.paymentRequest.token}`}
                              >
                                Review {money(a.paymentRequest.amountCents)}{" "}
                                request
                              </ActionLink>
                            )}
                          </>
                        )}
                      </SittingCard>
                    </li>
                  ))}
                </ol>
                {first.conversationId && (
                  <ActionLink
                    href={`/chat/${first.conversationId}`}
                    tone="quiet"
                  >
                    Message {first.artist.name}
                  </ActionLink>
                )}
              </div>
            </Panel>
          );
        })}
      </div>
      {!!requests.length && (
        <Section title="Requests with your artists">
          {requests.map(r => (
            <Panel key={r.id}>
              <h2>Request with {r.artistName}</h2>
              <p>{r.description || "Your tattoo idea"}</p>
              <Status>{statusLabel(r.status)}</Status>
              <p>
                Your request has been received. Proposed dates will appear when
                your artist sends a plan.
              </p>
              <ActionLink
                href={
                  r.conversationId
                    ? `/chat/${r.conversationId}`
                    : "/conversations"
                }
              >
                Open conversation
              </ActionLink>
            </Panel>
          ))}
        </Section>
      )}
      {consults.map(c => (
        <Panel key={c.id}>
          <h2>Consultation with {c.artistName}</h2>
          <ActionLink
            href={
              c.conversationId ? `/chat/${c.conversationId}` : "/conversations"
            }
          >
            View messages
          </ActionLink>
        </Panel>
      ))}
      {!bookings.isLoading &&
        !bookings.error &&
        (tab === "Past" || (!plans.isLoading && !plans.error)) &&
        !groups.length &&
        !pending.length &&
        !requests.length &&
        !consults.length && (
          <Panel>
            <h2>
              {tab === "Past"
                ? "No past projects yet"
                : "No bookings or requests yet"}
            </h2>
            <p>
              {tab === "Past"
                ? "Completed, cancelled and no-show sittings appear here once their project has no active sittings or balance to settle."
                : "Send an idea through your artist’s booking link. Your request and its progress will appear here."}
            </p>
            <ActionLink href="/conversations">Open messages</ActionLink>
          </Panel>
        )}
      <details>
        <summary className="v3-row">More options</summary>
        <Row href="/waitlist" title="Cancellation offers" />
        <Row href="/purchases" title="Your purchases" />
        <Row href="/discover" title="Explore artists" />
      </details>
      {plan && (
        <SessionPlanCheckoutSheet
          sessionPlanId={plan.id}
          conversationId={plan.conversationId}
          onClose={() => {
            setPlan(null);
            void plans.refetch();
            void bookings.refetch();
          }}
        />
      )}
    </Screen>
  );
}
