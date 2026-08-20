import { useState, useRef, useCallback, useMemo } from "react";
import { format, addDays, startOfDay, isToday } from "date-fns";
import { CreditCard, X } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

interface AgendaBreakdownListProps {
  eventsByDay: Record<string, any[]>;
  workSchedule?: any;
  activeArtists?: any[];
  onAppointmentTap?: (apt: any) => void;
  onDateTap?: (date: Date) => void;
  onCancelSession?: (apt: any) => void;
  onMessageClient?: (apt: any) => void;
  onReschedule?: (apt: any) => void;
}

const INITIAL_DAYS = 30;
const LOAD_MORE_DAYS = 30;
const LOAD_THRESHOLD_PX = 200;

/** Relative countdown: "TODAY", "TOMORROW", "IN 6 DAYS" */
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
function formatCardDate(dateStr: string): string {
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

/** Format duration */
function formatDuration(startTime: string, endTime: string): string {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hrs = Math.round(minutes / 60);
  return `${hrs} hr${hrs !== 1 ? "s" : ""}`;
}

export function AgendaBreakdownList({
  eventsByDay,
  onAppointmentTap,
  onCancelSession,
  onMessageClient,
  onReschedule,
}: AgendaBreakdownListProps) {
  const { user } = useAuth();
  const isArtist = user?.role === "artist" || user?.role === "admin";
  const [visibleDays, setVisibleDays] = useState(INITIAL_DAYS);
  const scrollRef = useRef<HTMLDivElement>(null);

  const today = useMemo(() => startOfDay(new Date()), []);

  // Generate visible dates from today
  const visibleDates = useMemo(() => {
    return Array.from({ length: visibleDays }, (_, i) => addDays(today, i));
  }, [today, visibleDays]);

  // Collect all events across visible dates, sorted chronologically
  const allEvents = useMemo(() => {
    const events: any[] = [];
    for (const date of visibleDates) {
      const dateKey = format(date, "yyyy-MM-dd");
      const dayEvents = eventsByDay[dateKey];
      if (dayEvents && dayEvents.length > 0) {
        events.push(...dayEvents);
      }
    }
    return events;
  }, [visibleDates, eventsByDay]);

  // Seamless infinite scroll
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (remaining < LOAD_THRESHOLD_PX) {
      setVisibleDays(prev => prev + LOAD_MORE_DAYS);
    }
  }, []);

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-4 pb-40 pt-4"
    >
      {allEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
          <p className="text-sm">No upcoming sessions</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {allEvents.map((apt: any, index: number) => {
            if (!apt || apt.clientId === "external-sync") return null;

            const isNext = index === 0 && apt.status === "confirmed";
            const isConfirmed = apt.status === "confirmed";
            const isCancelled = apt.status === "cancelled";

            // Compute values from artist calendar data shape
            const depositPaidCents = apt.depositPaid
              ? (apt.depositAmount || 0) * 100
              : 0;
            const estimateCents = apt.totalExpectedAmountCents || (apt.price ? apt.price * 100 : 0);
            const balanceDueCents = apt.remainingBalanceCents || 0;
            const durationStr = apt.startTime && apt.endTime
              ? formatDuration(apt.startTime, apt.endTime)
              : "";

            return (
              <div
                key={apt.id}
                className="relative overflow-hidden"
                style={{
                  background: "#1A1A1E",
                  border: isCancelled
                    ? "1px solid rgba(255,80,80,0.15)"
                    : "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 16,
                  padding: 16,
                  opacity: isCancelled ? 0.5 : 1,
                }}
              >
                {/* Countdown badge — only on the next confirmed session */}
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
                    {getCountdown(apt.startTime)}
                  </div>
                )}

                {/* Cancel X button — artist only, non-cancelled */}
                {isArtist && !isCancelled && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCancelSession?.(apt);
                    }}
                    className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center transition-colors z-20"
                    style={{
                      background: "rgba(255,80,80,0.1)",
                    }}
                  >
                    <X className="w-3.5 h-3.5" style={{ color: "#ff5050" }} />
                  </button>
                )}

                {/* Tappable card body */}
                <div onClick={() => onAppointmentTap?.(apt)} className="cursor-pointer">
                  {/* Date line */}
                  <div
                    className="text-[12px] font-bold uppercase mb-1"
                    style={{
                      color: isNext && isConfirmed ? "#F8D057" : "#7A7A7A",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {formatCardDate(apt.startTime)}
                  </div>

                  {/* Title */}
                  <h3 className="text-[16px] font-bold text-white mb-0.5 pr-8">
                    {apt.projectName || apt.title}
                    {apt.sessionIndex && apt.sessionTotal
                      ? ` — session ${apt.sessionIndex}`
                      : ""}
                  </h3>

                  {/* Meta line */}
                  <p className="text-[13.5px] text-[#7A7A7A] mb-3">
                    {apt.clientName || "Client"}
                    {durationStr ? ` · ${durationStr}` : ""}
                    {apt.sessionIndex && apt.sessionTotal
                      ? ` · session ${apt.sessionIndex} of ${apt.sessionTotal}`
                      : ""}
                  </p>

                  {/* Deposit / Estimate stats — only on next confirmed */}
                  {isNext && isConfirmed && (
                    <div className="flex gap-[22px] mb-3">
                      {depositPaidCents > 0 && (
                        <div>
                          <div
                            className="text-[10px] font-bold uppercase text-[#7A7A7A] mb-0.5"
                            style={{ letterSpacing: "0.06em" }}
                          >
                            Deposit
                          </div>
                          <div className="text-[12.5px] font-medium text-white">
                            ${(depositPaidCents / 100).toFixed(0)} paid
                          </div>
                        </div>
                      )}
                      {estimateCents > 0 && (
                        <div>
                          <div
                            className="text-[10px] font-bold uppercase text-[#7A7A7A] mb-0.5"
                            style={{ letterSpacing: "0.06em" }}
                          >
                            Estimate
                          </div>
                          <div className="text-[12.5px] font-medium text-white">
                            ${(estimateCents / 100).toFixed(0)}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Remaining balance bar */}
                {balanceDueCents > 0 && !isCancelled && (
                  <div
                    className="flex items-center justify-between w-full mb-3"
                    style={{
                      borderRadius: 12,
                      padding: "12px 14px",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      minHeight: 44,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4" style={{ color: "#7A7A7A" }} />
                      <span
                        className="text-[13.5px] font-semibold"
                        style={{ color: "rgba(255,255,255,.7)" }}
                      >
                        ${(balanceDueCents / 100).toFixed(0)} remaining balance
                      </span>
                    </div>
                  </div>
                )}

                {/* Cancelled overlay */}
                {isCancelled && (
                  <div
                    className="text-[10px] font-bold uppercase tracking-wider mt-1"
                    style={{ color: "#ff5050", letterSpacing: "0.06em" }}
                  >
                    CANCELLED
                  </div>
                )}

                {/* Footer buttons — only on confirmed sessions */}
                {isConfirmed && (
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onMessageClient?.(apt);
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
                      onClick={(e) => {
                        e.stopPropagation();
                        onReschedule?.(apt);
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
        </div>
      )}

      {/* Invisible trigger for loading more */}
      <div className="h-4" />
    </div>
  );
}
