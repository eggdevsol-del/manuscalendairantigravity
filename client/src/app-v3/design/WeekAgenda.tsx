import { trpc } from "@/lib/trpc";
import {
  money,
  bookingTime,
  statusLabel,
} from "@/features/workspace/bookingPresentation";
import { Feedback, Panel, Row, Section } from "./primitives";

export function WeekAgenda() {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const query = trpc.dashboard.getUpcomingWeek.useQuery(
    { timeZone: zone },
    { refetchInterval: 60000 }
  );
  return (
    <Section title="Next 7 days">
      <Feedback
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
      />
      {query.data && (
        <>
          <Panel tone="next">
            <dl className="v3-facts">
              <div>
                <dt>Booked work estimate</dt>
                <dd>{money(query.data.estimateCents, query.data.currency)}</dd>
              </div>
              <div>
                <dt>Still to collect</dt>
                <dd>{money(query.data.remainingCents, query.data.currency)}</dd>
              </div>
            </dl>
            <p className="v3-muted">
              Confirmed work · {query.data.currency} · before fees. Balance
              excludes paid deposits.
            </p>
          </Panel>
          <div className="today-agenda">
            {query.data.dates.map(date => (
              <div className="today-agenda-day" key={date}>
                <h3>
                  {new Date(date + "T12:00:00").toLocaleDateString("en-AU", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </h3>
                <div>
                  {query
                    .data!.sittings.filter(s => s.date === date)
                    .map(s => (
                      <Row
                        key={s.id}
                        title={`${bookingTime(s.startTime, zone)} · ${s.clientName}`}
                        detail={`${s.title} · ${statusLabel(s.status)}`}
                        href={
                          s.conversationId
                            ? `/projects/${s.conversationId}?session=${s.id}`
                            : `/calendar?appointment=${s.id}&date=${encodeURIComponent(s.startTime)}`
                        }
                      />
                    ))}
                  {!query.data!.sittings.some(s => s.date === date) && (
                    <p className="v3-muted">No upcoming sittings</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Section>
  );
}
