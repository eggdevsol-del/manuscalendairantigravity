import { useState } from "react";
import { addDays, format, startOfWeek } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  bookingTime,
  instant,
  statusLabel,
} from "@/features/workspace/bookingPresentation";
import { Action, ActionLink, Feedback, Row, Section } from "./primitives";

export function WeekAgenda() {
  const { user } = useAuth();
  const [selected, setSelected] = useState(() => new Date());
  const [wholeWeek, setWholeWeek] = useState(false);
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const start = startOfWeek(selected, { weekStartsOn: 1 });
  const query = trpc.appointments.getArtistCalendar.useQuery(
    { artistId: user?.id || "", startDate: start, endDate: addDays(start, 7) },
    { enabled: !!user }
  );
  const dates = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <Section title="Your week">
      <div className="v3-week-strip" aria-label="Dashboard week">
        {dates.map(date => (
          <button
            key={date.toISOString()}
            type="button"
            aria-label={format(date, "EEEE, d MMMM yyyy")}
            aria-pressed={
              format(date, "yyyy-MM-dd") === format(selected, "yyyy-MM-dd")
            }
            onClick={() => {
              setSelected(date);
              setWholeWeek(false);
            }}
          >
            <span>{format(date, "EEE")}</span>
            <strong>{format(date, "d")}</strong>
          </button>
        ))}
      </div>
      <Feedback
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
      />
      {(wholeWeek ? dates : [selected]).map(date => {
        const sessions = (query.data || [])
          .filter(
            s =>
              s.status !== "cancelled" &&
              formatInTimeZone(instant(s.startTime), zone, "yyyy-MM-dd") ===
                format(date, "yyyy-MM-dd")
          )
          .sort((a, b) => +instant(a.startTime) - +instant(b.startTime));
        return (
          <div key={date.toISOString()}>
            <h3>{format(date, "EEEE d MMMM")}</h3>
            {sessions.map(s => (
              <Row
                key={s.id}
                title={s.client?.name || s.clientName || s.title}
                detail={`${s.title} · ${statusLabel(s.status)}`}
                icon={<time>{bookingTime(s.startTime, zone)}</time>}
                href={
                  s.conversationId
                    ? `/projects/${s.conversationId}?session=${s.id}`
                    : `/calendar?appointment=${s.id}&date=${encodeURIComponent(s.startTime)}`
                }
              />
            ))}
            {!query.isLoading && !query.error && !sessions.length && (
              <p className="v3-muted">No sessions booked.</p>
            )}
          </div>
        );
      })}
      <Action
        tone="quiet"
        onClick={() => setWholeWeek(!wholeWeek)}
        aria-expanded={wholeWeek}
      >
        {wholeWeek ? "Show selected day" : "Expand full week"}
      </Action>
      <ActionLink
        href={`/calendar?date=${format(selected, "yyyy-MM-dd")}`}
        tone="quiet"
      >
        Open calendar
      </ActionLink>
    </Section>
  );
}
