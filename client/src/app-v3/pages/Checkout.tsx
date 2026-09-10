import { useEffect, useState } from "react";
import { CheckCircle2, LockKeyhole } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { DotsCheckout } from "@/components/ui/ssot/DotsCheckout";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import { bookingDate, money } from "@/features/workspace/bookingPresentation";
import {
  Action,
  Avatar,
  Feedback,
  Panel,
  Row,
  Section,
  Status,
} from "../design/primitives";
type Step = "review" | "payment" | "confirming";
/** Refresh immediate reads and webhook-dependent views without treating Stripe's client callback as payment confirmation. */
function usePaymentRefresh(confirming: boolean) {
  const utils = trpc.useUtils();
  useEffect(() => {
    if (!confirming) return;
    const refresh = () => {
      void utils.appointments.invalidate();
      void utils.sessionPlans.invalidate();
      void utils.projects.invalidate();
      void utils.messages.invalidate();
      void utils.dashboard.invalidate();
      void utils.conversations.invalidate();
    };
    refresh();
    const timers = [600, 1500].map(delay => setTimeout(refresh, delay));
    return () => timers.forEach(clearTimeout);
  }, [confirming, utils]);
}
function Confirming({ onCheck }: { onCheck: () => unknown }) {
  return (
    <Panel>
      <div role="status">
        <h2>Confirming your payment</h2>
        <p>
          Your payment was submitted. Please don’t pay again. You can close this
          sheet and return to Bookings to check its status.
        </p>
      </div>
      <Action tone="secondary" onClick={() => onCheck()}>
        Check confirmation
      </Action>
    </Panel>
  );
}
export function SessionPlanCheckoutSheet({
  sessionPlanId,
  conversationId,
  onClose,
}: {
  sessionPlanId: number;
  conversationId: number;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>("review");
  const [timedOut, setTimedOut] = useState(false);
  const query = trpc.sessionPlans.getById.useQuery(
    { sessionPlanId },
    { refetchInterval: step === "confirming" && !timedOut ? 2000 : false }
  );
  const accept = trpc.sessionPlans.accept.useMutation({
    onSuccess: () => setStep("payment"),
  });
  const plan = query.data;
  const paid = plan?.status === "accepted";
  usePaymentRefresh(step === "confirming" || paid);
  useEffect(() => {
    if (step !== "confirming") return;
    const timer = setTimeout(() => setTimedOut(true), 60000);
    return () => clearTimeout(timer);
  }, [step]);
  return (
    <SheetShell
      isOpen
      onClose={() => {
        if (!accept.isPending) onClose();
      }}
      footer={
        step === "review" && plan?.status === "pending" ? (
          <Action
            style={{ width: "100%" }}
            disabled={accept.isPending}
            onClick={() => accept.mutate({ sessionPlanId })}
          >
            <LockKeyhole />
            {accept.isPending
              ? "Preparing checkout…"
              : "Continue to secure checkout"}
          </Action>
        ) : undefined
      }
      title={
        paid
          ? "Booking confirmed"
          : step === "payment"
            ? "Pay your deposit"
            : step === "confirming"
              ? "Confirming your booking"
              : "Review your booking"
      }
    >
      <div className="v3-stack">
        <Feedback
          loading={query.isLoading}
          error={query.error}
          onRetry={() => query.refetch()}
        />
        {accept.error && <p role="alert">{accept.error.message}</p>}
        {paid ? (
          <>
            <Status tone="success">
              <CheckCircle2 />
              Deposit paid
            </Status>
            <h2>Your dates are confirmed</h2>
            <p>
              You can now review your booking details and any required forms.
            </p>
            <Action onClick={onClose}>Done</Action>
          </>
        ) : step === "confirming" ? (
          <Confirming onCheck={() => query.refetch()} />
        ) : step === "payment" && accept.data ? (
          <DotsCheckout
            clientSecret={accept.data.clientSecret}
            amountCents={accept.data.totalCents}
            onBack={() => setStep("review")}
            onComplete={() => {
              setStep("confirming");
              setTimedOut(false);
              void query.refetch();
            }}
          />
        ) : (
          plan && (
            <>
              <Row
                title={plan.artist?.name || "Your artist"}
                detail={
                  plan.items.length +
                  " session" +
                  (plan.items.length === 1 ? "" : "s")
                }
                icon={
                  <Avatar name={plan.artist?.name} src={plan.artist?.avatar} />
                }
              />
              <Section title="Your sessions">
                {plan.items.map(item => (
                  <Row
                    key={item.id}
                    title={"Session " + item.sessionIndex}
                    detail={
                      bookingDate(item.startsAt) +
                      " · " +
                      item.durationMinutes +
                      " minutes"
                    }
                    trailing={
                      <strong>{money(item.depositCents)} deposit</strong>
                    }
                  />
                ))}
              </Section>
              <Panel>
                <dl className="v3-facts">
                  <div>
                    <dt>Session estimate</dt>
                    <dd>{money(plan.totalEstimateCents)}</dd>
                  </div>
                  <div>
                    <dt>Deposit due now</dt>
                    <dd>{money(plan.depositTotalCents)}</dd>
                  </div>
                  <div>
                    <dt>Platform fee</dt>
                    <dd>{money(plan.platformFeeCents || 0)}</dd>
                  </div>
                  <div>
                    <dt>Total due today</dt>
                    <dd>
                      <strong>
                        {money(
                          plan.depositTotalCents + (plan.platformFeeCents || 0)
                        )}
                      </strong>
                    </dd>
                  </div>
                </dl>
              </Panel>
              <p className="v3-muted">
                Deposits are non-refundable under the booking terms. The
                estimated session balance after this deposit is{" "}
                {money(
                  Math.max(0, plan.totalEstimateCents - plan.depositTotalCents)
                )}
                . Each session’s balance is requested separately.
              </p>
              {plan.status !== "pending" && (
                <p role="status">
                  This proposal is no longer available for payment. Contact your
                  artist for updated dates.
                </p>
              )}
            </>
          )
        )}
      </div>
    </SheetShell>
  );
}
export function BalanceCheckoutSheet({
  open,
  onClose,
  appointmentId,
  artistName,
  projectName,
}: {
  open: boolean;
  onClose: () => void;
  appointmentId: number;
  balanceDueCents?: number;
  artistName: string;
  projectName: string;
}) {
  const [step, setStep] = useState<Step>("review");
  const [timedOut, setTimedOut] = useState(false);
  const query = trpc.funnel.getBalanceInfo.useQuery(
    { bookingId: appointmentId },
    {
      enabled: open && appointmentId > 0,
      refetchInterval:
        open && step === "confirming" && !timedOut ? 2500 : false,
    }
  );
  const create = trpc.appointments.createBalancePaymentIntent.useMutation({
    onSuccess: () => setStep("payment"),
  });
  const paid = query.data?.status === "fully_paid";
  usePaymentRefresh(step === "confirming" || paid);
  useEffect(() => {
    setStep("review");
    setTimedOut(false);
    create.reset();
  }, [open, appointmentId]);
  useEffect(() => {
    if (step !== "confirming") return;
    const timer = setTimeout(() => setTimedOut(true), 60000);
    return () => clearTimeout(timer);
  }, [step]);
  return (
    <SheetShell
      isOpen={open}
      onClose={() => {
        if (!create.isPending) onClose();
      }}
      title={paid ? "Payment confirmed" : "Pay your balance"}
      description={projectName + " · " + artistName}
    >
      <div className="v3-stack">
        <Feedback
          loading={query.isLoading}
          error={query.error}
          onRetry={() => query.refetch()}
        />
        {create.error && <p role="alert">{create.error.message}</p>}
        {paid ? (
          <>
            <Status tone="success">
              <CheckCircle2 />
              Paid in full
            </Status>
            <p>Your payment is confirmed and your booking has been updated.</p>
            <Action onClick={onClose}>Done</Action>
          </>
        ) : step === "confirming" ? (
          <Confirming onCheck={() => query.refetch()} />
        ) : step === "payment" && create.data ? (
          <DotsCheckout
            clientSecret={create.data.clientSecret}
            amountCents={create.data.totalCents}
            onBack={() => setStep("review")}
            onComplete={() => {
              setStep("confirming");
              void query.refetch();
            }}
          />
        ) : (
          query.data && (
            <>
              <Panel>
                <dl className="v3-facts">
                  <div>
                    <dt>Session balance</dt>
                    <dd>{money(query.data.remainingBalanceCents)}</dd>
                  </div>
                  <div>
                    <dt>Platform fee</dt>
                    <dd>{money(query.data.platformFeeCents)}</dd>
                  </div>
                  <div>
                    <dt>Total due</dt>
                    <dd>
                      <strong>{money(query.data.clientTotalCents)}</strong>
                    </dd>
                  </div>
                </dl>
              </Panel>
              <Action
                disabled={
                  create.isPending || query.data.remainingBalanceCents <= 0
                }
                onClick={() => create.mutate({ appointmentId })}
              >
                <LockKeyhole />
                {create.isPending
                  ? "Preparing checkout…"
                  : "Continue to secure checkout"}
              </Action>
            </>
          )
        )}
      </div>
    </SheetShell>
  );
}
