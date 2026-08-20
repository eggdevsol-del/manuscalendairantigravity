/**
 * BalanceCheckoutSheet — Pay Early / Pay Now checkout for client bookings.
 *
 * Bottom sheet with 3-step flow: review → payment → success.
 * Uses DotsCheckout SSOT for the payment step.
 */

import React, { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { DotsCheckout } from "@/components/ui/ssot/DotsCheckout";
import { X, Check, Loader2 } from "lucide-react";

type Step = "review" | "payment" | "success";

interface BalanceCheckoutSheetProps {
  open: boolean;
  onClose: () => void;
  appointmentId: number;
  balanceDueCents: number;
  artistName: string;
  projectName: string;
}

export function BalanceCheckoutSheet({
  open,
  onClose,
  appointmentId,
  balanceDueCents,
  artistName,
  projectName,
}: BalanceCheckoutSheetProps) {
  const [step, setStep] = useState<Step>("review");
  const utils = trpc.useUtils();

  const createPI = trpc.appointments.createBalancePaymentIntent.useMutation({
    onSuccess: () => setStep("payment"),
  });

  // Reset state when sheet opens
  useEffect(() => {
    if (open) {
      setStep("review");
      createPI.reset();
    }
  }, [open]);

  const handleProceed = useCallback(() => {
    createPI.mutate({ appointmentId });
  }, [appointmentId]);

  const handlePaymentComplete = useCallback(() => {
    setStep("success");
    // Invalidate bookings to reflect updated payment status
    utils.appointments.getClientBookings.invalidate();
  }, [utils]);

  const handleDone = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!open) return null;

  const piData = createPI.data;

  return (
    <>
      {/* Scrim */}
      <div
        className="fixed inset-0 animate-in fade-in duration-180"
        style={{
          background: "rgba(0,0,0,.62)",
          zIndex: "var(--z-sheet-scrim, 9998)",
        }}
        onClick={step !== "payment" ? onClose : undefined}
      />

      {/* Panel */}
      <div
        className="fixed left-0 right-0 animate-in slide-in-from-bottom duration-300"
        style={{
          bottom: "var(--bottom-nav-height, 64px)",
          maxHeight: "85%",
          background: "#1B1B1B",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderTop: "1px solid rgba(255,255,255,0.12)",
          zIndex: "var(--z-sheet, 9999)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between shrink-0"
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <span
            className="text-[17px] font-bold text-white"
            style={{ fontFamily: '"DM Sans", sans-serif' }}
          >
            {step === "success" ? "Payment confirmed" : "Pay balance"}
          </span>
          <button
            onClick={onClose}
            className="flex items-center justify-center"
            style={{
              width: 44,
              height: 44,
              color: "#7A7A7A",
              background: "none",
              border: "none",
            }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto" style={{ padding: 16 }}>
          {step === "review" && (
            <ReviewStep
              artistName={artistName}
              projectName={projectName}
              balanceDueCents={balanceDueCents}
              platformFeeCents={piData?.platformFeeCents || 0}
              totalCents={piData?.totalCents || balanceDueCents}
              depositPaidCents={piData?.depositPaidCents || 0}
              isLoading={createPI.isPending}
              error={createPI.error?.message}
              onProceed={handleProceed}
            />
          )}

          {step === "payment" && piData?.clientSecret && (
            <DotsCheckout
              clientSecret={piData.clientSecret}
              amountCents={piData.totalCents}
              onComplete={handlePaymentComplete}
              onBack={() => setStep("review")}
            />
          )}

          {step === "success" && <SuccessStep onDone={handleDone} />}
        </div>
      </div>
    </>
  );
}

// ── Review Step ──────────────────────────────────────────────

function ReviewStep({
  artistName,
  projectName,
  balanceDueCents,
  platformFeeCents,
  totalCents,
  depositPaidCents,
  isLoading,
  error,
  onProceed,
}: {
  artistName: string;
  projectName: string;
  balanceDueCents: number;
  platformFeeCents: number;
  totalCents: number;
  depositPaidCents: number;
  isLoading: boolean;
  error?: string;
  onProceed: () => void;
}) {
  const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <>
      {/* Info card */}
      <div
        style={{
          background: "#1A1A1E",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 14,
          padding: 14,
          marginBottom: 16,
        }}
      >
        <div className="text-[14px] font-semibold text-white mb-0.5">
          Balance · {projectName}
        </div>
        <div className="text-[12.5px] text-[#7A7A7A] mb-3">{artistName}</div>

        <div
          style={{
            height: 1,
            background: "rgba(255,255,255,0.08)",
            margin: "0 -14px",
            marginBottom: 12,
          }}
        />

        {/* Line items */}
        <div className="flex flex-col gap-2">
          {depositPaidCents > 0 && (
            <div className="flex justify-between text-[13px]">
              <span className="text-[#7A7A7A]">Deposit paid</span>
              <span style={{ color: "#4ade80" }}>−{fmt(depositPaidCents)}</span>
            </div>
          )}
          <div className="flex justify-between text-[13px]">
            <span className="text-[#7A7A7A]">Remaining balance</span>
            <span className="text-white">{fmt(balanceDueCents)}</span>
          </div>
          {platformFeeCents > 0 && (
            <div className="flex justify-between text-[13px]">
              <span className="text-[#7A7A7A]">Platform fee</span>
              <span className="text-[#7A7A7A]">{fmt(platformFeeCents)}</span>
            </div>
          )}
        </div>

        <div
          style={{
            height: 1,
            background: "rgba(255,255,255,0.08)",
            margin: "12px -14px",
          }}
        />

        {/* Total */}
        <div className="flex justify-between items-baseline">
          <span className="text-[14px] font-semibold text-white">
            Total due today
          </span>
          <span
            className="text-[20px] font-bold text-white"
            style={{ fontFamily: '"DM Sans", sans-serif' }}
          >
            {fmt(totalCents || balanceDueCents)}
          </span>
        </div>
      </div>

      {/* Footnote */}
      <p className="text-[12px] text-[#7A7A7A] mb-4 px-1">
        Paying the balance early locks in your session. This amount is
        non-refundable once the session has been completed.
      </p>

      {/* Error */}
      {error && (
        <div
          style={{
            background: "rgba(255,77,79,0.1)",
            border: "1px solid rgba(255,77,79,0.3)",
            borderRadius: 12,
            padding: "10px 14px",
            marginBottom: 12,
            color: "#ff4d4f",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {/* CTA */}
      <button
        onClick={onProceed}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-2 font-semibold transition-all active:scale-[0.98] disabled:opacity-60"
        style={{
          height: 52,
          borderRadius: 16,
          fontSize: 15,
          fontFamily: '"DM Sans", sans-serif',
          background: "#F8D057",
          color: "#1B1B1B",
          border: "none",
          cursor: isLoading ? "wait" : "pointer",
        }}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Preparing checkout…
          </>
        ) : (
          "Continue to secure checkout"
        )}
      </button>
    </>
  );
}

// ── Success Step ─────────────────────────────────────────────

function SuccessStep({ onDone }: { onDone: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-4">
      {/* Check circle */}
      <div
        className="flex items-center justify-center animate-in zoom-in-75 duration-300"
        style={{
          width: 62,
          height: 62,
          borderRadius: "50%",
          background: "rgba(74,222,128,0.14)",
          border: "1px solid rgba(74,222,128,0.4)",
        }}
      >
        <Check className="w-[30px] h-[30px]" style={{ color: "#4ade80" }} />
      </div>

      <h2
        className="text-[20px] font-bold text-white"
        style={{ fontFamily: '"DM Sans", sans-serif' }}
      >
        Balance paid
      </h2>

      <p className="text-[13.5px] text-[#7A7A7A] text-center max-w-[280px]">
        Your session is fully paid and locked in. See you at the studio!
      </p>

      <button
        onClick={onDone}
        className="w-full flex items-center justify-center font-semibold transition-all active:scale-[0.98] mt-4"
        style={{
          height: 52,
          borderRadius: 16,
          fontSize: 15,
          fontFamily: '"DM Sans", sans-serif',
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
