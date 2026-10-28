import {
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Package,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useBusinessTasks } from "@/features/dashboard/useBusinessTasks";
import { useTotalUnreadCount } from "@/lib/selectors/conversation.selectors";
import { money } from "@/features/workspace/bookingPresentation";
import { Avatar, Feedback } from "../design/primitives";
import { dayTimeline, firstImage, relativeStart } from "../design/lockHome";

/** The artist's landing page: a lock screen for the studio. A clock and ring widgets, the live sitting,
 *  then notification groups that summarise the app. A group expands in place and scrolls on its own;
 *  at its edges the swipe moves the page, and only one group is open at a time. Settings sit behind
 *  the avatar. */
export default function LockHome() {
  const { user } = useAuth();
  const [, go] = useLocation();
  const now = useNow();
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const week = trpc.dashboard.getUpcomingWeek.useQuery(
    { timeZone: zone },
    { refetchInterval: 60000 }
  );
  const leads = trpc.funnel.getLeads.useQuery(
    { status: "new", limit: 20, offset: 0 },
    { refetchInterval: 30000 }
  );
  const payout = trpc.payouts.nextPayout.useQuery();
  const tasks = useBusinessTasks();
  const unread = useTotalUnreadCount();
  const [open, setOpen] = useState<string | null>(null);
  const toggle = (key: string) => setOpen(o => (o === key ? null : key));

  const today = new Date(now).toDateString();
  const sittings = week.data?.sittings ?? [];
  const todays = sittings.filter(
    s => new Date(s.startTime).toDateString() === today
  );
  const timeline = dayTimeline(todays, now, startOfDay(now));
  const upcoming = sittings.filter(
    s => new Date(s.endTime ?? s.startTime).getTime() > now
  );
  const live = todays.find(s => timeline.blocks.find(b => b.id === s.id)?.live);
  const next = live ?? upcoming[0];
  const hoursToday =
    todays.reduce(
      (sum, s) =>
        sum +
        (new Date(s.endTime ?? s.startTime).getTime() -
          new Date(s.startTime).getTime()),
      0
    ) / 3600000;
  const currency = week.data?.currency ?? "AUD";
  const newLeads = leads.data?.leads ?? [];
  const balance = payout.data && !("error" in payout.data) ? payout.data : null;

  return (
    <div className="v3-screen iosm-home">
      <Link href="/settings" className="iosm-avatar" aria-label="Settings">
        <Avatar name={user?.name} src={user?.avatar} />
      </Link>
      <section className="iosm-lock" aria-label="Today at a glance">
        <time className="iosm-clock" dateTime={new Date(now).toISOString()}>
          {new Date(now)
            .toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })
            .replace(/\s?(am|pm)/i, "")}
        </time>
        <p className="iosm-date">
          {new Date(now).toLocaleDateString("en-AU", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
        <div className="iosm-widgets">
          <Widget
            href="/calendar"
            value={hoursToday / 8}
            label={`${Math.round(hoursToday)}h`}
            caption="in the chair"
          />
          <Widget
            href="/money"
            value={Math.min(1, (week.data?.estimateCents ?? 0) / 1000000)}
            label={compactMoney(week.data?.estimateCents ?? 0)}
            caption="booked this week"
          />
          <Widget
            href="/conversations"
            value={Math.min(1, newLeads.length / 6)}
            label={String(newLeads.length)}
            caption="new requests"
          />
        </div>
        {next && (
          <Link
            href={
              next.conversationId
                ? `/projects/${next.conversationId}?session=${next.id}`
                : "/calendar"
            }
            className="iosm-live"
          >
            <span className="iosm-live-mark" aria-hidden="true">
              {initials(next.clientName)}
            </span>
            <span className="iosm-live-copy">
              <small>
                {live
                  ? "In the chair"
                  : `Next up ${relativeStart(next.startTime, now)}`}
              </small>
              <strong>{next.clientName}</strong>
              <em>{next.title}</em>
            </span>
            {live && (
              <i className="iosm-live-progress" aria-hidden="true">
                <s
                  style={{
                    width: `${progress(live.startTime, live.endTime, now) * 100}%`,
                  }}
                />
              </i>
            )}
          </Link>
        )}
      </section>

      {tasks.tasks.length > 0 && (
        <Group
          id="needs"
          icon={<Bell />}
          title="Needs you"
          href="/today"
          open={open === "needs"}
          onToggle={toggle}
        >
          {tasks.tasks.map(task => (
            <Note
              key={task.id}
              icon={<Bell />}
              title={task.title}
              detail={task.context}
              onClick={() => {
                const t = task._serverTask;
                tasks.actions.startTask(t);
                go(
                  t.deepLink ||
                    (t.conversationId
                      ? `/chat/${t.conversationId}`
                      : "/clients")
                );
              }}
            />
          ))}
        </Group>
      )}

      <Group
        id="calendar"
        icon={<CalendarDays />}
        title="Calendar"
        href="/calendar"
        open={open === "calendar"}
        onToggle={toggle}
        peek={1 + Math.min(2, Math.max(1, upcoming.length))}
      >
        <Feedback
          loading={week.isLoading}
          error={week.error}
          onRetry={() => week.refetch()}
        />
        <Link href="/calendar" className="iosm-today">
          <span className="iosm-today-head">
            <strong>Today</strong>
            <em>
              {todays.length
                ? timeline.done === todays.length
                  ? `All ${todays.length} done today`
                  : `${timeline.done} of ${todays.length} done · ${trimHours(timeline.hoursLeft)}h left in the chair`
                : "Nothing booked today"}
            </em>
          </span>
          <span className="iosm-today-line">
            {timeline.blocks.map(b => (
              <span
                key={b.id}
                className={`iosm-block${b.done ? " done" : ""}${b.live ? " live" : ""}`}
                style={{ left: `${b.left}%`, width: `calc(${b.width}% - 3px)` }}
              />
            ))}
            {timeline.now !== null && (
              <i className="iosm-now" style={{ left: `${timeline.now}%` }} />
            )}
          </span>
          <span className="iosm-ticks" aria-hidden="true">
            {timeline.ticks.map(t => (
              <s key={t.label + t.left} style={{ left: `${t.left}%` }}>
                {t.label}
              </s>
            ))}
          </span>
        </Link>
        {upcoming.length ? (
          upcoming.map(s => (
            <Note
              key={s.id}
              icon={<CalendarDays />}
              title={s.clientName}
              detail={`${s.title} · ${new Date(s.startTime).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}`}
              when={relativeDay(s.startTime, now)}
              href={
                s.conversationId
                  ? `/projects/${s.conversationId}?session=${s.id}`
                  : "/calendar"
              }
              live={s.id === live?.id}
            />
          ))
        ) : (
          <Note
            icon={<CalendarDays />}
            title="Nothing else this week"
            detail="Open your calendar to plan ahead"
            href="/calendar"
          />
        )}
      </Group>

      {newLeads.length > 0 && (
        <Group
          id="requests"
          icon={<Sparkles />}
          title="Requests"
          href="/conversations"
          open={open === "requests"}
          onToggle={toggle}
          peek={1}
        >
          <div className="iosm-posts">
            {newLeads.map(lead => {
              const l = lead as Record<string, unknown>;
              const img = firstImage(l.referenceImages);
              return (
                <Link
                  key={String(l.id)}
                  href={`/lead/${l.id}`}
                  className="iosm-post"
                >
                  {img ? (
                    <img src={img} alt="" />
                  ) : (
                    <span className="iosm-post-blank">
                      <Sparkles />
                    </span>
                  )}
                  <span>
                    <i>{String(l.budgetLabel || "Budget to discuss")}</i>
                    <strong>{String(l.clientName || "New client")}</strong>
                    <q>
                      {String(l.projectDescription || "No description yet")}
                    </q>
                    <em>
                      {String(l.projectType || "Tattoo").replace(/-/g, " ")}
                      {l.placement
                        ? `, ${String(l.placement).toLowerCase()}`
                        : ""}
                    </em>
                  </span>
                </Link>
              );
            })}
          </div>
        </Group>
      )}

      <Group
        id="money"
        icon={<Wallet />}
        title="Money"
        href="/money"
        open={open === "money"}
        onToggle={toggle}
        peek={1}
      >
        <Note
          icon={<Wallet />}
          title={
            balance && typeof balance.availableAmountCents === "number"
              ? `${money(balance.availableAmountCents, balance.currency)} ready to pay out`
              : "Connect payouts"
          }
          detail={
            balance
              ? `${money(balance.pendingAmountCents, balance.currency)} on its way`
              : "Add a bank account so deposits reach you"
          }
          href={balance ? "/money" : "/bank-payouts"}
        />
        <Note
          icon={<CalendarDays />}
          title={`${money(week.data?.estimateCents ?? 0, currency)} booked this week`}
          detail={`${money(week.data?.remainingCents ?? 0, currency)} still to collect, before fees`}
          href="/money"
        />
      </Group>

      <Group
        id="more"
        icon={<Users />}
        title="Studio"
        href="/business"
        open={open === "more"}
        onToggle={toggle}
        peek={2}
      >
        <Note
          icon={<MessageSquare />}
          title="Messages"
          detail={unread ? `${unread} unread` : "All caught up"}
          href="/conversations"
        />
        <Note
          icon={<Users />}
          title="Clients"
          detail="Everyone you work with"
          href="/clients"
        />
        <Note
          icon={<Package />}
          title="Supplies"
          detail="Restock from your suppliers"
          href="/supplies"
        />
        <Note
          icon={<Sparkles />}
          title="Business"
          detail="Offers, shopfront, plans and payouts"
          href="/business"
        />
      </Group>
    </div>
  );
}

