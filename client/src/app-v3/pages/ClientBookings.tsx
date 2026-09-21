import { isDesignProjectName } from "../../../../shared/projectNames";
import { DetailsSheet } from "../components/DetailsSheet";
import { ProjectProgress } from "../components/ProjectProgress";
import {
  ProjectSittings,
  ProjectDisclosure,
} from "../components/ProjectSittings";
import {
  orderedProjectGroups,
  nextProjectSitting,
} from "../data/projectProgress";
import { SittingCard } from "../components/SittingCard";
import { SittingSummary } from "../components/SittingSummary";
import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { bookingProjectKey } from "../../../../shared/clientBookingGroups";
import {
  bookingDate,
  money,
  statusLabel,
} from "@/features/workspace/bookingPresentation";
import { SessionPlanCheckoutSheet } from "./Checkout";
import {
  Action,
  ActionLink,
  Feedback,
  Panel,
  Row,
  Screen,
  SummaryCard,
  Section,
  Status,
} from "../design/primitives";

export default function ClientBookings() {
  const [openSittings, setOpenSittings] = useState<
    Record<string, number | null>
  >({});
  const bookings = trpc.appointments.getClientBookings.useQuery({
    tab: "upcoming",
  });
  const past = trpc.appointments.getClientBookings.useQuery({ tab: "past" });
  const plans = trpc.sessionPlans.getByClient.useQuery();
  const [plan, setPlan] = useState<{
    id: number;
    conversationId: number;
  } | null>(null);
  const pending = (plans.data || []).filter(
    p => p.paymentState || (p.requiresDeposit ?? p.status === "pending")
  );
  const appointments = bookings.data?.appointments || [];
  const standaloneProposals = pending.filter(
    p => !appointments.some(a => a.sessionPlanId === p.id)
  );
  const attemptedNames = useRef(new Set<number>());
  const [nameError, setNameError] = useState(false);
  const [nameRetry, setNameRetry] = useState(0);
  const nameProject = trpc.projects.nameProject.useMutation();
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      for (const a of [
        ...(bookings.data?.appointments || []),
        ...(plans.data || []).map(p => ({
          projectName: p.projectName,
          sessionPlanId: p.id,
          conversationId: p.conversationId,
        })),
      ]) {
        if (cancelled) return;
        if (
          isDesignProjectName(a.projectName) ||
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
          if (!cancelled) {
            await bookings.refetch();
            await plans.refetch();
          }
        } catch {
          if (!cancelled) setNameError(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookings.data, plans.data, nameRetry]);
  const groups = orderedProjectGroups(appointments);
  const completedGroups = orderedProjectGroups(past.data?.appointments || []);
  const requests = bookings.data?.pendingRequests || [];
  const consults = bookings.data?.pendingConsults || [];
  const projectCards = (
    groups: ReturnType<
      typeof orderedProjectGroups<(typeof appointments)[number]>
    >
  ) => (
    <div className="ivory-project-list">
      {groups.map(sittings => {
        const first = sittings[0];
        const next =
          nextProjectSitting(sittings) ||
          sittings.find(a => a.balanceDueCents > 0) ||
          first;
        const key = bookingProjectKey(first);
        const proposal = pending.find(p => p.id === first.sessionPlanId);
        const requested = sittings.filter(a => a.paymentRequest);
        const forms = sittings.find(
          a =>
            a.pendingFormCount > 0 &&
            !["completed", "cancelled", "no-show"].includes(a.status)
        );
        const destination = (a: typeof first) =>
          `/projects/${a.conversationId}?session=${a.id}`;
        return (
          <Panel key={key} className="ivory-project-card">
            <div className="v3-stack">
              <div>
                <h2>
                  {sittings.find(a => a.projectName)?.projectName ||
                    first.serviceName ||
                    "Tattoo project"}
                </h2>
                <p>{first.artist.name}</p>
              </div>
              <ProjectProgress sittings={sittings} />
              <div className="ivory-project-actions">
                {proposal && (
                  <Action
                    onClick={() =>
                      setPlan({
                        id: proposal.id,
                        conversationId: proposal.conversationId || 0,
                      })
                    }
                  >
                    {proposal.paymentState
                      ? "Check payment status"
                      : `Review ${money(proposal.depositTotalCents + (proposal.platformFeeCents || 0))} deposit & fee`}
                  </Action>
                )}
                {requested.map(
                  a =>
                    a.paymentRequest && (
                      <ActionLink
                        key={a.id}
                        href={`/pay/${a.paymentRequest.token}`}
                        tone="primary"
                      >
                        Sitting {a.sessionIndex || sittings.indexOf(a) + 1}:
                        review {money(a.paymentRequest.amountCents)} request
                      </ActionLink>
                    )
                )}
                {forms?.conversationId && (
                  <ActionLink
                    href={destination(forms) + "&action=forms"}
                    tone="secondary"
                  >
                    Complete sitting {forms.sessionIndex || 1} forms
                  </ActionLink>
                )}
              </div>
              <ProjectDisclosure sittings={sittings}>
                <p className="ivory-project-money">
                  {money(
                    sittings.reduce(
                      (sum, a) => sum + (a.amountPaidCents || 0),
                      0
                    )
                  )}{" "}
                  paid ·{" "}
                  {money(
                    sittings.reduce(
                      (sum, a) => sum + (a.balanceDueCents || 0),
                      0
                    )
                  )}{" "}
                  remaining
                </p>
                <ProjectSittings
                  sittings={sittings}
                  selectedId={openSittings[key]}
                  render={(a, index) => (
                    <SittingCard
                      expanded={openSittings[key] === a.id}
                      onExpandedChange={open =>
                        setOpenSittings(previous => ({
                          ...previous,
                          [key]: open ? a.id : null,
                        }))
                      }
                      title={`Sitting ${a.sessionIndex || index + 1} · ${statusLabel(a.status)}${a.rescheduled ? " · Rescheduled" : ""}`}
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
                          {a.paymentRequest &&
                            !requested.some(r => r.id === a.id) && (
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
                  )}
                />
                {first.conversationId && (
                  <div className="ivory-project-links">
                    <ActionLink
                      href={`/chat/${first.conversationId}`}
                      tone="quiet"
                    >
                      Message artist
                    </ActionLink>
                    <ActionLink
                      href={destination(next) + "&view=Files"}
                      tone="quiet"
                    >
                      Design & references
                    </ActionLink>
                    <ActionLink
                      href={destination(next) + "&view=Payments"}
                      tone="quiet"
                    >
                      Payments
                    </ActionLink>
                  </div>
                )}
              </ProjectDisclosure>
            </div>
          </Panel>
        );
      })}
    </div>
  );
  return (
    <Screen
      title="Bookings"
      subtitle="Your tattoos, sittings and next steps"
      wide
    >
      <Feedback
        loading={bookings.isLoading || plans.isLoading}
        error={bookings.error || plans.error}
        onRetry={() => {
          void bookings.refetch();
          void plans.refetch();
        }}
      />
      {nameError && (
        <DetailsSheet
          title="Project names"
          label="Some project names are unavailable"
          className="v3-compact-notice"
        >
          <p>
            Your sitting dates and booking details remain available. Some
            imported proposals may need an artist-provided name.
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
        </DetailsSheet>
      )}
      {standaloneProposals.length > 0 && (
        <div className="v3-summary-list">
          {standaloneProposals.map(p => (
            <SummaryCard
              key={p.id}
              tone="attention"
              title={p.projectName || "Booking proposal"}
              detail={`${p.artist?.name || "Your artist"} · ${p.paymentState ? "Payment review" : p.items.length ? `${p.items.length} ${p.items.length === 1 ? "sitting" : "sittings"}` : "Dates unavailable"}`}
              actionLabel={
                p.paymentState
                  ? "Check payment status"
                  : "View booking proposal"
              }
              aria-haspopup="dialog"
              onClick={() =>
                setPlan({ id: p.id, conversationId: p.conversationId || 0 })
              }
            />
          ))}
        </div>
      )}
      {groups.length > 0 && projectCards(groups)}
      <DetailsSheet
        className="ivory-completed-projects"
        title={
          <>
            Completed projects{past.data ? ` · ${completedGroups.length}` : ""}
          </>
        }
      >
        <Feedback
          loading={past.isLoading}
          error={past.error}
          onRetry={() => past.refetch()}
        />
        {completedGroups.length > 0 && projectCards(completedGroups)}
        {!past.isLoading && !past.error && !completedGroups.length && (
          <p className="v3-muted">No completed projects yet.</p>
        )}
      </DetailsSheet>
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
        !plans.isLoading &&
        !plans.error &&
        !groups.length &&
        !pending.length &&
        !requests.length &&
        !consults.length && (
          <Panel>
            <h2>No active bookings or requests</h2>
            <p>
              Send an idea through your artist’s booking link. Your request and
              its progress will appear here.
            </p>
            <ActionLink href="/conversations">Open messages</ActionLink>
          </Panel>
        )}
      <DetailsSheet title={<> More options </>}>
        <Row href="/waitlist" title="Cancellation offers" />
        <Row href="/purchases" title="Your purchases" />
        <Row href="/discover" title="Explore artists" />
      </DetailsSheet>
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
