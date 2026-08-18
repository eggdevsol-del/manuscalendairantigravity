import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import {
  Calendar,
  CreditCard,
  MessageCircle,
  Search,
} from "lucide-react";
import { BalanceCheckoutSheet } from "./BalanceCheckoutSheet";

/** Relative countdown helper: "IN 6 DAYS", "TOMORROW", "TODAY" */
function getCountdown(startsAt: string): string {
  const start = new Date(startsAt);
  const now = new Date();
  const diffMs = start.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "TODAY";
  if (diffDays === 1) return "TOMORROW";
  return `IN ${diffDays} DAYS`;
}

/** Format date: "AUG 23, 2026 · 11:00 AM" */
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const month = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const day = d.getDate();
  const year = d.getFullYear();
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).toUpperCase();
  return `${month} ${day}, ${year} · ${time}`;
}

/** Format relative time: "Requested 2 days ago" */
function getRelativeTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Requested today";
  if (diffDays === 1) return "Requested yesterday";
  return `Requested ${diffDays} days ago`;
}

/** Format duration */
function formatDuration(minutes: number | null): string {
  if (!minutes) return "";
  const hrs = Math.round(minutes / 60);
  return `${hrs} hr${hrs !== 1 ? "s" : ""}`;
}

export function UpcomingTab() {
  const [, setLocation] = useLocation();
  const { data, isLoading } = trpc.appointments.getClientBookings.useQuery({
    tab: "upcoming",
  });

  // Balance checkout sheet state
  const [balanceSheet, setBalanceSheet] = useState<{
    open: boolean;
    appointmentId: number;
    balanceDueCents: number;
    artistName: string;
    projectName: string;
  }>({ open: false, appointmentId: 0, balanceDueCents: 0, artistName: "", projectName: "" });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div
          className="w-6 h-6 border-2 border-white/20 border-t-white/70 rounded-full animate-spin"
        />
      </div>
    );
  }

  const appointments = data?.appointments || [];
  const pendingConsults = data?.pendingConsults || [];

  // Empty state
  if (appointments.length === 0 && pendingConsults.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Calendar className="w-10 h-10 text-white/20" />
        <p className="text-[13.5px] text-[#7A7A7A] text-center max-w-[220px]">
          No upcoming sessions. Find an artist to start your next piece.
        </p>
        <button
          onClick={() => setLocation("/discover")}
          className="flex items-center gap-2 px-5 py-3 rounded-xl text-[13.5px] font-semibold"
          style={{
            background: "#F8D057",
            color: "#1B1B1B",
            minHeight: 44,
          }}
        >
          <Search className="w-4 h-4" />
          Find an artist
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {/* Confirmed appointments */}
        {appointments.map((appt, index) => {
          const isNext = index === 0 && appt.status === "confirmed";
          const isConfirmed = appt.status === "confirmed";
          const hasBalance = (appt.balanceDueCents || 0) > 0;
          const hasPaymentRequest = !!appt.paymentRequest;

          return (
            <div
              key={appt.id}
              className="relative overflow-hidden"
              style={{
                background: "#1A1A1E",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 16,
                padding: 16,
              }}
            >
              {/* "IN X DAYS" badge — only on the next confirmed session */}
              {isNext && isConfirmed && (
                <div
                  className="absolute top-0 right-0 text-[10px] font-bold uppercase tracking-wide"
                  style={{
                    background: "#F8D057",
                    color: "#1B1B1B",
                    padding: "5px 12px",
                    borderBottomLeftRadius: 12,
                    letterSpacing: "0.06em",
                  }}
                >
                  {getCountdown(appt.startsAt)}
                </div>
              )}

              {/* Date line */}
              <div
                className="text-[12px] font-bold uppercase mb-1"
                style={{
                  color: isNext && isConfirmed ? "#F8D057" : "#7A7A7A",
                  letterSpacing: "0.06em",
                }}
              >
                {formatDate(appt.startsAt)}
              </div>

              {/* Title */}
              <h3 className="text-[16px] font-bold text-white mb-0.5">
                {appt.projectName || appt.title}
                {appt.sessionIndex && appt.sessionTotal
                  ? ` — session ${appt.sessionIndex}`
                  : ""}
              </h3>

              {/* Meta */}
              <p className="text-[13.5px] text-[#7A7A7A] mb-3">
                {appt.artist.name}
                {appt.durationMinutes ? ` · ${formatDuration(appt.durationMinutes)}` : ""}
                {appt.studioName ? ` · ${appt.studioName}` : ""}
                {appt.sessionIndex && appt.sessionTotal
                  ? ` · session ${appt.sessionIndex} of ${appt.sessionTotal}`
                  : ""}
              </p>

              {/* Deposit / Estimate stats — only on next confirmed */}
              {isNext && isConfirmed && (
                <div className="flex gap-[22px] mb-3">
                  {appt.depositPaidCents > 0 && (
                    <div>
                      <div
                        className="text-[10px] font-bold uppercase text-[#7A7A7A] mb-0.5"
                        style={{ letterSpacing: "0.06em" }}
                      >
                        Deposit
                      </div>
                      <div className="text-[12.5px] font-medium text-white">
                        ${(appt.depositPaidCents / 100).toFixed(0)} paid
                      </div>
                    </div>
                  )}
                  {appt.estimateCents > 0 && (
                    <div>
                      <div
                        className="text-[10px] font-bold uppercase text-[#7A7A7A] mb-0.5"
                        style={{ letterSpacing: "0.06em" }}
                      >
                        Estimate
                      </div>
                      <div className="text-[12.5px] font-medium text-white">
                        ${(appt.estimateCents / 100).toFixed(0)}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Payment request banner */}
              {hasBalance && (
                <button
                  onClick={() => {
                    setBalanceSheet({
                      open: true,
                      appointmentId: appt.id,
                      balanceDueCents: appt.balanceDueCents,
                      artistName: appt.artist.name,
                      projectName: appt.projectName || appt.title || "Session",
                    });
                  }}
                  className="flex items-center justify-between w-full mb-3"
                  style={{
                    borderRadius: 12,
                    padding: "12px 14px",
                    background: hasPaymentRequest
                      ? "rgba(242,202,92,0.12)"
                      : "rgba(255,255,255,0.04)",
                    border: hasPaymentRequest
                      ? "1px solid rgba(242,202,92,0.3)"
                      : "1px solid rgba(255,255,255,0.08)",
                    minHeight: 44,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <CreditCard
                      className="w-4 h-4"
                      style={{ color: hasPaymentRequest ? "#f2ca5c" : "#7A7A7A" }}
                    />
                    <span
                      className="text-[13.5px] font-semibold"
                      style={{ color: hasPaymentRequest ? "#f2ca5c" : "rgba(255,255,255,.7)" }}
                    >
                      ${(appt.balanceDueCents / 100).toFixed(0)}{" "}
                      {hasPaymentRequest ? "payment requested" : "remaining balance"}
                    </span>
                  </div>
                  <span
                    className="text-[11px] font-bold uppercase"
                    style={{
                      color: hasPaymentRequest ? "#1B1B1B" : "rgba(255,255,255,.7)",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {hasPaymentRequest ? "PAY NOW" : "PAY EARLY"}
                  </span>
                </button>
              )}

              {/* Footer buttons — only on confirmed sessions */}
              {isConfirmed && (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (appt.conversationId) {
                        setLocation(`/chat/${appt.conversationId}`);
                      }
                    }}
                    className="flex-1 flex items-center justify-center gap-2 text-[13.5px] font-semibold text-white"
                    style={{
                      height: 44,
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "transparent",
                    }}
                  >
                    Message
                  </button>
                  <button
                    onClick={() => {
                      // Opens the message thread for reschedule (MVP — later: in-chat card)
                      if (appt.conversationId) {
                        setLocation(`/chat/${appt.conversationId}`);
                      }
                    }}
                    className="flex-1 flex items-center justify-center gap-2 text-[13.5px] font-semibold"
                    style={{
                      height: 44,
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "transparent",
                      color: "rgba(255,255,255,.58)",
                    }}
                  >
                    Reschedule
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Pending consult requests — dashed variant */}
        {pendingConsults.map((consult) => (
          <div
            key={`consult-${consult.id}`}
            className="flex items-center justify-between"
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px dashed rgba(255,255,255,0.12)",
              borderRadius: 16,
              padding: 16,
            }}
          >
            <div>
              <div className="text-[13.5px] font-semibold text-white">
                Consult with {consult.artistName}
              </div>
              <div className="text-[12.5px] text-[#7A7A7A]">
                {getRelativeTime(consult.createdAt || "")} · awaiting reply
              </div>
            </div>
            <span
              className="text-[11px] font-bold uppercase shrink-0"
              style={{
                color: "#f2ca5c",
                border: "1px solid rgba(242,202,92,0.4)",
                borderRadius: 999,
                padding: "4px 9px",
                letterSpacing: "0.06em",
              }}
            >
              PENDING
            </span>
          </div>
        ))}
      </div>

      {/* Balance checkout sheet */}
      <BalanceCheckoutSheet
        open={balanceSheet.open}
        onClose={() => setBalanceSheet(prev => ({ ...prev, open: false }))}
        appointmentId={balanceSheet.appointmentId}
        balanceDueCents={balanceSheet.balanceDueCents}
        artistName={balanceSheet.artistName}
        projectName={balanceSheet.projectName}
      />
    </>
  );
}