function Widget({
  href,
  value,
  label,
  caption,
}: {
  href: string;
  value: number;
  label: string;
  caption: string;
}) {
  const r = 24;
  const c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, value));
  return (
    <Link href={href} className="iosm-widget">
      <span className="iosm-ring">
        <svg viewBox="0 0 58 58" aria-hidden="true">
          <circle cx="29" cy="29" r={r} className="bg" />
          {f > 0.01 && (
            <circle
              cx="29"
              cy="29"
              r={r}
              className="fg"
              strokeDasharray={`${c * f} ${c}`}
              transform="rotate(-90 29 29)"
            />
          )}
        </svg>
        <b>{label}</b>
      </span>
      <small>{caption}</small>
    </Link>
  );
}

function Note({
  icon,
  title,
  detail,
  when,
  href,
  onClick,
  live,
}: {
  icon: ReactNode;
  title: string;
  detail?: string | null;
  when?: string;
  href?: string;
  onClick?: () => void;
  live?: boolean;
}) {
  const inner = (
    <>
      <span className="iosm-note-icon">{icon}</span>
      <span className="iosm-note-copy">
        <strong>{title}</strong>
        {detail && <span>{detail}</span>}
      </span>
      {when && <small>{when}</small>}
    </>
  );
  const cls = `iosm-note${live ? " live" : ""}`;
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" className={cls} onClick={onClick}>
      {inner}
    </button>
  );
}

