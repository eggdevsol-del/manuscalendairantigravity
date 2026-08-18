import React, { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { EmbeddedStripeCheckout } from "@/features/stripe/EmbeddedStripeCheckout";
import { X, Check, Lock, ArrowLeft } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { UserAvatar } from "@/components/ui/ssot/UserAvatar";

type Step = "review" | "payment" | "success";

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
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [checkoutData, setCheckoutData] = useState<any>(null);
  const { user } = useAuth();

  const utils = trpc.useUtils();

  // Get plan details
  const { data: plan } = trpc.sessionPlans.getById.useQuery({
    sessionPlanId,
  });

  const acceptMutation = trpc.sessionPlans.accept.useMutation({
    onSuccess: (data) => {
      setClientSecret(data.clientSecret);
      setCheckoutData(data);
      setStep("payment");
    },
  });

  // Artist info
  const artistName =
    (plan?.artist as any)?.name || "Artist";

  const handleContinueToCheckout = () => {
    setPaying(true);
    acceptMutation.mutate(
      { sessionPlanId },
      {
        onSettled: () => setPaying(false),
      }
    );
  };

  const handlePaymentComplete = () => {
    setStep("success");
    // Invalidate queries so the bookings page and chat update
    utils.sessionPlans.getById.invalidate({ sessionPlanId });
    utils.sessionPlans.getByConversation.invalidate({ conversationId });
    utils.appointments.getClientBookings.invalidate();
  };

  const handleDone = () => {
    onClose();
  };

  const title =
    step === "success" ? "Payment confirmed" : "Accept session plan";

  return (
    <>
      {/* Scrim */}
      <div
        className="fixed inset-0"
        style={{
          background: "rgba(0,0,0,.62)",
          animation: "sheetScrimFade 180ms ease-out",
          zIndex: "var(--z-bottom-sheet)" as any,
        }}
        onClick={step !== "payment" ? onClose : undefined}
      />

      {/* Sheet panel — docked to top of bottom nav */}
      <div
        className="fixed left-0 right-0 flex flex-col"
        style={{
          bottom: "var(--bottom-nav-height)",
          zIndex: "var(--z-bottom-sheet)" as any,
          background: "#1B1B1B",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderTop: "1px solid rgba(255,255,255,0.12)",
          maxHeight: "85vh",
          animation: "sheetSlideUp 280ms cubic-bezier(.2,.8,.25,1)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
        >
          <h2 className="text-[17px] font-bold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="flex items-center justify-center"
            style={{ width: 44, height: 44, color: "#7A7A7A" }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div
          className="flex-1 overflow-y-auto p-4"
          style={{ minHeight: 0 }}
        >
          {/* Step 1: Review */}
          {step === "review" && plan && (
            <ReviewStep
              plan={plan}
              artistName={artistName}
              paying={paying}
              onContinue={handleContinueToCheckout}
            />
          )}

          {/* Step 2: Payment */}
          {step === "payment" && clientSecret && checkoutData && (
            <PaymentStep
              clientSecret={clientSecret}
              totalCents={checkoutData.totalCents}
              onComplete={handlePaymentComplete}
              onBack={() => setStep("review")}
            />
          )}

          {/* Step 3: Success */}
          {step === "success" && plan && (
            <SuccessStep
              plan={plan}
              userEmail={user?.email || ""}
              onDone={handleDone}
            />
          )}
        </div>
      </div>

      <style>{`
        @keyframes sheetScrimFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes sheetSlideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes successCheckPop {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </>
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

  // Get first item's projectName or title for the piece name
  const pieceName = plan.items?.[0]?.appointment?.projectName || "Session plan";

  return (
    <>
      {/* Inner card */}
      <div
        style={{
          background: "#1A1A1E",
          border: "1px solid rgba(255,255,255,0.08)",
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
            <div className="text-[14px] font-semibold text-white">
              Deposit · {items.length} session{items.length !== 1 ? "s" : ""}
            </div>
            <div className="text-[12.5px] text-[#7A7A7A]">
              {artistName}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", margin: "0 0 12px" }} />

        {/* Line items */}
        <div className="flex flex-col gap-2">
          {/* Plan total */}
          <div className="flex justify-between text-[13px]">
            <span style={{ color: "#7A7A7A" }}>Session plan total</span>
            <span style={{ color: "#7A7A7A" }}>
              ${(totalEstimate / 100).toFixed(2)}
            </span>
          </div>

          {/* Per-session deposits */}
          {items.map((item: any) => (
            <div key={item.id} className="flex justify-between text-[13px]">
              <span style={{ color: "#7A7A7A" }}>
                Session {item.sessionIndex} deposit · {Math.round(item.durationMinutes / 60)} hrs
              </span>
              <span style={{ color: "#7A7A7A" }}>
                ${(item.depositCents / 100).toFixed(2)}
              </span>
            </div>
          ))}

          {/* Deposit due now */}
          <div className="flex justify-between text-[13px] font-semibold">
            <span className="text-white">Deposit due now (non-refundable)</span>
            <span className="text-white">
              ${(depositTotal / 100).toFixed(2)}
            </span>
          </div>

          {/* Platform fee */}
          <div className="flex justify-between text-[13px]">
            <span style={{ color: "#7A7A7A" }}>Platform fee</span>
            <span style={{ color: "#7A7A7A" }}>
              ${(platformFee / 100).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", margin: "12px 0" }} />

        {/* Total */}
        <div className="flex justify-between items-baseline">
          <span className="text-[14px] font-semibold text-white">
            Total due today
          </span>
          <span className="text-[20px] font-bold text-white">
            ${(totalDue / 100).toFixed(2)}
          </span>
        </div>
      </div>

      {/* Footnote */}
      <p className="text-[12px] text-[#7A7A7A] mb-4 leading-relaxed">
        Each session's deposit is calculated separately and charged here as one
        payment. Paying it locks both dates in {artistName}'s calendar — the
        balance is requested after each session.
      </p>

      {/* CTA */}
      <button
        onClick={onContinue}
        disabled={paying}
        className="w-full flex items-center justify-center text-[15px] font-semibold"
        style={{
          height: 52,
          borderRadius: 16,
          background: paying ? "rgba(255,255,255,0.12)" : "#F8D057",
          color: paying ? "#7A7A7A" : "#1B1B1B",
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
    <>
      {/* Amount display */}
      <div className="mb-4">
        <span className="text-[13.5px] text-[#7A7A7A]">Paying </span>
        <span className="text-[17px] font-bold text-white">
          ${(totalCents / 100).toFixed(2)}
        </span>
      </div>

      {/* Stripe iframe well */}
      <div
        style={{
          background: "#141416",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 14,
          padding: 14,
          marginBottom: 16,
        }}
      >
        <div className="flex items-center gap-1.5 mb-3">
          <Lock className="w-3 h-3 text-[#7A7A7A]" />
          <span className="text-[11px] font-semibold text-[#7A7A7A]">
            Secure checkout · powered by Stripe
          </span>
        </div>
        <EmbeddedStripeCheckout
          clientSecret={clientSecret}
          onComplete={onComplete}
        />
      </div>

      {/* Back button */}
      <button
        onClick={onBack}
        className="w-full flex items-center justify-center gap-1.5 text-[13px] font-semibold"
        style={{
          height: 44,
          color: "#7A7A7A",
          background: "transparent",
          border: "none",
        }}
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back
      </button>
    </>
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
      <h3 className="text-[20px] font-bold text-white mb-2">Deposit paid</h3>

      {/* Body */}
      <p className="text-[13.5px] text-[#7A7A7A] mb-6" style={{ maxWidth: 280 }}>
        Session{items.length !== 1 ? "s" : ""} {sessionIndices}{" "}
        {items.length !== 1 ? "are" : "is"} locked in. {plan.artist?.name || "Your artist"} has been
        notified.
      </p>

      {/* Receipt row */}
      <div
        className="w-full flex items-center justify-between mb-6"
        style={{
          background: "#1A1A1E",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 14,
          padding: "12px 14px",
        }}
      >
        <span className="text-[13px] text-[#7A7A7A]">Receipt sent to</span>
        <span className="text-[13px] font-semibold text-white">{userEmail}</span>
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
