import React, { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { DotsCheckout } from "@/components/ui/ssot/DotsCheckout";
import { Check, Lock, ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { UserAvatar } from "@/components/ui/ssot/UserAvatar";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";

type Step = "review" | "payment" | "confirming" | "success";
interface SessionPlanCheckoutSheetProps {
  sessionPlanId: number;
  onClose: () => void;
  conversationId: number;
}
export function SessionPlanCheckoutSheet({
  sessionPlanId,
  onClose,
  conversationId,
}: SessionPlanCheckoutSheetProps) {
  const [step, setStep] = useState<Step>("review");
  const [checkout, setCheckout] = useState<{
    clientSecret: string;
    totalCents: number;
  } | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const query = trpc.sessionPlans.getById.useQuery(
    { sessionPlanId },
    { refetchInterval: step === "confirming" && !timedOut ? 2000 : false }
  );
  const plan = query.data;
  const accept = trpc.sessionPlans.accept.useMutation({
    onSuccess: data => {
      setCheckout(data);
      setStep("payment");
    },
  });
  useEffect(() => {
    if (plan?.status === "accepted") {
      setStep("success");
      void utils.appointments.invalidate();
      void utils.messages.list.invalidate({ conversationId });
    }
  }, [plan?.status, conversationId, utils]);
  useEffect(() => {
    if (step !== "confirming") return;
    const timer = setTimeout(() => setTimedOut(true), 60000);
    return () => clearTimeout(timer);
  }, [step]);
  return (
    <SheetShell
      isOpen
      onClose={onClose}
      title={
        step === "success"
          ? "Your sessions are confirmed"
          : step === "confirming"
            ? "Confirming your booking"
            : "Review your session plan"
      }
      description="Your dates, deposit and next steps in one place."
    >
      {query.isLoading && (
        <p role="status" className="py-8 text-center">
          Loading your plan…
        </p>
      )}
      {query.error && (
        <div role="alert" className="space-y-3">
          <p>We couldn't load your plan.</p>
          <button
            onClick={() => query.refetch()}
            className="underline min-h-11"
          >
            Try again
          </button>
        </div>
      )}
      {accept.error && (
        <p
          role="alert"
          className="mb-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
        >
          {accept.error.message}
        </p>
      )}
      {step === "review" && plan && (
        <ReviewStep
          plan={plan}
          artistName={plan.artist?.name || "Your artist"}
          paying={accept.isPending}
          onContinue={() => accept.mutate({ sessionPlanId })}
        />
      )}
      {step === "payment" && checkout && (
        <PaymentStep
          clientSecret={checkout.clientSecret}
          totalCents={checkout.totalCents}
          onComplete={() => {
            setStep("confirming");
            setTimedOut(false);
            void query.refetch();
          }}
          onBack={() => setStep("review")}
        />
      )}
      {step === "confirming" && (
        <div className="py-8 text-center space-y-4" role="status">
          <Loader2 className="w-8 h-8 mx-auto animate-spin" />
          <h3 className="text-lg font-semibold">
            Payment submitted. Confirming your dates.
          </h3>
          <p className="text-sm text-muted-foreground">
            Your payment has been submitted. Please don't pay again. You can
            return to Bookings to check the confirmation.
          </p>
          {timedOut && (
            <>
              <p className="text-sm">
                Confirmation is taking longer than usual.
              </p>
              <button
                className="underline min-h-11"
                onClick={() => query.refetch()}
              >
                Check confirmation
              </button>
            </>
          )}
        </div>
      )}
      {step === "success" && plan && (
        <SuccessStep
          plan={plan}
          userEmail={user?.email || ""}
          onDone={onClose}
        />
      )}
    </SheetShell>
  );
}

// ── Review Step ──────────────────────────────────────────────

function ReviewStep({
  plan,
  artistName,
  paying,
  onContinue,
}: {
  plan: any;
  artistName: string;
  paying: boolean;
  onContinue: () => void;
}) {
  const items = plan.items || [];
  const totalEstimate = plan.totalEstimateCents || 0;
  const depositTotal = plan.depositTotalCents || 0;
  const platformFee = plan.platformFeeCents || 0;
  const totalDue = depositTotal + platformFee;
  const remaining = Math.max(0, totalEstimate - depositTotal);

  // Get first item's projectName or title for the piece name
  const pieceName = plan.items?.[0]?.appointment?.projectName || "Session plan";

  return (
    <>
      {/* Inner card */}
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: 14,
          marginBottom: 16,
        }}
      >
        {/* Artist header */}
        <div className="flex items-center gap-3 mb-3">
          <UserAvatar
            name={artistName}
            avatar={(plan.artist as any)?.avatar}
            size="sm"
          />
          <div>
            <div className="text-[14px] font-semibold text-foreground">
              Deposit · {items.length} session{items.length !== 1 ? "s" : ""}
            </div>
            <div className="text-[12.5px] text-muted-foreground">
              {artistName}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div
          style={{ borderTop: "1px solid var(--border)", margin: "0 0 12px" }}
        />

        {/* Line items */}
        <div className="flex flex-col gap-2">
          {/* Plan total */}
          <div className="flex justify-between text-[13px]">
            <span style={{ color: "var(--muted-foreground)" }}>
              Session plan total
            </span>
            <span style={{ color: "var(--muted-foreground)" }}>
              ${(totalEstimate / 100).toFixed(2)}
            </span>
          </div>

          {/* Per-session deposits */}
          {items.map((item: any) => (
            <div key={item.id} className="flex justify-between text-[13px]">
              <span style={{ color: "var(--muted-foreground)" }}>
                Session {item.sessionIndex} · {item.durationMinutes} min
                <br />
                {new Date(
                  item.startsAt.replace(" ", "T") +
                    (item.startsAt.includes("T") ? "" : "Z")
                ).toLocaleString("en-AU", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>
              <span style={{ color: "var(--muted-foreground)" }}>
                ${(item.depositCents / 100).toFixed(2)}
              </span>
            </div>
          ))}

          {/* Deposit due now */}
          <div className="flex justify-between text-[13px] font-semibold">
            <span className="text-foreground">
              Deposit due now (non-refundable)
            </span>
            <span className="text-foreground">
              ${(depositTotal / 100).toFixed(2)}
            </span>
          </div>

          {/* Platform fee */}
          <div className="flex justify-between text-[13px]">
            <span style={{ color: "var(--muted-foreground)" }}>
              Platform fee
            </span>
            <span style={{ color: "var(--muted-foreground)" }}>
              ${(platformFee / 100).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div
          style={{ borderTop: "1px solid var(--border)", margin: "12px 0" }}
        />

        <p className="text-sm text-muted-foreground py-3">
          Estimated remaining balance after this deposit: AUD $
          {(remaining / 100).toFixed(2)}
        </p>
        {/* Total */}
        <div className="flex justify-between items-baseline">
          <span className="text-[14px] font-semibold text-foreground">
            Total due today
          </span>
          <span className="text-[20px] font-bold text-foreground">
            ${(totalDue / 100).toFixed(2)}
          </span>
        </div>
      </div>

      {/* Footnote */}
      <p className="text-[12px] text-muted-foreground mb-4 leading-relaxed">
        Each session's deposit is calculated separately and charged here as one
        payment. Confirmation secures these dates in {artistName}'s calendar —
        the balance is requested after each session.
      </p>

      {/* CTA */}
      <button
        onClick={onContinue}
        disabled={paying || plan.status !== "pending"}
        className="w-full flex items-center justify-center text-[15px] font-semibold"
        style={{
          height: 52,
          borderRadius: 16,
          background: paying ? "rgba(255,255,255,0.12)" : "#F8D057",
          color: paying ? "var(--muted-foreground)" : "#1B1B1B",
          border: "none",
        }}
      >
        {paying ? "Preparing checkout…" : "Continue to secure checkout"}
      </button>
    </>
  );
}

// ── Payment Step ─────────────────────────────────────────────

function PaymentStep({
  clientSecret,
  totalCents,
  onComplete,
  onBack,
}: {
  clientSecret: string;
  totalCents: number;
  onComplete: () => void;
  onBack: () => void;
}) {
  return (
    <DotsCheckout
      clientSecret={clientSecret}
      amountCents={totalCents}
      onComplete={onComplete}
      onBack={onBack}
    />
  );
}

// ── Success Step ─────────────────────────────────────────────

function SuccessStep({
  plan,
  userEmail,
  onDone,
}: {
  plan: any;
  userEmail: string;
  onDone: () => void;
}) {
  const items = plan.items || [];
  const sessionIndices = items.map((i: any) => i.sessionIndex).join(" and ");
  const depositTotal = plan.depositTotalCents || 0;

  return (
    <div className="flex flex-col items-center text-center pt-4">
      {/* Check icon */}
      <div
        className="flex items-center justify-center mb-4"
        style={{
          width: 62,
          height: 62,
          borderRadius: "50%",
          background: "rgba(74,222,128,0.14)",
          border: "1px solid rgba(74,222,128,0.4)",
          animation: "successCheckPop 340ms ease-out",
        }}
      >
        <Check className="w-[30px] h-[30px]" style={{ color: "#4ade80" }} />
      </div>

      {/* Headline */}
      <h3 className="text-[20px] font-bold text-foreground mb-2">
        Deposit paid
      </h3>

      {/* Body */}
      <p
        className="text-[13.5px] text-muted-foreground mb-6"
        style={{ maxWidth: 280 }}
      >
        Session{items.length !== 1 ? "s" : ""} {sessionIndices}{" "}
        {items.length !== 1 ? "are" : "is"} locked in.{" "}
        {plan.artist?.name || "Your artist"} has been notified.
      </p>

      {/* Receipt row */}
      <div
        className="w-full flex items-center justify-between mb-6"
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: "12px 14px",
        }}
      >
        <span className="text-[13px] text-muted-foreground">Payment email</span>
        <span className="text-[13px] font-semibold text-foreground">
          {userEmail}
        </span>
      </div>

      {/* Done button */}
      <button
        onClick={onDone}
        className="w-full flex items-center justify-center text-[15px] font-semibold"
        style={{
          height: 52,
          borderRadius: 16,
          background: "#F8D057",
          color: "#1B1B1B",
          border: "none",
        }}
      >
        Done
      </button>
    </div>
  );
}
