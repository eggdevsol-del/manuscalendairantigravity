import { Link } from "wouter";
import { ChevronRight, ClipboardCheck } from "lucide-react";
import { DetailsSheet } from "../components/DetailsSheet";
import { ProjectProgress } from "../components/ProjectProgress";
import {
  orderedProjectGroups,
  nextProjectSitting,
} from "../data/projectProgress";
import { SittingCard } from "../components/SittingCard";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { bookingProjectKey } from "../../../../shared/clientBookingGroups";
import {
  bookingDate,
  money,
  statusLabel,
} from "@/features/workspace/bookingPresentation";
import { SessionPlanCheckoutSheet } from "./Checkout";
import {
  SittingDate,
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
  const groups = orderedProjectGroups(appointments);
  const completedGroups = orderedProjectGroups(past.data?.appointments || []);
  const requests = bookings.data?.pendingRequests || [];
  const consults = bookings.data?.pendingConsults || [];
  const next = nextProjectSitting(appointments);
  const dueForms = appointments.find(
    a =>
      a.pendingFormCount > 0 &&
      a.conversationId &&
      !["completed", "cancelled", "no-show"].includes(a.status)
  );
  const projectCards = (
    groups: ReturnType<
      typeof orderedProjectGroups<(typeof appointments)[number]>
    >
  ) => (
    <div className="ivory-project-list">
      {groups.map(sittings => {
        const first = sittings[0];
        const key = bookingProjectKey(first);
        const upcoming = nextProjectSitting(sittings);
        const proposal = pending.find(p => p.id === first.sessionPlanId);
        return (
          <Panel key={key} className="ivory-project-card">
            {first.conversationId ? (
              <Link
                className="simple-project-link"
                href={`/projects/${first.conversationId}?project=${encodeURIComponent(key)}`}
              >
                <span>
                  <strong>
                    {sittings.find(a => a.projectName)?.projectName ||
                      first.serviceName ||
                      "Tattoo project"}
                  </strong>
                  <small>{first.artist.name}</small>
                </span>
                <ChevronRight size={18} />
              </Link>
            ) : (
              <h2>{first.serviceName || "Tattoo project"}</h2>
            )}
            <ProjectProgress sittings={sittings} />
            <ul className="simple-project-dates" aria-label="Project dates">
              {sittings.map(a => (
                <li
                  key={a.id}
                  data-next={a.id === upcoming?.id}
                  data-status={a.status}
                >
                  <span>
                    {a.startsAt
                      ? bookingDate(a.startsAt, a.timeZone)
                      : "Date to be arranged"}
                  </span>
                  {a.rescheduled ? (
                    <Status>Rescheduled</Status>
                  ) : a.status === "completed" ? (
                    <Status tone="success">Done</Status>
                  ) : a.id === upcoming?.id ? (
                    <Status>Next</Status>
                  ) : null}
                </li>
              ))}
            </ul>
            {proposal && (
              <Row
                title={
                  proposal.paymentState
                    ? "Check payment status"
                    : "Review proposal"
                }
                detail={
                  proposal.paymentState
                    ? undefined
                    : `${money(proposal.depositTotalCents + (proposal.platformFeeCents || 0))} deposit & fee`
                }
                onClick={() =>
                  setPlan({
                    id: proposal.id,
                    conversationId: proposal.conversationId || 0,
                  })
                }
              />
            )}
            {sittings
              .filter(a => a.paymentRequest)
              .map(a => (
                <Row
                  key={a.id}
                  title={`Payment requested · ${money(a.paymentRequest!.amountCents)}`}
                  href={`/pay/${a.paymentRequest!.token}`}
                />
              ))}
            {!first.conversationId &&
              sittings.map((a, index) => (
                <SittingCard
                  key={a.id}
                  title={`Sitting ${a.sessionIndex || index + 1}`}
                  detail={bookingDate(a.startsAt, a.timeZone)}
                >
                  <p>
                    {money(a.balanceDueCents)} remaining ·{" "}
                    {statusLabel(a.status)}
                  </p>
                </SittingCard>
              ))}
          </Panel>
        );
      })}
    </div>
  );
  return (
    <Screen
      title="My Tattoos"
      subtitle="Your next sitting, and everything around it"
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
      {next && (
        <Panel tone="next" className="simple-next">
          <div className="simple-between">
            <span className="simple-eyebrow">Your next sitting</span>
            <Status>
              {next.rescheduled ? "Rescheduled" : statusLabel(next.status)}
            </Status>
          </div>
          <h2>
            <SittingDate label={bookingDate(next.startsAt, next.timeZone)} />
          </h2>
          <p>
            {next.artist.name} ·{" "}
            {next.projectName || next.serviceName || "Tattoo sitting"}
          </p>
          <p>
            {next.studioName ? `${next.studioName} · ` : ""}
            {next.durationMinutes ? `${next.durationMinutes / 60}h · ` : ""}
            {money(next.balanceDueCents)} remaining
          </p>
          {next.conversationId && (
            <div className="simple-action-pair">
              <ActionLink
                href={`/projects/${next.conversationId}?session=${next.id}`}
                tone="secondary"
              >
                Sitting details
              </ActionLink>
              <ActionLink href={`/chat/${next.conversationId}`} tone="primary">
                Message
              </ActionLink>
            </div>
          )}
        </Panel>
      )}
      {dueForms && (
        <Link
          className="simple-notice"
          href={`/projects/${dueForms.conversationId}?session=${dueForms.id}&action=forms`}
        >
          <ClipboardCheck />
          <span>
            <strong>Complete your forms</strong>
            <small>
              Before your sitting · {dueForms.pendingFormCount} to complete
            </small>
          </span>
          <ChevronRight />
        </Link>
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
      {groups.length > 0 && (
        <Section title="Your projects">{projectCards(groups)}</Section>
      )}
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
