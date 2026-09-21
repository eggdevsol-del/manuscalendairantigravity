import { CalendarTimeline } from "../design/CalendarTimeline";
import { useState, useMemo } from "react";
import { addDays, format, startOfWeek } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  CalendarDays,
  MapPin,
  CheckCircle2,
  X,
  MessageCircle,
} from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useCalendarAgendaController } from "@/pages/calendar/hooks/useCalendarAgendaController";
import { trpc } from "@/lib/trpc";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import {
  bookingDate,
  bookingTime,
  instant,
  money,
  statusLabel,
} from "@/features/workspace/bookingPresentation";
import {
  Action,
  ActionLink,
  Feedback,
  Row,
  Screen,
  Section,
  Status,
} from "../design/primitives";
import { BookingComposer } from "./BookingComposer";
import { SessionActions } from "./SessionActions";

export default function Calendar() {
  const c = useCalendarAgendaController();
  const wide = useMediaQuery("(min-width: 768px)");
  const search = useSearch();
  const [, go] = useLocation();
  const [selectedId, setSelectedId] = useState<number | null>(
    () => Number(new URLSearchParams(search).get("appointment")) || null
  );
  const [bookingDateValue, setBookingDateValue] = useState<Date | null>(null);
  const [artist, setArtist] = useState("");
  const [navigationKey, setNavigationKey] = useState(0);
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const monday = startOfWeek(c.activeDate, { weekStartsOn: 1 });
  const events = useMemo(
    () =>
      Object.values(c.eventsByDay)
        .flat()
        .filter(
          a => a.status !== "cancelled" && (!artist || a.artistId === artist)
        ),
    [c.eventsByDay, artist]
  );
  const goDay = (date: Date) => {
    c.handleDateTap(date);
    setNavigationKey(key => key + 1);
    setSelectedId(null);
  };
  function select(a: any) {
    setSelectedId(a.id);
  }
  const period = `${format(monday, "d")}–${format(addDays(monday, 6), "d MMMM yyyy")}`;
  return (
    <Screen
      title="Calendar"
      compactTitle
      className="v3-calendar-page"
      subtitle={wide ? period : format(c.activeDate, "EEEE, d MMMM")}
      wide
      action={
        <Action
          className="v3-calendar-new"
          aria-label="New booking"
          onClick={() => setBookingDateValue(c.activeDate)}
        >
          <Plus />
          <span>New booking</span>
        </Action>
      }
    >
      <div className="v3-calendar-toolbar" hidden={c.activeArtists.length <= 1}>
        <div className="v3-inline">
          {c.activeArtists.length > 1 && (
            <select
              aria-label="Calendar artist"
              data-tour-description="Filter the calendar to one artist or view the studio together. This helps you check the right person’s availability before discussing dates with a client."
              value={artist}
              onChange={e => {
                setArtist(e.target.value);
                setSelectedId(null);
              }}
            >
              <option value="">All artists</option>
              {c.activeArtists.map(a => (
                <option key={a.userId} value={a.userId}>
                  {a.user?.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
      <div className="v3-week-strip" aria-label="Calendar week">
        {Array.from({ length: 7 }, (_, i) => addDays(monday, i)).map(date => (
          <button
            key={date.toISOString()}
            type="button"
            aria-label={format(date, "EEEE, d MMMM yyyy")}
            aria-pressed={
              format(date, "yyyy-MM-dd") === format(c.activeDate, "yyyy-MM-dd")
            }
            onClick={() => goDay(date)}
          >
            <span>{format(date, "EEE")}</span>
            <strong>{format(date, "d")}</strong>
          </button>
        ))}
      </div>
      <Feedback loading={c.isLoading} error={c.error} onRetry={c.refetch} />
      <div
        className="v3-calendar-workspace v3-calendar-inline"
        data-selected={selectedId !== null}
      >
        <CalendarTimeline
          events={events}
          date={c.activeDate}
          navigationKey={navigationKey}
          onDate={c.setActiveDate}
          onSelect={select}
          selectedId={selectedId}
          onDeselect={() => setSelectedId(null)}
          renderDetails={appointment => (
            <BookingInspector
              appointment={appointment}
              onChange={c.refetch}
              onClose={() => setSelectedId(null)}
              showCloseButton={false}
            />
          )}
          zone={zone}
          loading={c.isFetching}
          onBook={setBookingDateValue}
          services={c.artistServices}
        />
      </div>
      <div
        className="v3-calendar-date-controls"
        role="group"
        aria-label="Calendar date navigation"
      >
        <Action
          tone="quiet"
          aria-label="Previous week"
          onClick={() => goDay(addDays(monday, -7))}
        >
          <ChevronLeft />
          <span>Previous</span>
        </Action>
        <Action tone="secondary" onClick={() => goDay(new Date())}>
          Today
        </Action>
        <Action
          tone="quiet"
          aria-label="Next week"
          onClick={() => goDay(addDays(monday, 7))}
        >
          <span>Next</span>
          <ChevronRight />
        </Action>
      </div>
      <SheetShell
        isOpen={!!bookingDateValue}
        onClose={() => setBookingDateValue(null)}
        title="New booking"
      >
        {bookingDateValue && (
          <BookingComposer
            initialDate={bookingDateValue}
            onSuccess={id => {
              setBookingDateValue(null);
              c.refetch();
              go(`/chat/${id}`);
            }}
          />
        )}
      </SheetShell>
    </Screen>
  );
}
function BookingInspector({
  appointment: a,
  onClose,
  onChange,
  showCloseButton = true,
}: {
  appointment: any;
  onChange: () => unknown;
  onClose: () => void;
  showCloseButton?: boolean;
}) {
  const summary = trpc.projects.summary.useQuery(
    { conversationId: a.conversationId || 0 },
    { enabled: !!a.conversationId }
  );
  const forms = summary.data?.forms.filter(f => f.appointmentId === a.id) || [];
  const session = summary.data?.sessions.find(s => s.id === a.id);
  const external =
    a.id < 0 ||
    a.isExternal ||
    a.source === "google" ||
    a.source === "external" ||
    String(a.id).startsWith("google");
  return (
    <div className="v3-stack">
      <div className="v3-inline" style={{ justifyContent: "space-between" }}>
        <h2 className="v3-detail-title">
          {a.client?.name || a.clientName || a.title}
        </h2>
        {showCloseButton && (
          <button
            type="button"
            className="v3-icon-button"
            onClick={onClose}
            aria-label="Close booking details"
          >
            <X />
          </button>
        )}
      </div>
      <p className="v3-muted">
        {a.title}
        {a.sessionIndex ? ` · Session ${a.sessionIndex}` : ""}
      </p>
      <div>
        <Status tone={a.status === "confirmed" ? "success" : "neutral"}>
          {external ? "External calendar" : statusLabel(a.status)}
        </Status>
      </div>
      <Row
        title={bookingDate(a.startTime, a.timeZone || "Australia/Brisbane")}
        icon={<CalendarDays />}
      />
      <Row
        title={`${bookingTime(a.startTime, a.timeZone || "Australia/Brisbane")}–${bookingTime(a.endTime, a.timeZone || "Australia/Brisbane")}`}
        icon={<Clock />}
      />
      {summary.data?.location && (
        <Row title={summary.data.location} icon={<MapPin />} />
      )}
      <Feedback error={summary.error} onRetry={() => summary.refetch()} />
      {session && (
        <>
          <Row
            title={
              session.paidCents > 0 ? "Payment received" : "Payment outstanding"
            }
            icon={session.paidCents > 0 ? <CheckCircle2 /> : undefined}
          />
          {forms.map(f => (
            <Row
              key={f.id}
              title={f.title}
              detail={
                f.status === "signed"
                  ? "Signed"
                  : f.status === "pending"
                    ? "Awaiting signature"
                    : statusLabel(f.status)
              }
              icon={f.status === "signed" ? <CheckCircle2 /> : undefined}
            />
          ))}
          <Section title="Balance">
            <h3 className="v3-detail-title">{money(session.remainingCents)}</h3>
          </Section>
        </>
      )}
      {a.conversationId && (
        <>
          <ActionLink href={`/chat/${a.conversationId}`}>
            <MessageCircle />
            Message {a.client?.name || a.clientName || "client"}
          </ActionLink>
          <ActionLink
            href={`/projects/${a.conversationId}?session=${a.id}`}
            tone="primary"
          >
            Open booking
          </ActionLink>
        </>
      )}
      {!external && !a.conversationId && (
        <SessionActions
          session={{
            id: a.id,
            startsAt: a.startTime,
            endsAt: a.endTime,
            timeZone: a.timeZone || "Australia/Brisbane",
            status: a.status,
            remainingCents: a.remainingBalanceCents || 0,
            sessionPlanId: a.sessionPlanId,
          }}
          onChange={() => {
            onChange();
            onClose();
          }}
        />
      )}
      {external && (
        <p className="v3-muted">Manage this event in its original calendar.</p>
      )}
    </div>
  );
}
