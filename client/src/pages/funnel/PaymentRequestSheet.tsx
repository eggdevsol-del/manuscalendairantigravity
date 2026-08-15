/**
 * PaymentRequestSheet — Public page at /pay/:token
 *
 * Client-facing payment page for artist-initiated charge requests.
 * Uses embedded Stripe Checkout (following BalanceSheet pattern).
 *
 * States:
 *   loading   → verifying token
 *   error     → invalid/expired/already-paid token
 *   ready     → shows session details + pay button
 *   checkout  → Stripe Checkout embed open
 *   success   → payment confirmed
 */

import { useState, useEffect, useCallback } from "react";
import { useRoute, useSearch } from "wouter";
import { Check, AlertCircle, Clock, Calendar } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";

const DT = {
  bg: "#0d0d0e",
  card: "#131314",
  cardBorder: "rgba(255,255,255,.08)",
  textPrimary: "rgba(255,255,255,.95)",
  textSecondary: "rgba(255,255,255,.55)",
  textTertiary: "rgba(255,255,255,.36)",
  green: "#34c759",
  amber: "#f2ca5c",
  amberOnColor: "#1a1a00",
  track: "rgba(255,255,255,.08)",
};

function formatCents(cents: number): string {
  const abs = Math.abs(cents);
  return `$${(abs / 100).toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function PaymentRequestSheet() {
  const [, params] = useRoute("/pay/:token");
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const token = params?.token || "";

  const paymentStatus = urlParams.get("status");

  // Fetch payment request info
  const { data, isLoading, isError } = trpc.funnel.getPaymentRequestInfo.useQuery(
    { token },
    { enabled: !!token }
  );

  const createCheckout = trpc.funnel.createPaymentRequestCheckout.useMutation();

  const [phase, setPhase] = useState<"loading" | "ready" | "checkout" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Process server response
  useEffect(() => {
    if (isLoading) return;

    if (isError) {
      setPhase("error");
      setErrorMessage("Unable to load payment request. Please try again.");
      return;
    }

    if (!data || "error" in data) {
      setPhase("error");
      const err = (data as any)?.error;
      if (err === "expired") setErrorMessage("This payment link has expired. Please ask your artist to send a new one.");
      else if (err === "already_paid") setErrorMessage("This payment has already been completed. ✓");
      else if (err === "cancelled") setErrorMessage("This payment request was cancelled.");
      else setErrorMessage("Invalid payment link.");
      return;
    }

    setPhase("ready");
  }, [data, isLoading, isError]);

  // Handle redirect back from Stripe success
  useEffect(() => {
    if (paymentStatus === "success") {
      setPhase("success");
    }
  }, [paymentStatus]);

  const handlePay = useCallback(async () => {
    if (!token) return;
    setIsSubmitting(true);
    try {
      const result = await createCheckout.mutateAsync({ token });
      if ("error" in result) {
        setErrorMessage((result as any).error === "already_paid"
          ? "This payment has already been completed."
          : "Failed to create checkout. Please try again.");
        setPhase("error");
        return;
      }
      if (result.url) {
        window.location.href = result.url;
      } else {
        setErrorMessage("Unable to start payment. Please try again.");
        setPhase("error");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Payment failed. Please try again.");
      setPhase("error");
    } finally {
      setIsSubmitting(false);
    }
  }, [token, createCheckout]);

  // ── Loading ───────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div style={{
        minHeight: "100vh", background: DT.bg,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 40, height: 40, borderRadius: 20,
            border: `3px solid ${DT.track}`, borderTopColor: DT.amber,
            animation: "spin 0.8s linear infinite", margin: "0 auto 16px",
          }} />
          <div style={{ fontSize: 14, color: DT.textSecondary }}>Verifying payment link…</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────
  if (phase === "error") {
    const isAlreadyPaid = errorMessage.includes("already been completed");
    return (
      <div style={{
        minHeight: "100vh", background: DT.bg,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}>
        <div style={{
          maxWidth: 400, width: "100%", textAlign: "center",
          background: DT.card, border: `1px solid ${DT.cardBorder}`,
          borderRadius: 20, padding: "40px 24px",
        }}>
          {isAlreadyPaid ? (
            <div style={{
              width: 56, height: 56, borderRadius: 28, background: DT.green,
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px",
            }}>
              <Check size={28} color="#fff" />
            </div>
          ) : (
            <div style={{
              width: 56, height: 56, borderRadius: 28, background: "rgba(255,59,48,.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px",
            }}>
              <AlertCircle size={28} color="#ff3b30" />
            </div>
          )}
          <div style={{ fontSize: 18, fontWeight: 600, color: DT.textPrimary, marginBottom: 8 }}>
            {isAlreadyPaid ? "Payment Complete" : "Link Unavailable"}
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.5, color: DT.textSecondary }}>
            {errorMessage}
          </div>
        </div>
      </div>
    );
  }

  // ── Success ───────────────────────────────────────────────
  if (phase === "success") {
    const info = data && !("error" in data) ? data : null;
    return (
      <div style={{
        minHeight: "100vh", background: DT.bg,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}>
        <div style={{
          maxWidth: 400, width: "100%", textAlign: "center",
          background: DT.card, border: `1px solid ${DT.cardBorder}`,
          borderRadius: 20, padding: "40px 24px",
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 32, background: DT.green,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px",
            animation: "popIn 0.4s cubic-bezier(.2,.7,.3,1.4)",
          }}>
            <Check size={32} color="#fff" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 600, color: DT.textPrimary, marginBottom: 8 }}>
            Payment Confirmed
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.5, color: DT.textSecondary }}>
            {info ? `${formatCents(info.amountCents)} paid to ${info.artistName}` : "Your payment has been processed."}
          </div>
          <div style={{ fontSize: 13, color: DT.textTertiary, marginTop: 16 }}>
            You can close this page.
          </div>
        </div>
        <style>{`@keyframes popIn { 0% { transform: scale(0); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }`}</style>
      </div>
    );
  }

  // ── Ready — show payment details ──────────────────────────
  const info = data && !("error" in data) ? data : null;
  if (!info) return null;

  const paidPct = info.totalPriceCents > 0
    ? Math.round((info.paidSoFarCents / info.totalPriceCents) * 100)
    : 0;

  // Parse session date
  let sessionDateDisplay = "";
  let sessionTimeDisplay = "";
  try {
    const d = new Date(info.sessionDate.replace(" ", "T") + "Z");
    sessionDateDisplay = format(d, "MMM d, yyyy");
    sessionTimeDisplay = format(d, "EEEE · h:mm a");
  } catch {
    sessionDateDisplay = "Date TBC";
    sessionTimeDisplay = "";
  }

  return (
    <div style={{
      minHeight: "100vh", background: DT.bg,
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: 20,
    }}>
      <div style={{
        maxWidth: 400, width: "100%",
        background: DT.card, border: `1px solid ${DT.cardBorder}`,
        borderRadius: 20, overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "28px 24px 24px", textAlign: "center" }}>
          {/* Artist avatar */}
          {info.artistImage ? (
            <img
              src={info.artistImage}
              alt={info.artistName}
              style={{
                width: 56, height: 56, borderRadius: 14, objectFit: "cover",
                margin: "0 auto 16px", display: "block",
              }}
            />
          ) : (
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: "rgba(255,255,255,.08)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px",
              fontSize: 18, fontWeight: 600, color: DT.textSecondary,
            }}>
              {info.artistName.split(" ").map(n => n[0]).join("").slice(0, 2)}
            </div>
          )}

          <div style={{ fontSize: 13, fontWeight: 500, color: DT.textSecondary, marginBottom: 4 }}>
            Payment Request
          </div>
          <div style={{ fontSize: 20, fontWeight: 600, color: DT.textPrimary }}>
            from {info.artistName}
          </div>
        </div>

        {/* Session details card */}
        <div style={{ padding: "0 20px" }}>
          <div style={{
            background: "rgba(255,255,255,.04)",
            border: `1px solid ${DT.cardBorder}`,
            borderRadius: 14, padding: "16px 18px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <Calendar size={16} color={DT.textTertiary} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: DT.textPrimary }}>
                  {sessionDateDisplay} · {info.serviceName}
                </div>
                {sessionTimeDisplay && (
                  <div style={{ fontSize: 12, color: DT.textTertiary, marginTop: 2 }}>
                    {sessionTimeDisplay}
                  </div>
                )}
              </div>
            </div>

            {/* Amount due */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginTop: 4,
            }}>
              <span style={{ fontSize: 14, color: DT.textSecondary }}>Amount due</span>
              <span style={{ fontSize: 22, fontWeight: 600, color: DT.textPrimary }}>
                {formatCents(info.amountCents)}
              </span>
            </div>

            {/* Progress bar */}
            {paidPct > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: DT.textTertiary }}>
                    {formatCents(info.paidSoFarCents)} of {formatCents(info.totalPriceCents)} paid
                  </span>
                  <span style={{ fontSize: 11, color: DT.green }}>{paidPct}%</span>
                </div>
                <div style={{ height: 4, borderRadius: 99, background: DT.track, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 99, background: DT.green,
                    width: `${paidPct}%`, transition: "width .4s",
                  }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Pay button */}
        <div style={{ padding: "20px 20px 24px" }}>
          <button
            onClick={handlePay}
            disabled={isSubmitting}
            style={{
              width: "100%", textAlign: "center",
              background: DT.amber, color: DT.amberOnColor,
              borderRadius: 14, padding: "16px 20px",
              fontSize: 16, fontWeight: 600, lineHeight: 1,
              border: "none", cursor: isSubmitting ? "wait" : "pointer",
              opacity: isSubmitting ? 0.7 : 1,
              transition: "opacity .2s",
            }}
          >
            {isSubmitting ? "Opening Stripe…" : `Pay ${formatCents(info.amountCents)}`}
          </button>

          <div style={{
            textAlign: "center", marginTop: 14,
            fontSize: 11, color: DT.textTertiary,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
          }}>
            <Clock size={11} /> Secure payment powered by Stripe
          </div>
        </div>
      </div>

      {/* Branding */}
      <div style={{ marginTop: 24, fontSize: 12, color: DT.textTertiary, textAlign: "center" }}>
        Powered by Tattoi
      </div>
    </div>
  );
}

export default PaymentRequestSheet;
