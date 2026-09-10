import { calendarLanes } from "./calendarLayout";
import { useMemo, useState } from "react";
import { addDays, startOfWeek, format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  CalendarDays,
  MessageCircle,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui";
import { trpc } from "@/lib/trpc";
import {
  bookingTime,
  money,
  instant,
  statusLabel,
} from "./bookingPresentation";
import type { useCalendarAgendaController } from "@/pages/calendar/hooks/useCalendarAgendaController";
type Controller = ReturnType<typeof useCalendarAgendaController>;
export function WeekCalendar({ controller: c }: { controller: Controller }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [artistId, setArtistId] = useState("");
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const start = startOfWeek(c.activeDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const events = useMemo(
    () =>
      Object.values(c.eventsByDay)
        .flat()
        .filter(
          (a: any) =>
            a.status !== "cancelled" && (!artistId || a.artistId === artistId)
        ),
    [c.eventsByDay, artistId]
  );
  const selected = events.find((a: any) => a.id === selectedId);
  const summary = trpc.projects.summary.useQuery(
    { conversationId: selected?.conversationId || 0 },
    { enabled: !!selected?.conversationId }
  );
  const forms =
    summary.data?.forms.filter(f => f.appointmentId === selectedId) || [];
  const session = summary.data?.sessions.find(s => s.id === selectedId);
  const hourValues = events
    .filter((a: any) =>
      days.some(
        day =>
          formatInTimeZone(instant(a.startTime), timezone, "yyyy-MM-dd") ===
          format(day, "yyyy-MM-dd")
      )
    )
    .flatMap((a: any) => [
      Number(formatInTimeZone(instant(a.startTime), timezone, "H")),
      Number(formatInTimeZone(instant(a.endTime), timezone, "H")) + 1,
    ]);
  const first = Math.min(8, ...hourValues),
    last = Math.max(18, ...hourValues);
  const hours = Array.from({ length: last - first }, (_, i) => first + i);
  return (
    <div className="week-workspace">
      <div className="week-main">
        <div className="week-toolbar">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Previous week"
              onClick={() => c.handleDateTap(addDays(start, -7))}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Next week"
              onClick={() => c.handleDateTap(addDays(start, 7))}
            >
              <ChevronRight />
            </Button>
            <Button
              variant="outline"
              onClick={() => c.handleDateTap(new Date())}
            >
              Today
            </Button>
          </div>
          <p className="text-sm font-medium">
            {format(start, "d MMM")}–{format(addDays(start, 6), "d MMM yyyy")}
          </p>
          <Button onClick={() => c.startBooking(c.activeDate)}>
            <Plus />
            New booking
          </Button>
        </div>
        {c.activeArtists.length > 1 && (
          <label className="flex items-center gap-3 px-5 pb-3 text-sm">
            Artist
            <select
              aria-label="Filter calendar by artist"
              className="border rounded-lg p-2 bg-background"
              value={artistId}
              onChange={e => {
                setArtistId(e.target.value);
                setSelectedId(null);
              }}
            >
              <option value="">All artists</option>
              {c.activeArtists.map((a: any) => (
                <option key={a.userId} value={a.userId}>
                  {a.user?.name || "Artist"}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="week-grid-scroll">
          <div className="week-grid">
            <div className="week-days">
              <div />
              <>
                {days.map(day => (
                  <button
                    className="min-h-14 border-b border-border text-sm"
                    key={day.toISOString()}
                    onClick={() => c.startBooking(day)}
                  >
                    {format(day, "EEE d")}
                  </button>
                ))}
              </>
            </div>
            <div className="week-body" style={{ height: hours.length * 72 }}>
              <div className="week-times">
                {hours.map(hour => (
                  <div style={{ height: 72 }} key={hour}>
                    {`${hour}`.padStart(2, "0")}:00
                  </div>
                ))}
              </div>
              {days.map(day => {
                const key = format(day, "yyyy-MM-dd");
                const appointments = events
                  .filter(
                    (a: any) =>
                      formatInTimeZone(
                        instant(a.startTime),
                        timezone,
                        "yyyy-MM-dd"
                      ) === key
                  )
                  .sort(
                    (a: any, b: any) =>
                      instant(a.startTime).getTime() -
                      instant(b.startTime).getTime()
                  );
                const lanes = calendarLanes(appointments);
                return (
                  <div key={key} className="week-day-column">
                    {hours.map(hour => (
                      <button
                        key={hour}
                        aria-label={`New booking ${format(day, "EEEE d MMMM")} at ${hour}:00`}
                        className="week-slot"
                        style={{ height: 72 }}
                        onClick={() => {
                          const date = new Date(day);
                          date.setHours(hour, 0, 0, 0);
                          c.startBooking(date);
                        }}
                      />
                    ))}
                    {appointments.map((a: any, index: number) => {
                      const h = Number(
                        formatInTimeZone(instant(a.startTime), timezone, "H")
                      );
                      const m = Number(
                        formatInTimeZone(instant(a.startTime), timezone, "m")
                      );
                      const { lane, count } = lanes.get(a.id)!;
                      const width = 100 / count;
                      return (
                        <button
                          key={a.id}
                          className={`week-event ${selectedId === a.id ? "is-selected" : ""}`}
                          style={{
                            top: (h - first + m / 60) * 72,
                            height: Math.max(
                              44,
                              ((instant(a.endTime).getTime() -
                                instant(a.startTime).getTime()) /
                                3600000) *
                                72 -
                                4
                            ),
                            left: `calc(${lane * width}% + 3px)`,
                            width: `calc(${width}% - 6px)`,
                          }}
                          onClick={() => setSelectedId(a.id)}
                        >
                          <strong>
                            {a.clientName || a.client?.name || a.title}
                          </strong>
                          <span>
                            {bookingTime(a.startTime, timezone)}–
                            {bookingTime(a.endTime, timezone)}
                          </span>
                          <span>{a.title}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <aside className="week-inspector" aria-label="Selected booking">
        {selected ? (
          <>
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close booking details"
                onClick={() => setSelectedId(null)}
              >
                <X />
              </Button>
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">
              {selected.clientName || selected.client?.name || selected.title}
            </h2>
            <p className="workspace-subtitle">{selected.title}</p>
            <span
              className="workspace-status mt-4"
              data-tone={
                selected.status === "confirmed" ? "success" : undefined
              }
            >
              {statusLabel(selected.status)}
            </span>
            <div className="py-5 border-b border-border space-y-3">
              <p className="flex gap-3 items-center">
                <CalendarDays size={18} />
                {formatInTimeZone(
                  instant(selected.startTime),
                  timezone,
                  "EEE, d MMM"
                )}
              </p>
              <p className="flex gap-3 items-center">
                <Clock size={18} />
                {bookingTime(selected.startTime, timezone)}–
                {bookingTime(selected.endTime, timezone)}
              </p>
              <p className="text-xs text-muted-foreground">
                {timezone.replaceAll("_", " ")}
              </p>
            </div>
            <div className="py-5 space-y-3">
              {session && (
                <p className="text-sm flex gap-2 items-center">
                  {session.paidCents > 0 && <CheckCircle2 size={16} />}{" "}
                  {session.paidCents > 0
                    ? `${money(session.paidCents)} paid`
                    : "No payment recorded"}
                </p>
              )}
              {forms.map(f => (
                <p key={f.id} className="text-sm">
                  {f.title} · {f.status}
                </p>
              ))}
              {summary.isLoading && (
                <p role="status">Loading payment and forms…</p>
              )}
              {summary.error && (
                <Button variant="outline" onClick={() => summary.refetch()}>
                  Retry booking details
                </Button>
              )}
            </div>
            {session && (
              <div className="mb-6">
                <p className="workspace-section-title">Balance</p>
                <strong className="text-2xl">
                  {money(session.remainingCents)}
                </strong>
              </div>
            )}
            <div className="space-y-3">
              {selected.conversationId && (
                <Button asChild variant="outline" className="w-full">
                  <Link href={`/chat/${selected.conversationId}`}>
                    <MessageCircle />
                    Message client
                  </Link>
                </Button>
              )}
              <Button
                className="w-full"
                disabled={selected.id < 0}
                onClick={() => c.handleAppointmentTap(selected)}
              >
                {selected.id < 0 ? "External calendar event" : "Open booking"}
              </Button>
              {selected.conversationId && (
                <Link
                  className="workspace-link"
                  href={`/projects/${selected.conversationId}?session=${selected.id}`}
                >
                  Forms & payment history
                </Link>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col h-full justify-center text-center">
            <CalendarDays
              className="mx-auto mb-4 text-muted-foreground"
              size={30}
            />
            <h2 className="font-semibold">Your week at a glance</h2>
            <p className="workspace-subtitle text-sm">
              Select a booking to see its details, or choose a time to add one.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
