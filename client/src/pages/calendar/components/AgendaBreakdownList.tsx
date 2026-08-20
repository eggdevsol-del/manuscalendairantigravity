import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { format, addDays, startOfDay, isToday, getDay } from "date-fns";
import { Plus, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { tokens } from "@/ui/tokens";
import {
  formatLocalTime,
  getBusinessTimezone,
} from "../../../../../shared/utils/timezone";
import { getEventStyle } from "../utils/styles";
import { useAuth } from "@/_core/hooks/useAuth";

interface AgendaBreakdownListProps {
  eventsByDay: Record<string, any[]>;
  workSchedule?: any;
  activeArtists?: any[];
  onAppointmentTap?: (apt: any) => void;
  onDateTap?: (date: Date) => void;
  onCancelSession?: (apt: any) => void;
}

const INITIAL_DAYS = 30;
const LOAD_MORE_DAYS = 30;
const LOAD_THRESHOLD_PX = 200;

const dayKeys = [
  "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
];

export function AgendaBreakdownList({
  eventsByDay,
  workSchedule,
  activeArtists = [],
  onAppointmentTap,
  onDateTap,
  onCancelSession,
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

  // Filter to only dates with events (for a cleaner agenda)
  const datesWithEvents = useMemo(() => {
    return visibleDates.filter(date => {
      const dateKey = format(date, "yyyy-MM-dd");
      const events = eventsByDay[dateKey];
      return events && events.length > 0;
    });
  }, [visibleDates, eventsByDay]);

  // Seamless infinite scroll — load more days when near bottom
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
      className="flex-1 overflow-y-auto px-4 pb-40"
    >
      {datesWithEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
          <p className="text-sm">No upcoming sessions</p>
        </div>
      ) : (
        datesWithEvents.map(date => {
          const dateKey = format(date, "yyyy-MM-dd");
          const dayEvents = eventsByDay[dateKey] || [];
          const isTdy = isToday(date);

          return (
            <div key={dateKey} className="py-3">
              {/* Day Header */}
              <div className="flex justify-between items-center mb-2">
                <div>
                  <h2 className={cn("text-base font-bold", isTdy ? "text-primary" : "text-foreground")}>
                    {format(date, "EEEE")}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {format(date, "d MMMM yyyy")}
                  </p>
                </div>
              </div>

              {/* Session Cards */}
              <div className="flex flex-col gap-2">
                {dayEvents.map((apt: any) => {
                  const style = getEventStyle(apt);
                  return (
                    <div
                      key={apt.id}
                      className={cn(
                        tokens.calendar.eventCard.base,
                        tokens.calendar.eventCard.bg,
                        tokens.calendar.eventCard.interactive,
                        tokens.calendar.eventCard.padding,
                        "shadow-sm flex flex-col gap-1 cursor-pointer active:scale-[0.98] transition-transform relative",
                        style.className,
                      )}
                    >
                      {/* Main card area — tap to open */}
                      <div onClick={() => onAppointmentTap?.(apt)}>
                        <div className="font-bold text-sm z-10 relative truncate pr-8">
                          {apt.title}
                        </div>
                        <div className="text-xs opacity-70 flex justify-between z-10 relative">
                          <span className="truncate">
                            {formatLocalTime(apt.startTime, getBusinessTimezone(), "h:mm a")}
                          </span>
                          <span className="truncate ml-1 text-right">
                            {apt.clientName || ""}
                          </span>
                        </div>
                      </div>

                      {/* Cancel button — artist only, non-cancelled appointments */}
                      {isArtist && apt.status !== "cancelled" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onCancelSession?.(apt);
                          }}
                          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-destructive/10 hover:bg-destructive/20 flex items-center justify-center transition-colors z-20"
                        >
                          <X className="w-3 h-3 text-destructive" />
                        </button>
                      )}

                      {/* Status Overlay */}
                      {apt.status === "completed" && (
                        <div className="absolute top-2 right-10 flex items-center gap-1.5 px-2 py-0.5 bg-[var(--color-status-neutral-bg)] text-[var(--color-status-neutral-text)] rounded-full border border-[var(--color-status-neutral-border)] z-20">
                          <CheckCircle2 className="w-3 h-3" />
                        </div>
                      )}

                      {apt.status === "cancelled" && (
                        <div className="absolute inset-0 bg-background/60 rounded-[inherit] flex items-center justify-center z-20">
                          <span className="text-xs font-bold text-destructive uppercase tracking-wider">Cancelled</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      {/* Invisible trigger for loading more */}
      <div className="h-4" />
    </div>
  );
}
