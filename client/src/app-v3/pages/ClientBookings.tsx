import { useState } from "react";
import {
  CalendarDays,
  MapPin,
  MessageCircle,
  CreditCard,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { SessionPlanCheckoutSheet } from "./Checkout";
import { BalanceCheckoutSheet } from "./Checkout";
import {
  bookingDate,
  money,
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

export default function ClientBookings() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"Upcoming" | "Past">("Upcoming");
  const bookings = trpc.appointments.getClientBookings.useQuery({
    tab: tab === "Upcoming" ? "upcoming" : "past",
  });
  const plans = trpc.sessionPlans.getByClient.useQuery();
  const [plan, setPlan] = useState<{
    id: number;
    conversationId: number;
  } | null>(null);
  const [pay, setPay] = useState<number | null>(null);
  const pending = plans.data?.filter(p => p.status === "pending") || [];
  const appointments = bookings.data?.appointments || [];
  const selected = appointments.find(a => a.id === pay);
  return (
    <Screen
      title="Bookings"
      wide
      subtitle={`Your next piece, from first idea to healed tattoo${user?.name ? ` · ${user.name.split(" ")[0]}` : ""}`}
    >
      <Tabs
        items={["Upcoming", "Past"] as const}
        value={tab}
        onChange={setTab}
        label="Your bookings"
      />
      {tab === "Upcoming" && (
        <>
          <Feedback error={plans.error} onRetry={() => plans.refetch()} />
          {pending.map(p => (
            <Panel key={p.id} tone="attention">
              <div className="v3-inline">
                <CreditCard />
                <h2>Confirm your appointment</h2>
              </div>
              <p>
                Review your dates with {p.artist?.name || "your artist"} and pay
                your deposit to secure the time.
              </p>
              <Action
                onClick={() =>
                  setPlan({ id: p.id, conversationId: p.conversationId || 0 })
                }
              >
                Review {money(p.depositTotalCents + (p.platformFeeCents || 0))}{" "}
                deposit & fee
              </Action>
            </Panel>
          ))}
        </>
      )}
      <Feedback
        loading={bookings.isLoading}
        error={bookings.error}
        onRetry={() => bookings.refetch()}
      />
      <div className="v3-booking-cards">
        {appointments.map(a => (
          <Panel key={a.id}>
            <div className="v3-stack">
              <div>
                <h2>{a.projectName || a.title}</h2>
                <p>
                  {a.artist.name}
                  {a.sessionIndex
                    ? ` · Session ${a.sessionIndex}${a.sessionTotal ? ` of ${a.sessionTotal}` : ""}`
                    : ""}
                </p>
              </div>
              <div>
                <Status
                  tone={
                    a.status === "confirmed" || a.status === "completed"
                      ? "success"
                      : a.status === "cancelled"
                        ? "danger"
                        : "warning"
                  }
                >
                  {statusLabel(a.status)}
                </Status>
              </div>
              <div className="v3-inline">
                <CalendarDays size={20} />
                {bookingDate(a.startsAt, a.timeZone)}
              </div>
              {a.studioName && (
                <div className="v3-inline">
                  <MapPin size={20} />
                  {a.studioName}
                </div>
              )}
              {a.paymentRequest && a.balanceDueCents > 0 && (
                <Action onClick={() => setPay(a.id)}>
                  Review {money(a.balanceDueCents)} balance
                </Action>
              )}
              {a.conversationId && (
                <>
                  <ActionLink
                    href={`/projects/${a.conversationId}?session=${a.id}`}
                    tone="quiet"
                  >
                    {tab === "Past"
                      ? "View session & aftercare"
                      : "Manage booking"}
                    <ArrowRight />
                  </ActionLink>
                  <ActionLink href={`/chat/${a.conversationId}`}>
                    <MessageCircle />
                    Message {a.artist.name}
                  </ActionLink>
                </>
              )}
            </div>
          </Panel>
        ))}
      </div>
      {tab === "Upcoming" &&
        bookings.data?.pendingConsults?.map(c => (
          <Panel key={c.id}>
            <h2>Request with {c.artistName}</h2>
            <p>
              Your artist has received your request. Their reply will appear in
              Messages.
            </p>
            <ActionLink href="/conversations" tone="quiet">
              View messages <ArrowRight />
            </ActionLink>
          </Panel>
        ))}
      {!bookings.isLoading &&
        !bookings.error &&
        !appointments.length &&
        !bookings.data?.pendingConsults?.length &&
        !pending.length && (
          <Panel>
            <h2>
              {tab === "Past"
                ? "Your past sessions"
                : "Your booking starts with your artist"}
            </h2>
            <p>
              {tab === "Past"
                ? "Completed sessions will appear here."
                : "Open your artist’s booking link to send a request. If you’ve already sent one, check Messages for their reply."}
            </p>
            <ActionLink href="/conversations">Open messages</ActionLink>
          </Panel>
        )}
      <details className="v3-divider">
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
      {selected && (
        <BalanceCheckoutSheet
          open
          onClose={() => {
            setPay(null);
            void bookings.refetch();
          }}
          appointmentId={selected.id}
          balanceDueCents={selected.balanceDueCents}
          artistName={selected.artist.name}
          projectName={selected.projectName || selected.title}
        />
      )}
    </Screen>
  );
}
