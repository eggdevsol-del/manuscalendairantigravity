import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { SessionPlanCheckoutSheet } from "../../bookings/SessionPlanCheckoutSheet";

interface SessionPlanCardProps {
  sessionPlanId: number;
  sessionCount: number;
  totalEstimateCents: number;
  depositTotalCents: number;
  sessions: Array<{
    sessionIndex: number;
    startsAt: string;
    durationMinutes: number;
    estimateCents: number;
    depositCents: number;
  }>;
  isOwnMessage: boolean; // true if the current user sent this (artist)
  conversationId: number;
}

/** Format date: "Sat 23 Aug · 11:00 am" */
function formatSessionDate(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.toLocaleDateString("en-AU", { weekday: "short" });
  const date = d.getDate();
  const month = d.toLocaleDateString("en-AU", { month: "short" });
  const time = d.toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).toLowerCase();
  return `${day} ${date} ${month} · ${time}`;
}

export function SessionPlanCard({
  sessionPlanId,
  sessionCount,
  totalEstimateCents,
  depositTotalCents,
  sessions,
  isOwnMessage,
  conversationId,
}: SessionPlanCardProps) {
  const [showCheckout, setShowCheckout] = useState(false);

  // Get current plan status from server
  const { data: plan } = trpc.sessionPlans.getById.useQuery(
    { sessionPlanId },
    { staleTime: 5000 }
  );
  const utils = trpc.useUtils();

  const declineMutation = trpc.sessionPlans.decline.useMutation({
    onSuccess: () => {
      utils.sessionPlans.getById.invalidate({ sessionPlanId });
      utils.sessionPlans.getByConversation.invalidate({ conversationId });
    },
  });

  const status = plan?.status || "pending";
  const isAccepted = status === "accepted";
  const isDeclined = status === "declined";
  const isWithdrawn = status === "withdrawn";
  const isPending = status === "pending";

  return (
    <>
      <div
        className="w-full"
        style={{
          maxWidth: "88%",
          alignSelf: "flex-start",
          background: "#1A1A1E",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 16,
          padding: 14,
          animation: "sessionPlanPop 300ms ease-out",
        }}
      >
        {/* Eyebrow */}
        <div
          className="text-[10px] font-bold uppercase mb-1"
          style={{ color: "#7A7A7A", letterSpacing: "0.08em" }}
        >
          SESSION PLAN
        </div>

        {/* Headline */}
        <h3
          className="text-[18px] font-bold text-white mb-3"
          style={{ marginTop: 5 }}
        >
          {sessionCount} session{sessionCount !== 1 ? "s" : ""} ·{" "}
          ${(totalEstimateCents / 100).toLocaleString("en-AU", {
            minimumFractionDigits: 0,
          })}
        </h3>

        {/* Session rows */}
        <div className="flex flex-col gap-2 mb-3">
          {sessions.map((session) => (
            <div key={session.sessionIndex} className="flex items-center gap-2">
              {/* Index badge */}
              <div
                className="flex items-center justify-center shrink-0 text-[12px] font-bold text-white"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "#232326",
                  border: "1px solid rgba(255,255,255,0.12)",
                }}
              >
                {session.sessionIndex}
              </div>

              {/* Date/time */}
              <span className="flex-1 text-[13.5px] text-white">
                {formatSessionDate(session.startsAt)}
              </span>

              {/* Duration chip */}
              <span
                className="text-[11px] font-bold shrink-0"
                style={{
                  color: "#F8D057",
                  background: "rgba(248,208,87,0.1)",
                  borderRadius: 6,
                  padding: "4px 7px",
                }}
              >
                {Math.round(session.durationMinutes / 60)} hrs
              </span>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        {isPending && !isOwnMessage && (
          <div className="flex gap-2">
            <button
              onClick={() => declineMutation.mutate({ sessionPlanId })}
              disabled={declineMutation.isPending}
              className="flex-1 flex items-center justify-center text-[13.5px] font-semibold"
              style={{
                height: 44,
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "transparent",
                color: "rgba(255,255,255,.58)",
              }}
            >
              Decline
            </button>
            <button
              onClick={() => setShowCheckout(true)}
              className="flex-1 flex items-center justify-center text-[13.5px] font-semibold"
              style={{
                height: 44,
                borderRadius: 12,
                border: "none",
                background: "#F8D057",
                color: "#1B1B1B",
              }}
            >
              Accept plan
            </button>
          </div>
        )}

        {/* Accepted state */}
        {isAccepted && (
          <button
            disabled
            className="w-full flex items-center justify-center text-[13.5px] font-semibold"
            style={{
              height: 44,
              borderRadius: 12,
              background: "rgba(74,222,128,0.15)",
              color: "#4ade80",
              border: "none",
            }}
          >
            Accepted
          </button>
        )}

        {/* Declined state */}
        {isDeclined && (
          <div className="text-center text-[13px] text-[#7A7A7A] py-2">
            Plan declined
          </div>
        )}

        {/* Withdrawn state */}
        {isWithdrawn && (
          <div className="text-center text-[13px] text-[#7A7A7A] py-2">
            Plan withdrawn by artist
          </div>
        )}

        {/* Artist view of pending — no actions, just status */}
        {isPending && isOwnMessage && (
          <div className="text-center text-[13px] text-[#7A7A7A] py-2">
            Waiting for client to respond
          </div>
        )}
      </div>

      {/* Checkout sheet */}
      {showCheckout && (
        <SessionPlanCheckoutSheet
          sessionPlanId={sessionPlanId}
          onClose={() => setShowCheckout(false)}
          conversationId={conversationId}
        />
      )}

      {/* Pop animation keyframes */}
      <style>{`
        @keyframes sessionPlanPop {
          0% { transform: scale(0.7); opacity: 0; }
          70% { transform: scale(1.12); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </>
  );
}
