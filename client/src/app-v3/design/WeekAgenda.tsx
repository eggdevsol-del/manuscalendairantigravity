import { SittingCard } from "../components/SittingCard";
import { SittingSummary } from "../components/SittingSummary";
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
import { Action, ActionLink, Feedback, Section } from "./primitives";

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
            data-tour-repeat="home-week-date"
            data-tour-title="Choose a day in your week"
            data-tour-description="Select a date to see that day’s appointments. Expand full week shows the entire week; selecting a day returns to its appointments."
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
              <SittingCard
                key={s.id}
                title={s.client?.name || s.clientName || s.title}
                detail={`${bookingTime(s.startTime, zone)} · ${s.title} · ${statusLabel(s.status)}`}
              >
                {s.conversationId ? (
                  <SittingSummary
                    conversationId={s.conversationId}
                    appointmentId={s.id}
                  />
                ) : (
                  <ActionLink
                    href={`/calendar?appointment=${s.id}&date=${encodeURIComponent(s.startTime)}`}
                  >
                    Open sitting & actions
                  </ActionLink>
                )}
              </SittingCard>
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
