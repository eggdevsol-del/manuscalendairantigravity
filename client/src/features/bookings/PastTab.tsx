import React from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { AftercareTimeline } from "./AftercareTimeline";

/** Format date: "JUL 12, 2026" */
function formatPastDate(dateStr: string): string {
  const d = new Date(dateStr);
  const month = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  return `${month} ${d.getDate()}, ${d.getFullYear()}`;
}

/** Format duration */
function formatDuration(minutes: number | null): string {
  if (!minutes) return "";
  const hrs = Math.round(minutes / 60);
  return `${hrs} hr${hrs !== 1 ? "s" : ""}`;
}

/** Check if a completed appointment is within the 42-day healing window */
function isWithinHealingWindow(completedAt: string | null): boolean {
  if (!completedAt) return false;
  const completed = new Date(completedAt);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - completed.getTime()) / (1000 * 60 * 60 * 24)
  );
  return diffDays <= 42;
}

export function PastTab() {
  const [, setLocation] = useLocation();
  const { data, isLoading } = trpc.appointments.getClientBookings.useQuery({
    tab: "past",
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
      </div>
    );
  }

  const appointments = data?.appointments || [];

  // Empty state
  if (appointments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-2">
        <p className="text-[13.5px] text-[#7A7A7A] text-center">
          No completed sessions yet.
        </p>
      </div>
    );
  }

  // Find the most recent appointment within the healing window for top aftercare
  const healingAppointment = appointments.find(
    (appt) => appt.completedAt && isWithinHealingWindow(appt.completedAt)
  );

  return (
    <div className="flex flex-col gap-3">
      {/* ── Aftercare block — top of tab ──────────────────────────── */}
      {healingAppointment && (
        <div
          style={{
            background: "#1A1A1E",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16,
            padding: 16,
          }}
        >
          {/* Context: which project this aftercare is for */}
          <div className="flex items-center justify-between mb-2">
            <span
              className="text-[12px] font-bold uppercase"
              style={{ color: "#7A7A7A", letterSpacing: "0.06em" }}
            >
              {healingAppointment.artist.name}
            </span>
            <span className="text-[12px] text-[#7A7A7A]">
              {healingAppointment.projectName || healingAppointment.title}
            </span>
          </div>

          <AftercareTimeline
            appointmentId={healingAppointment.id}
            completedAt={healingAppointment.completedAt!}
            artistId={healingAppointment.artist.id}
            artistName={healingAppointment.artist.name}
            conversationId={healingAppointment.conversationId}
          />
        </div>
      )}

      {/* ── Past appointment cards ────────────────────────────────── */}
      {appointments.map((appt) => (
        <div
          key={appt.id}
          style={{
            background: "#1A1A1E",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16,
            padding: 16,
          }}
        >
          {/* Date line */}
          <div
            className="text-[12px] font-bold uppercase mb-1"
            style={{ color: "#7A7A7A", letterSpacing: "0.06em" }}
          >
            {formatPastDate(appt.startsAt)}
          </div>

          {/* Title */}
          <h3 className="text-[16px] font-bold text-white mb-0.5">
            {appt.projectName || appt.title}
            {appt.sessionIndex ? ` — session ${appt.sessionIndex}` : ""}
          </h3>

          {/* Meta */}
          <p className="text-[13.5px] text-[#7A7A7A] mb-3">
            {appt.artist.name}
            {appt.durationMinutes ? ` · ${formatDuration(appt.durationMinutes)}` : ""}
            {appt.amountPaidCents > 0
              ? ` · $${(appt.amountPaidCents / 100).toFixed(0)} paid in full`
              : ""}
          </p>

          {/* Book a touch-up button */}
          <button
            onClick={() => {
              // MVP: navigate to message thread to request touch-up
              if (appt.conversationId) {
                setLocation(`/chat/${appt.conversationId}`);
              }
            }}
            className="flex items-center justify-center w-full mt-3 text-[13.5px] font-semibold text-white"
            style={{
              height: 44,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "transparent",
            }}
          >
            Book a touch-up
          </button>
        </div>
      ))}
    </div>
  );
}
