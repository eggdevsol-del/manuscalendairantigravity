import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { format } from "date-fns";
import {
  Clock,
  CalendarDays,
  MapPin,
  CheckCircle2,
  X,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import {
  bookingDate,
  bookingTime,
  money,
  statusLabel,
} from "@/features/workspace/bookingPresentation";
import {
  ActionLink,
  Feedback,
  Row,
  Screen,
  Section,
  Status,
} from "../design/primitives";
import {
  addDays,
  canFill,
  dayColumn,
  duration,
  freeMinutes,
  hoursFor,
  parseSchedule,
  startOfDay,
} from "../design/calendarDays";
import { BookingComposer } from "./BookingComposer";
import { FillDay } from "./FillDay";
import { SessionActions } from "./SessionActions";

const CHUNK = 28;
const DAY_KEY = "yyyy-MM-dd";

/** The Screen's scrolling body, or the page when rendered outside one. */
function scroller(el: HTMLElement | null) {
  return (el?.closest<HTMLElement>(".v3-scroll") ||
    document.scrollingElement ||
    document.documentElement) as HTMLElement;
}

/** An endless river of days: scroll down for the future, up for the past, and more days load as you go.
 *  Each day is a full card with its sittings sized by length, and any future day with two free hours
 *  offers "Fill this day" (or "Fill the gap" around existing bookings). */
export default function Calendar() {
  const { user } = useAuth();
  const search = useSearch();
  const [, go] = useLocation();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(id);
  }, []);
  const anchor = useMemo(() => {
    const raw = new URLSearchParams(search).get("date");
    const d = raw ? new Date(raw) : new Date();
    return startOfDay(Number.isNaN(d.getTime()) ? new Date() : d);
    // The anchor is where the calendar opens; later URL changes don't move it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [range, setRange] = useState({ from: -7, to: 35 });
  const [artist, setArtist] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [fillDay, setFillDay] = useState<number | null>(null);
  const [bookingDay, setBookingDay] = useState<Date | null>(null);
  const [month, setMonth] = useState(() => format(anchor, "MMMM yyyy"));
  const [todayVisible, setTodayVisible] = useState(true);

  // Bookings load in four-week chunks, so earlier chunks stay cached as the river grows.
  const artistLike = user?.role === "artist" || user?.role === "admin";
  const studio = trpc.studios.getCurrentStudio.useQuery(undefined, {
    enabled: artistLike,
  });
  const members = trpc.studios.getStudioMembers.useQuery(
    { studioId: studio.data?.id! },
    { enabled: !!studio.data?.id }
  );
  const settings = trpc.artistSettings.get.useQuery(undefined, {
    enabled: !!user,
  });
  const chunks = useMemo(() => {
    const out: number[] = [];
    for (
      let i = Math.floor(range.from / CHUNK);
      i * CHUNK < range.to;
      i++
    )
      out.push(addDays(anchor, i * CHUNK));
    return out;
  }, [anchor, range]);
  const mine = trpc.useQueries(t =>
    chunks.map(start =>
      t.appointments.getArtistCalendar(
        {
          artistId: user?.id!,
          startDate: new Date(start),
          endDate: new Date(addDays(start, CHUNK)),
        },
        { enabled: artistLike && !!user?.id }
      )
    )
  );
  const shared = trpc.useQueries(t =>
    chunks.map(start =>
      t.appointments.getStudioCalendar(
        {
          studioId: studio.data?.id!,
          startDate: new Date(start),
          endDate: new Date(addDays(start, CHUNK)),
        },
        { enabled: !!studio.data?.id }
      )
    )
  );
  const queries = [...mine, ...shared];
  const refetch = useCallback(() => {
    queries.forEach(q => void q.refetch());
  }, [queries]);
  const artists = useMemo(() => {
    const seen = new Map<string, string>();
    for (const m of members.data ?? [])
      if (m.status === "active" && !seen.has(m.user.id))
        seen.set(m.user.id, m.user.name || "Artist");
    return [...seen];
  }, [members.data]);

  // Group bookings by local day, without duplicates where the studio and personal calendars overlap.
  const byDay = useMemo(() => {
    const all = new Map<number | string, any>();
    for (const q of queries)
      for (const a of (q.data as any[] | undefined) ?? []) all.set(a.id, a);
    const groups: Record<string, any[]> = {};
    for (const a of all.values()) {
      if (a.status === "cancelled" || (artist && a.artistId !== artist))
        continue;
      const key = format(new Date(a.startTime), DAY_KEY);
      (groups[key] ||= []).push(a);
    }
    return groups;
    // queries is a new array every render; its data is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queries.map(q => q.dataUpdatedAt).join(), artist]);
  const schedule = useMemo(
    () => parseSchedule(settings.data?.workSchedule),
    [settings.data?.workSchedule]
  );
  const services = useMemo(() => {
    const s = parseSchedule(settings.data?.services);
    return s as { name: string; duration: number; price: number }[];
  }, [settings.data?.services]);

  const days = useMemo(
    () =>
      Array.from({ length: range.to - range.from }, (_, i) =>
        addDays(anchor, range.from + i)
      ),
    [anchor, range]
  );

  // ── Endless scrolling ─────────────────────────────────────
  const listRef = useRef<HTMLDivElement>(null);
  const ready = useRef(false);
  const touched = useRef(false);
  const before = useRef<number | null>(null);
  const growing = useRef(false);
  const today = startOfDay(now);

  const jumpTo = useCallback((day: number) => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-day="${format(day, DAY_KEY)}"]`
    );
    if (!el) return false;
    const sc = scroller(listRef.current);
    const top =
      el.getBoundingClientRect().top -
      (sc === document.scrollingElement ? 0 : sc.getBoundingClientRect().top) +
      sc.scrollTop -
      72;
    sc.scrollTop = top;
    return true;
  }, []);

  // Open on the anchor day, and keep it in place while bookings above it load, until the artist scrolls.
  useLayoutEffect(() => {
    if (!touched.current) jumpTo(anchor);
  });
  useEffect(() => {
    const id = window.setTimeout(() => (ready.current = true), 600);
    const mark = () => (touched.current = true);
    window.addEventListener("wheel", mark, { passive: true });
    window.addEventListener("touchstart", mark, { passive: true });
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("wheel", mark);
      window.removeEventListener("touchstart", mark);
    };
  }, []);

  // Days added above push the page down; scroll by the same amount so nothing visibly moves.
  useLayoutEffect(() => {
    if (before.current === null) return;
    const sc = scroller(listRef.current);
    sc.scrollTop += sc.scrollHeight - before.current;
    before.current = null;
  }, [range.from]);
  useEffect(() => {
    growing.current = false;
  }, [range.to]);

  // The month label follows the scroll, and a Today button appears once today is out of view.
  useEffect(() => {
    const sc = scroller(listRef.current);
    const target: HTMLElement | Window =
      sc === document.scrollingElement ? window : sc;
    const update = () => {
      const list = listRef.current;
      if (!list) return;
      const top =
        sc === document.scrollingElement ? 0 : sc.getBoundingClientRect().top;
      const height =
        sc === document.scrollingElement ? window.innerHeight : sc.clientHeight;
      const cur = [...list.querySelectorAll<HTMLElement>("[data-day]")].find(
        d => d.getBoundingClientRect().bottom > top + 120
      );
      if (cur)
        setMonth(format(new Date(`${cur.dataset.day}T12:00`), "MMMM yyyy"));
      const t = list.querySelector<HTMLElement>(
        `[data-day="${format(today, DAY_KEY)}"]`
      );
      if (t) {
        const r = t.getBoundingClientRect();
        setTodayVisible(r.bottom > top && r.top < top + height);
      } else setTodayVisible(false);
      // Near either end, add more days: four weeks below, two above once the artist has scrolled.
      // Only with real layout (taller than the view), and no further than two years either way.
      if (sc.scrollHeight <= height) return;
      if (
        ready.current &&
        touched.current &&
        before.current === null &&
        sc.scrollTop < 600 &&
        range.from > -730
      ) {
        before.current = sc.scrollHeight;
        setRange(r => ({ ...r, from: r.from - 14 }));
      }
      if (
        !growing.current &&
        range.to < 730 &&
        sc.scrollHeight - sc.scrollTop - height < 1200
      ) {
        growing.current = true;
        setRange(r => ({ ...r, to: r.to + CHUNK }));
      }
    };
    update();
    target.addEventListener("scroll", update, { passive: true });
    return () => target.removeEventListener("scroll", update);
  }, [today, range]);

  // Deep links from elsewhere (?appointment=) open that booking once it has loaded.
  const wanted = useRef(Number(new URLSearchParams(search).get("appointment")));
  useEffect(() => {
    if (!wanted.current) return;
    for (const list of Object.values(byDay)) {
      const hit = list.find(a => a.id === wanted.current);
      if (hit) {
        setSelected(hit);
        wanted.current = 0;
        return;
      }
    }
  }, [byDay]);

  const error = queries.find(q => q.error)?.error;
  const loading = queries.some(q => q.isLoading);
  const openingTime = (day: number) => {
    const h = hoursFor(schedule, day);
    const d = new Date(day);
    d.setHours(Math.floor(h.start / 60), h.start % 60, 0, 0);
    return d;
  };

  return (
    <Screen title="Calendar" className="iosm-calendar" wide>
      {artists.length > 1 && (
        <label className="iosm-cal-filter">
          <span className="sr-only">Calendar artist</span>
          <select
            aria-label="Calendar artist"
            value={artist}
            onChange={e => setArtist(e.target.value)}
          >
            <option value="">All artists</option>
            {artists.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="iosm-cal-month" aria-live="polite">
        {month}
      </p>
      <Feedback loading={false} error={error} onRetry={refetch} />
      <div className="iosm-cal-list" ref={listRef} aria-busy={loading}>
        {days.map(day => (
          <DayCard
            key={day}
            day={day}
            now={now}
            sittings={byDay[format(day, DAY_KEY)] ?? []}
            schedule={schedule}
            onOpen={setSelected}
            onFill={setFillDay}
          />
        ))}
      </div>
      {!todayVisible && (
        <button
          type="button"
          className="iosm-cal-today"
          onClick={() => {
            if (!jumpTo(today)) {
              setRange({ from: -7, to: 35 });
              touched.current = false;
            }
          }}
        >
          Today
        </button>
      )}
      <SheetShell
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title="Booking"
      >
        {selected && (
          <BookingInspector
            appointment={selected}
            onChange={refetch}
            onClose={() => setSelected(null)}
          />
        )}
      </SheetShell>
      <SheetShell
        isOpen={fillDay !== null}
        onClose={() => setFillDay(null)}
        title={
          fillDay !== null && (byDay[format(fillDay, DAY_KEY)] ?? []).length
            ? "Fill the gap"
            : "Fill this day"
        }
      >
        {fillDay !== null && (
          <FillDay
            day={fillDay}
            sittings={byDay[format(fillDay, DAY_KEY)] ?? []}
            schedule={schedule}
            services={services}
            onBook={() => {
              setBookingDay(openingTime(fillDay));
              setFillDay(null);
            }}
          />
        )}
      </SheetShell>
      <SheetShell
        isOpen={!!bookingDay}
        onClose={() => setBookingDay(null)}
        title="New booking"
      >
        {bookingDay && (
          <BookingComposer
            initialDate={bookingDay}
            onSuccess={id => {
              setBookingDay(null);
              refetch();
              go(`/chat/${id}`);
            }}
          />
        )}
      </SheetShell>
    </Screen>
  );
}

function DayCard({
  day,
  now,
  sittings,
  schedule,
  onOpen,
  onFill,
}: {
  day: number;
  now: number;
  sittings: any[];
  schedule: any[];
  onOpen: (a: any) => void;
  onFill: (day: number) => void;
}) {
  const date = new Date(day);
  const isToday = day === startOfDay(now);
  const hours =
    sittings.reduce(
      (sum, a) =>
        sum +
        (new Date(a.endTime ?? a.startTime).getTime() -
          new Date(a.startTime).getTime()),
      0
    ) / 3600000;
  const free = freeMinutes(schedule, day, sittings);
  const open = hoursFor(schedule, day).open;
  const column = sittings.length ? dayColumn(sittings, day, now) : null;
  const r = 13;
  const c = 2 * Math.PI * r;
  const f = Math.min(1, hours / 8);
  return (
    <section
      className={`iosm-day${sittings.length ? "" : " empty"}`}
      data-day={format(day, DAY_KEY)}
      aria-label={format(date, "EEEE d MMMM")}
    >
      {date.getDate() === 1 && (
        <h3 className="iosm-day-month">{format(date, "MMMM yyyy")}</h3>
      )}
      <div className={`iosm-day-head${isToday ? " today" : ""}`}>
        <span className="iosm-day-num">
          <small>{format(date, "EEE")}</small>
          <b>{date.getDate()}</b>
        </span>
        <span className="iosm-day-title">
          <b>{isToday ? "Today" : format(date, "MMMM")}</b>
          <em>
            {sittings.length
              ? `${sittings.length} sitting${sittings.length === 1 ? "" : "s"} · ${duration(Math.round(hours * 60))} in the chair`
              : open
                ? "Free"
                : "Day off"}
          </em>
        </span>
        <svg
          className="iosm-day-ring"
          viewBox="0 0 34 34"
          aria-hidden="true"
        >
          <circle cx="17" cy="17" r={r} className="bg" />
          {f > 0.01 && (
            <circle
              cx="17"
              cy="17"
              r={r}
              className="fg"
              strokeDasharray={`${c * f} ${c}`}
              transform="rotate(-90 17 17)"
            />
          )}
        </svg>
      </div>
      {canFill(free, day, now) && (
        <button
          type="button"
          className="iosm-fill"
          data-calendar-booking-entry
          onClick={() => onFill(day)}
        >
          <Sparkles aria-hidden="true" />
          {sittings.length
            ? `Fill the gap · ${duration(free)} free`
            : "Fill this day"}
        </button>
      )}
      {column && (
        <div className="iosm-dcol" style={{ height: column.height }}>
          {column.ticks.map(t => (
            <span key={t.top} className="iosm-tick" style={{ top: t.top }}>
              {t.label}
            </span>
          ))}
          {column.cards.map(({ sitting: a, top, height, short, live }) => (
            <SittingCard
              key={a.id}
              appointment={a}
              style={{ top, height }}
              short={short}
              live={live}
              onOpen={() => onOpen(a)}
            />
          ))}
          {column.nowLine !== null && isToday && (
            <div className="iosm-nowl" style={{ top: column.nowLine }}>
              <span>Now</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function SittingCard({
  appointment: a,
  style,
  short,
  live,
  onOpen,
}: {
  appointment: any;
  style: { top: number; height: number };
  short: boolean;
  live: boolean;
  onOpen: () => void;
}) {
  const name = a.clientName || a.client?.name || a.title || "Booking";
  const external = typeof a.id !== "number" || a.id < 0 || a.isExternal;
  const index = a.sessionIndex || a.sessionNumber;
  const total = a.sessionTotal || a.totalSessions;
  const time = `${format(new Date(a.startTime), "h:mmaaa")}–${format(
    new Date(a.endTime ?? a.startTime),
    "h:mmaaa"
  )}`;
  const expected = a.totalExpectedAmountCents || 0;
  const paid = a.totalPaidAmountCents || 0;
  const ready: [string, boolean][] = external
    ? []
    : [
        expected > 0 && paid >= expected
          ? ["Paid", true]
          : a.depositPaid || paid > 0
            ? ["Deposit", true]
            : ["No deposit", false],
      ];
  return (
    <button
      type="button"
      className={`iosm-sc${live ? " live" : ""}${short ? " short" : ""}${a.status === "pending" ? " pending" : ""}`}
      style={style}
      onClick={onOpen}
    >
      <span className="iosm-sc-art" aria-hidden="true">
        {name
          .split(/\s+/)
          .slice(0, 2)
          .map((w: string) => w[0])
          .join("")
          .toUpperCase()}
      </span>
      <span className="iosm-sc-copy">
        {!short && (
          <i>
            {time}
            {live ? " · now" : a.status === "pending" ? " · awaiting deposit" : ""}
          </i>
        )}
        <b>{name}</b>
        <em>
          {short ? `${time}${live ? " · now" : ""} · ` : ""}
          {external
            ? "External calendar"
            : a.projectName || a.serviceName || a.title}
          {index && total > 1 ? `, ${index} of ${total}` : ""}
        </em>
        {!short && ready.length > 0 && (
          <u>
            {ready.map(([t, ok]) => (
              <s key={t} className={ok ? "ok" : "due"}>
                {ok ? "✓" : "!"} {t}
              </s>
            ))}
          </u>
        )}
      </span>
    </button>
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
        {a.projectName || a.title}
        {a.sessionIndex ? ` · Sitting ${a.sessionIndex}${a.sessionTotal ? ` of ${a.sessionTotal}` : ""}` : ""}
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