/** A notification group. Collapsed, it shows its first `peek` items and the page scrolls as normal.
 *  Open, it grows to about twice that height and scrolls on its own without bouncing; once it can't
 *  scroll further, the rest of the swipe moves the page. */
function Group({
  id,
  icon,
  title,
  href,
  open,
  onToggle,
  peek = 2,
  children,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  href: string;
  open: boolean;
  onToggle: (id: string) => void;
  peek?: number;
  children: ReactNode;
}) {
  const body = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ collapsed: 0, expanded: 0, more: false });

  useLayoutEffect(() => {
    const el = body.current;
    if (!el) return;
    const measure = () => {
      const kids = Array.from(el.children) as HTMLElement[];
      if (!kids.length) return;
      const last = kids[Math.min(peek, kids.length) - 1];
      const collapsed = last.offsetTop + last.offsetHeight - el.offsetTop;
      const full = Array.from(el.children).reduce(
        (h, k) =>
          Math.max(
            h,
            (k as HTMLElement).offsetTop +
              (k as HTMLElement).offsetHeight -
              el.offsetTop
          ),
        0
      );
      setSize({
        collapsed,
        expanded: Math.min(full, Math.max(collapsed * 2, 360)),
        more: full > collapsed + 4,
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [peek, children]);

  useEffect(() => {
    const el = body.current;
    if (!el || !open) {
      if (el) el.scrollTop = 0;
      return;
    }
    const page = () =>
      (document.scrollingElement || document.documentElement) as HTMLElement;
    const atEdge = (dy: number) =>
      (dy > 0 && el.scrollTop + el.clientHeight >= el.scrollHeight - 1) ||
      (dy < 0 && el.scrollTop <= 0);
    const onWheel = (e: WheelEvent) => {
      if (!atEdge(e.deltaY)) return;
      e.preventDefault();
      page().scrollTop += e.deltaY;
    };
    let y: number | null = null;
    const onStart = (e: TouchEvent) => (y = e.touches[0].clientY);
    const onMove = (e: TouchEvent) => {
      if (y === null) return;
      const ny = e.touches[0].clientY;
      const dy = y - ny;
      y = ny;
      if (!atEdge(dy)) return;
      e.preventDefault();
      page().scrollTop += dy;
    };
    const onEnd = () => (y = null);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
    };
  }, [open]);

  const count = body.current
    ? Math.max(0, body.current.children.length - peek)
    : 0;
  return (
    <section className={`iosm-group${open ? " open" : ""}`} aria-label={title}>
      <Link href={href} className="iosm-group-head">
        <i aria-hidden="true">{icon}</i>
        <strong>{title}</strong>
        <span>
          Open <ChevronRight size={12} />
        </span>
      </Link>
      <div
        ref={body}
        id={`group-${id}`}
        className="iosm-group-body"
        style={{
          maxHeight: size.collapsed
            ? open
              ? size.expanded
              : size.collapsed
            : undefined,
        }}
      >
        {children}
      </div>
      {size.more && (
        <button
          type="button"
          className="iosm-group-toggle"
          aria-expanded={open}
          aria-controls={`group-${id}`}
          onClick={() => onToggle(id)}
        >
          {open ? "Show less" : `Show more${count ? ` · ${count}` : ""}`}
          <ChevronDown size={13} />
        </button>
      )}
    </section>
  );
}

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  return now;
}

const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(n => n[0])
    .join("")
    .toUpperCase();
const progress = (
  start: string | Date,
  end: string | Date | null | undefined,
  now: number
) => {
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : s + 7200000;
  return Math.max(0, Math.min(1, (now - s) / (e - s)));
};
const trimHours = (h: number) => h.toFixed(1).replace(/\.0$/, "");
const compactMoney = (cents: number) =>
  cents >= 100000
    ? `$${(cents / 100000).toFixed(cents >= 1000000 ? 0 : 1)}k`
    : `$${Math.round(cents / 100)}`;
function relativeDay(start: string | Date, now: number) {
  const d = new Date(start);
  if (d.toDateString() === new Date(now).toDateString())
    return relativeStart(start, now);
  const tomorrow = new Date(startOfDay(now) + 86400000).toDateString();
  return d.toDateString() === tomorrow
    ? "tomorrow"
    : d.toLocaleDateString("en-AU", { weekday: "short" });
}
