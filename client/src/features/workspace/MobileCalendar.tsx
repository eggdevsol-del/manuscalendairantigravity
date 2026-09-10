import { addDays, format, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui";
import { bookingTime, statusLabel } from "./bookingPresentation";
import type { useCalendarAgendaController } from "@/pages/calendar/hooks/useCalendarAgendaController";
export function MobileCalendar({
  controller: c,
}: {
  controller: ReturnType<typeof useCalendarAgendaController>;
}) {
  const start = startOfWeek(c.activeDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const events = (
    c.eventsByDay[format(c.activeDate, "yyyy-MM-dd")] || []
  ).filter((a: any) => a.status !== "cancelled");
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-4 flex items-center justify-between gap-2 mb-3">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Previous week"
          onClick={() => c.handleDateTap(addDays(c.activeDate, -7))}
        >
          <ChevronLeft />
        </Button>
        <label className="text-center text-sm font-medium">
          {format(c.activeDate, "MMMM yyyy")}
          <input
            aria-label="Go to date"
            type="date"
            value={format(c.activeDate, "yyyy-MM-dd")}
            onChange={e => {
              if (e.target.value)
                c.handleDateTap(new Date(e.target.value + "T12:00:00"));
            }}
            className="block bg-transparent text-xs text-muted-foreground mx-auto min-h-10"
          />
        </label>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Next week"
          onClick={() => c.handleDateTap(addDays(c.activeDate, 7))}
        >
          <ChevronRight />
        </Button>
      </div>
      <div className="grid grid-cols-7 px-4 gap-1 mb-5">
        {days.map(day => {
          const active =
            format(day, "yyyy-MM-dd") === format(c.activeDate, "yyyy-MM-dd");
          return (
            <button
              key={day.toISOString()}
              aria-label={format(day, "EEEE d MMMM")}
              aria-pressed={active}
              onClick={() => c.handleDateTap(day)}
              className={`rounded-xl min-h-16 py-2 ${active ? "bg-accent text-foreground" : "text-muted-foreground"}`}
            >
              <span className="block text-xs mb-1">{format(day, "EEEEE")}</span>
              <strong className="text-lg">{format(day, "d")}</strong>
            </button>
          );
        })}
      </div>
      <div className="workspace-scroll">
        <div className="workspace-content">
          <div className="flex justify-between items-center">
            <h2 className="workspace-section-title !mb-0">
              {format(c.activeDate, "EEEE d MMMM")}
            </h2>
            <Button variant="ghost" onClick={() => c.handleDateTap(new Date())}>
              Today
            </Button>
          </div>
          {events.map((a: any) => (
            <button
              className="workspace-menu-row w-full text-left"
              key={a.id}
              onClick={() => c.handleAppointmentTap(a)}
            >
              <time className="text-sm text-muted-foreground w-12 shrink-0">
                {bookingTime(
                  a.startTime,
                  Intl.DateTimeFormat().resolvedOptions().timeZone
                )}
              </time>
              <span className="flex-1 min-w-0">
                <strong className="block">
                  {a.clientName || a.client?.name || a.title}
                </strong>
                <span className="block text-sm text-muted-foreground mt-1">
                  {a.title}
                </span>
                <span className="block text-xs text-muted-foreground mt-1">
                  {statusLabel(a.status)} · Until{" "}
                  {bookingTime(
                    a.endTime,
                    Intl.DateTimeFormat().resolvedOptions().timeZone
                  )}
                </span>
              </span>
              <ChevronRight size={18} />
            </button>
          ))}
          {!events.length && !c.isLoading && !c.error && (
            <div className="workspace-card mt-4">
              <h3 className="font-semibold">Nothing booked this day</h3>
              <p className="workspace-subtitle">
                Add a booking or leave room for design time.
              </p>
            </div>
          )}
          <Button
            variant="outline"
            className="w-full mt-5"
            onClick={() => c.startBooking(c.activeDate)}
          >
            <Plus />
            {c.isRescheduling ? "Move session to this day" : "Add booking"}
          </Button>
        </div>
      </div>
    </div>
  );
}
