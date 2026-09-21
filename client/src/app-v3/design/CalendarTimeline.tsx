import { SittingCard } from "../components/SittingCard";
import type { ReactNode } from "react";
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
  renderDetails,
  onDeselect,
  zone,
  loading = false,
  onBook,
  services = [],
  navigationKey = 0,
}: {
  events: any[];
  date: Date;
  onDate: (date: Date) => void;
  onSelect: (event: any) => void;
  selectedId: number | null;
  renderDetails?: (event: any) => ReactNode;
  onDeselect?: () => void;
  zone: string;
  loading?: boolean;
  onBook?: (date: Date) => void;
  services?: { name: string; color?: string }[];
  navigationKey?: number;
}) {
  const [origin, setOrigin] = useState(() =>
    addDays(startOfDay(date), -middle)
  );
  const scroll = useRef<HTMLDivElement>(null);
  const visibleDate = useRef(format(date, "yyyy-MM-dd"));
  const withinDay = useRef(0);
  const lastNavigation = useRef(navigationKey);
  const initialized = useRef(false);
  const scrolling = useRef(false);
  const touching = useRef(false);
  const frame = useRef<number | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [settledRevision, setSettledRevision] = useState(0);
  const [renderedEvents, setRenderedEvents] = useState(events);
  // A query response must not resize virtual rows under a native iOS fling.
  useLayoutEffect(() => {
    if (!scrolling.current && !touching.current) setRenderedEvents(events);
  }, [events, settledRevision]);
  const [scrollTop, setScrollTop] = useState(middle * 138);
  const [viewportHeight, setViewportHeight] = useState(600);
  const byDay = useMemo(() => {
    const result = new Map<string, any[]>();
    for (const event of renderedEvents) {
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
  }, [renderedEvents, zone]);
  const offsets = useMemo(() => {
    const positions = [0];
    for (let index = 0; index < windowSize; index++) {
      const count =
        byDay.get(format(addDays(origin, index), "yyyy-MM-dd"))?.length || 0;
      positions.push(positions[index] + 74 + Math.max(1, count) * 64);
    }
    return positions;
  }, [origin, byDay]);
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
  const lastOffsets = useRef(offsets);
  function clearIdle() {
    if (idleTimer.current !== null) clearTimeout(idleTimer.current);
    idleTimer.current = null;
  }
  function readPosition() {
    const top = Math.max(0, scroll.current?.scrollTop || 0);
    const index = indexAt(top);
    const day = addDays(origin, index);
    withinDay.current = Math.max(0, top - offsets[index]);
    setScrollTop(top);
    const key = format(day, "yyyy-MM-dd");
    if (key !== visibleDate.current) {
      visibleDate.current = key;
      onDate(day);
    }
    return { day, index };
  }
  function finishScrolling() {
    if (touching.current) return;
    clearIdle();
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    const { day, index } = readPosition();
    scrolling.current = false;
    // Rebase only after momentum ends. Replacing scrollTop mid-fling stops WKWebView inertia.
    if (index < 20 || index > windowSize - 20) setOrigin(addDays(day, -middle));
    setSettledRevision(revision => revision + 1);
  }
  const finish = useRef(finishScrolling);
  finish.current = finishScrolling;
  function scheduleIdle() {
    clearIdle();
    idleTimer.current = setTimeout(() => finish.current(), 200);
  }
  function trackDate() {
    scrolling.current = true;
    scheduleIdle();
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      readPosition();
    });
  }
  useEffect(() => {
    const element = scroll.current;
    const end = () => finish.current();
    element?.addEventListener("scrollend", end);
    return () => {
      element?.removeEventListener("scrollend", end);
      clearIdle();
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, []);
  // Own scroll-derived date echoes are read-only. Only an explicit navigation or
  // a settled layout change may move the native scroll position.
  useLayoutEffect(() => {
    const key = format(date, "yyyy-MM-dd");
    const navigation = navigationKey !== lastNavigation.current;
    const externalDate = key !== visibleDate.current;
    const firstLayout = !initialized.current;
    const geometryChanged = offsets !== lastOffsets.current;
    if (!firstLayout && !navigation && !externalDate && !geometryChanged)
      return;
    const intentional = navigation || externalDate;
    if (!intentional && !firstLayout && (scrolling.current || touching.current))
      return;
    if (intentional || firstLayout) {
      clearIdle();
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
      scrolling.current = false;
      withinDay.current = 0;
    }
    visibleDate.current = key;
    lastNavigation.current = navigationKey;
    lastOffsets.current = offsets;
    initialized.current = true;
    const index = differenceInCalendarDays(date, origin);
    if (index < 0 || index >= windowSize) {
      setOrigin(addDays(startOfDay(date), -middle));
      return;
    }
    const top =
      offsets[index] +
      Math.min(withinDay.current, offsets[index + 1] - offsets[index] - 1);
    const element = scroll.current;
    if (!element) return;
    const distance = Math.abs(element.scrollTop - top);
    if (distance > 0.5) {
      const smooth =
        navigation &&
        !firstLayout &&
        distance < viewportHeight * 5 &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (smooth) element.scrollTo({ top, behavior: "smooth" });
      else element.scrollTop = top;
      if (!smooth) setScrollTop(top);
    }
  }, [date, origin, offsets, navigationKey, settledRevision]);
  const overscan = Math.max(4, Math.ceil(viewportHeight / 138));
  const first = Math.max(0, indexAt(scrollTop) - overscan);
  const last = Math.min(
    windowSize - 1,
    indexAt(scrollTop + viewportHeight) + overscan
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
    <section className="v3-continuous-calendar" data-expanded={false}>
      <div className="v3-timeline-heading">
        <strong>{format(date, "MMMM yyyy")}</strong>
      </div>
      <div
        ref={scroll}
        className="v3-timeline-scroll"
        onScroll={trackDate}
        onTouchStart={() => {
          touching.current = true;
          scrolling.current = true;
          clearIdle();
        }}
        onTouchEnd={() => {
          touching.current = false;
          scheduleIdle();
        }}
        onTouchCancel={() => {
          touching.current = false;
          scheduleIdle();
        }}
        onWheel={() => {
          scrolling.current = true;
          scheduleIdle();
        }}
        tabIndex={0}
        role="region"
        aria-label="Scrollable calendar timeline"
        data-tour-description="Scroll through the calendar to browse dates. Appointment cards expand directly below the selected card; the plus control starts a booking on its date. Browsing does not move or reschedule appointments."
      >
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
                  {onBook && (
                    <button
                      type="button"
                      data-tour-repeat="calendar-book-date"
                      data-tour-title="Book on a calendar date"
                      data-tour-description="Start a booking on this date. The planner lets you select a client and service, then review availability, sittings and payment details."
                      aria-label={`Book on ${format(day, "d MMMM yyyy")}`}
                      onClick={() => onBook(day)}
                    >
                      +
                    </button>
                  )}
                  {key === format(new Date(), "yyyy-MM-dd") && (
                    <small>Today</small>
                  )}
                </h3>
                {items.length ? (
                  items.map(event => (
                    <SittingCard
                      key={event.id}
                      headerClassName="v3-timeline-session"
                      headerStyle={{
                        borderLeftColor:
                          services.find(s => s.name === event.title)?.color ||
                          undefined,
                      }}
                      icon={
                        <time>
                          {bookingTime(event.startTime, zone)}
                          <small>{bookingTime(event.endTime, zone)}</small>
                        </time>
                      }
                      title={
                        event.client?.name || event.clientName || event.title
                      }
                      detail={<>{event.title}</>}
                      expanded={!!renderDetails && selectedId === event.id}
                      onExpandedChange={open =>
                        open ? onSelect(event) : onDeselect?.()
                      }
                    >
                      {renderDetails?.(event)}
                    </SittingCard>
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
