import { useRef, useMemo, useEffect, useLayoutEffect, useState } from "react";
import {
  addDays,
  differenceInCalendarDays,
  format,
  startOfDay,
} from "date-fns";
import {
  bookingTime,
  instant,
  statusLabel,
} from "@/features/workspace/bookingPresentation";
import { formatInTimeZone } from "date-fns-tz";

// Virtual rows keep the DOM small even when moving years through the calendar.
const windowSize = 2001;
const middle = 1000;
export function CalendarTimeline({
  events,
  date,
  onDate,
  onSelect,
  selectedId,
  zone,
  loading = false,
}: {
  events: any[];
  date: Date;
  onDate: (date: Date) => void;
  onSelect: (event: any) => void;
  selectedId: number | null;
  zone: string;
  loading?: boolean;
}) {
  const [origin, setOrigin] = useState(() =>
    addDays(startOfDay(date), -middle)
  );
  const scroll = useRef<HTMLDivElement>(null);
  const visibleDate = useRef(format(date, "yyyy-MM-dd"));
  const withinDay = useRef(0);
  const [expanded, setExpanded] = useState(true);
  const lastExpanded = useRef(expanded);
  const [scrollTop, setScrollTop] = useState(middle * 186);
  const [viewportHeight, setViewportHeight] = useState(600);
  const byDay = useMemo(() => {
    const result = new Map<string, any[]>();
    for (const event of events) {
      const key = formatInTimeZone(
        instant(event.startTime),
        zone,
        "yyyy-MM-dd"
      );
      result.set(key, [...(result.get(key) || []), event]);
    }
    for (const rows of result.values())
      rows.sort((a, b) => +instant(a.startTime) - +instant(b.startTime));
    return result;
  }, [events, zone]);
  const offsets = useMemo(() => {
    const positions = [0];
    for (let index = 0; index < windowSize; index++) {
      const count =
        byDay.get(format(addDays(origin, index), "yyyy-MM-dd"))?.length || 0;
      positions.push(
        positions[index] + 74 + Math.max(1, count) * (expanded ? 112 : 64)
      );
    }
    return positions;
  }, [origin, byDay, expanded]);
  function indexAt(top: number) {
    let low = 0,
      high = windowSize - 1;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (offsets[mid] <= top) low = mid;
      else high = mid - 1;
    }
    return low;
  }
  useEffect(() => {
    if (!scroll.current) return;
    const observer = new ResizeObserver(entries =>
      setViewportHeight(entries[0].contentRect.height)
    );
    observer.observe(scroll.current);
    return () => observer.disconnect();
  }, []);
  // Anchor by date, not an obsolete pixel offset, when row heights or the date window change.
  useLayoutEffect(() => {
    const key = format(date, "yyyy-MM-dd");
    if (key !== visibleDate.current || expanded !== lastExpanded.current)
      withinDay.current = 0;
    visibleDate.current = key;
    lastExpanded.current = expanded;
    const index = differenceInCalendarDays(date, origin);
    if (index < 0 || index >= windowSize) {
      setOrigin(addDays(startOfDay(date), -middle));
      return;
    }
    const top =
      offsets[index] +
      Math.min(withinDay.current, offsets[index + 1] - offsets[index] - 1);
    if (scroll.current) scroll.current.scrollTop = top;
    setScrollTop(top);
  }, [date, origin, offsets, expanded]);
  function trackDate() {
    const top = scroll.current?.scrollTop || 0;
    const index = indexAt(top + 0.5);
    const day = addDays(origin, index);
    withinDay.current = Math.max(0, top - offsets[index]);
    setScrollTop(top);
    const key = format(day, "yyyy-MM-dd");
    if (key !== visibleDate.current) {
      visibleDate.current = key;
      onDate(day);
    }
    if (index < 20 || index > windowSize - 20) setOrigin(addDays(day, -middle));
  }
  const first = Math.max(0, indexAt(scrollTop) - 4);
  const last = Math.min(
    windowSize - 1,
    indexAt(scrollTop + viewportHeight) + 4
  );
  const rows = Array.from({ length: last - first + 1 }, (_, i) => {
    const index = first + i;
    return {
      index,
      key: format(addDays(origin, index), "yyyy-MM-dd"),
      start: offsets[index],
      size: offsets[index + 1] - offsets[index],
    };
  });
  return (
    <section className="v3-continuous-calendar" data-expanded={expanded}>
      <div className="v3-timeline-heading">
        <strong>{format(date, "MMMM yyyy")}</strong>
        <button
          className="v3-icon-button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
        >
          {expanded ? "Compact agenda" : "Expand agenda"}
        </button>
      </div>
      <div ref={scroll} className="v3-timeline-scroll" onScroll={trackDate}>
        <div
          style={{ height: offsets[offsets.length - 1], position: "relative" }}
        >
          {rows.map(row => {
            const day = addDays(origin, row.index);
            const key = format(day, "yyyy-MM-dd");
            const items = byDay.get(key) || [];
            return (
              <section
                key={row.key}
                data-index={row.index}
                className="v3-timeline-day"
                style={{
                  height: row.size,
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${row.start}px)`,
                }}
                aria-label={format(day, "EEEE d MMMM yyyy")}
              >
                <h3>
                  <span>{format(day, "EEE")}</span> {format(day, "d MMMM")}{" "}
                  {key === format(new Date(), "yyyy-MM-dd") && (
                    <small>Today</small>
                  )}
                </h3>
                {items.length ? (
                  items.map(event => (
                    <button
                      key={event.id}
                      className="v3-timeline-session"
                      aria-pressed={selectedId === event.id}
                      onClick={() => onSelect(event)}
                    >
                      <time>
                        {bookingTime(event.startTime, zone)}
                        <small>{bookingTime(event.endTime, zone)}</small>
                      </time>
                      <span>
                        <strong>
                          {event.client?.name ||
                            event.clientName ||
                            event.title}
                        </strong>
                        <span>{event.title}</span>
                        {expanded && (
                          <small>
                            {statusLabel(event.status)} · View booking, forms &
                            payments
                          </small>
                        )}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="v3-timeline-empty">
                    {loading ? "Loading sessions…" : "No sessions booked"}
                  </p>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </section>
  );
}
