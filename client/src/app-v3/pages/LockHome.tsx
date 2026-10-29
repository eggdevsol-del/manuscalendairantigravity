import {
  Bell,
  CalendarDays,
  CheckCircle2,
  Gift,
  MessageSquare,
  Package,
  ShoppingBag,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useBusinessTasks } from "@/features/dashboard/useBusinessTasks";
import { money, statusLabel } from "@/features/workspace/bookingPresentation";
import { getAssetUrl } from "@/lib/assets";
import { Avatar, Feedback } from "../design/primitives";
import { messagePreview } from "../data/messagePresentation";
import {
  dayTimeline,
  firstImage,
  projectTitle,
  startLabel,
} from "../design/lockHome";
import {
  Group,
  Note,
  Orb,
  ProjectArt,
  RequestPostcards,
  Widget,
  compactMoney,
  initials,
  progress,
  startOfDay,
  trimHours,
  useNow,
} from "../design/LockParts";
import { addDays, parseSchedule } from "../design/calendarDays";
import {
  bookedAhead,
  daysUntil,
  isExternalEvent,
  moneyWeeks,
  nextSittingByClient,
  sittingMoney,
} from "../design/landingData";
import { MoneyRiver } from "../design/MoneyRiver";
import { DayCard } from "./Calendar";

const DAY_KEY = "yyyy-MM-dd";
const AHEAD_DAYS = 64; // nine weeks: the mini calendar's 60 days and the river's eight weeks
const MINI_DAYS = 60;

/** The artist's landing page: a lock screen for the studio, laid out as in the prototype. A clock and
 *  ring widgets, the live sitting, then notification groups in this order: Calendar, Needs you, Requests
 *  & messages, Money, People, Offers and Supplies. A group expands in place and scrolls on its own; at its
 *  edges the swipe moves the page, and only one group is open at a time. Settings sit behind the avatar.
 *  Every value comes from the backend. */
export default function LockHome() {
  const { user } = useAuth();
  const [, go] = useLocation();
  const now = useNow();
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today0 = startOfDay(now);
  // The window starts at midnight so today's finished sittings stay in view.
  const range = useMemo(
    () => ({ start: new Date(today0), end: new Date(addDays(today0, AHEAD_DAYS)) }),
    [today0]
  );
  const calendar = trpc.appointments.getArtistCalendar.useQuery(
    { artistId: user?.id ?? "", startDate: range.start, endDate: range.end },
    { enabled: !!user?.id, refetchInterval: 60000 }
  );
  const settings = trpc.artistSettings.get.useQuery();
  const leads = trpc.funnel.getLeads.useQuery(
    { status: "new", limit: 20, offset: 0 },
    { refetchInterval: 30000 }
  );
  const conversations = trpc.conversations.list.useQuery(undefined, {
    refetchInterval: 30000,
  });
  const payout = trpc.payouts.nextPayout.useQuery();
  const earnings = trpc.payouts.earningsBreakdown.useQuery({
    period: "90d",
    timeZone: zone,
  });
  const history = trpc.payouts.payoutHistory.useQuery({ limit: 6 });
  const clients = trpc.conversations.getClients.useQuery();
  const offers = trpc.offers.list.useQuery();
  const suppliers = trpc.suppliers.getSuppliers.useQuery();
  const tasks = useBusinessTasks();
  const [open, setOpen] = useState<string | null>(null);
  const toggle = (key: string) => setOpen(o => (o === key ? null : key));

  // ── Sittings ─────────────────────────────────────────────
  const rows = (calendar.data ?? []) as any[];
  const sittings = rows.filter(a => !isExternalEvent(a));
  const todayKey = format(now, DAY_KEY);
  const todays = sittings.filter(
    a => format(new Date(a.startTime), DAY_KEY) === todayKey
  );
  const timeline = dayTimeline(todays, now, today0);
  const remainingToday = todays.filter(
    a => new Date(a.endTime ?? a.startTime).getTime() > now
  );
  const live = todays.find(a => timeline.blocks.find(b => b.id === a.id)?.live);
  const upcoming = sittings.filter(
    a => new Date(a.endTime ?? a.startTime).getTime() > now
  );
  const next = live ?? upcoming[0];
  const nextAfterToday = sittings.find(
    a => new Date(a.startTime).getTime() >= addDays(today0, 1)
  );
  const hoursToday =
    todays.reduce(
      (sum, a) =>
        sum +
        (new Date(a.endTime ?? a.startTime).getTime() -
          new Date(a.startTime).getTime()),
      0
    ) / 3600000;
  const ahead = bookedAhead(sittings, now);
  const balance = payout.data && !("error" in payout.data) ? payout.data : null;
  const currency = balance?.currency?.toUpperCase() || "AUD";
  const schedule = useMemo(
    () => parseSchedule(settings.data?.workSchedule),
    [settings.data?.workSchedule]
  );
  const projectHref = (a: { conversationId?: number | null; id: number }) =>
    a.conversationId ? `/projects/${a.conversationId}?session=${a.id}` : "/calendar";

  // Readiness for today's sittings: deposit from the sitting, forms from its project summary.
  const conversationIds = [
    ...new Set(
      remainingToday
        .map(a => a.conversationId)
        .filter((id): id is number => !!id)
    ),
  ];
  const summaries = trpc.useQueries(t =>
    conversationIds.map(id => t.projects.summary({ conversationId: id }))
  );
  const readiness = (a: any) => {
    const m = sittingMoney(a);
    const deposit =
      m.estimateCents > 0 && m.paidCents >= m.estimateCents
        ? "Paid"
        : m.paidCents > 0
          ? "Deposit paid"
          : "No deposit yet";
    const i = conversationIds.indexOf(a.conversationId);
    const forms = ((i >= 0 && summaries[i]?.data?.forms) || []).filter(
      (f: any) => f.appointmentId === a.id
    );
    const unsigned = forms.filter((f: any) => f.status !== "signed").length;
    const formsText = !forms.length
      ? null
      : unsigned
        ? `${unsigned} form${unsigned === 1 ? "" : "s"} to sign`
        : "Forms signed";
    return [deposit, formsText].filter(Boolean).join(" · ");
  };

  // ── Money ───────────────────────────────────────────────
  const weeks = moneyWeeks(earnings.data?.daily ?? [], sittings, now);
  const payments = (history.data?.entries ?? []) as any[];

  // ── People: clients with a sitting in the next 60 days ──
  const byClient = new Map(
    ((clients.data ?? []) as any[])
      .filter(Boolean)
      .map(c => [c.id as string, c])
  );
  const people = nextSittingByClient(sittings, now)
    .filter(a => new Date(a.startTime).getTime() < addDays(today0, MINI_DAYS))
    .map(a => ({
      sitting: a,
      client: byClient.get(a.clientId),
      days: daysUntil(a.startTime, now),
    }));

  // ── Requests & messages ─────────────────────────────────
  const newLeads = leads.data?.leads ?? [];
  const chats = [...(conversations.data ?? [])]
    .sort((a, b) => (b.unreadCount || 0) - (a.unreadCount || 0))
    .slice(0, 6);

  // ── Offers and supplies ─────────────────────────────────
  // Running offers first; ended ones stay listed but say so.
  const ended = (c: any) =>
    !!c.rules.expiresAt && new Date(c.rules.expiresAt).getTime() <= now;
  const campaigns =
    offers.data?.enabled === false
      ? null
      : [...(offers.data?.campaigns ?? [])].sort(
          (a: any, b: any) => Number(ended(a)) - Number(ended(b))
        );
  const carts = (suppliers.data ?? []).flatMap(s => {
    let count = 0;
    try {
      const basket = JSON.parse(
        sessionStorage.getItem(`tattoi-supply-basket:${user?.id}:${s.id}`) ||
          "{}"
      );
      for (const v of Object.values(basket))
        if (typeof v === "number" && Number.isInteger(v) && v > 0) count += v;
    } catch {}
    return count ? [{ supplier: s, count }] : [];
  });

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
            value={Math.min(1, ahead / 4000000)}
            label={compactMoney(ahead)}
            caption="booked ahead"
          />
          <Widget
            href="/conversations"
            value={Math.min(1, newLeads.length / 6)}
            label={String(newLeads.length)}
            caption="new requests"
          />
        </div>
        {next && (
          <Link href={projectHref(next)} className="iosm-live">
            <span className="iosm-live-mark" aria-hidden="true">
              <ProjectArt src={next.imageUrl} name={next.clientName || "Client"} />
            </span>
            <span className="iosm-live-copy">
              <small>
                {live
                  ? "In the chair"
                  : `Next up ${startLabel(next.startTime, now)}`}
              </small>
              <strong>{next.clientName || "Client"}</strong>
              <em>
                {projectTitle(next.projectName, next.serviceName, next.title) ??
                  "Sitting"}
              </em>
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

      <Group
        id="calendar"
        icon={<CalendarDays />}
        title="Calendar"
        href="/calendar"
        open={open === "calendar"}
        onToggle={toggle}
        peek={1 + Math.min(2, Math.max(1, remainingToday.length))}
      >
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
        {remainingToday.length ? (
          remainingToday.map(a => (
            <Note
              key={a.id}
              icon={
                a.imageUrl ? (
                  <ProjectArt src={a.imageUrl} name={a.clientName || "Client"} />
                ) : (
                  <CalendarDays />
                )
              }
              title={a.clientName || "Client"}
              detail={`${projectTitle(a.projectName, a.serviceName, a.title) ?? "Sitting"} · ${readiness(a)}`}
              when={startLabel(a.startTime, now)}
              href={projectHref(a)}
              live={a.id === live?.id}
            />
          ))
        ) : (
          <Note
            icon={<CheckCircle2 />}
            title={todays.length ? "Done for today" : "Nothing booked today"}
            detail={
              nextAfterToday
                ? `Next: ${nextAfterToday.clientName || "Client"}, ${startLabel(nextAfterToday.startTime, now)}`
                : "Nothing else booked"
            }
            href={nextAfterToday ? projectHref(nextAfterToday) : "/calendar"}
          />
        )}
        <h4 className="iosm-gsub">Coming up</h4>
        <MiniCalendar
          rows={rows}
          schedule={schedule}
          now={now}
          onOpen={a =>
            go(
              `/calendar?date=${format(new Date(a.startTime), DAY_KEY)}T12:00&appointment=${a.id}`
            )
          }
          onFill={day => go(`/calendar?date=${format(day, DAY_KEY)}T12:00&fill=1`)}
        />
      </Group>

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
        id="requests"
        icon={<Sparkles />}
        title="Requests & messages"
        href="/conversations"
        open={open === "requests"}
        onToggle={toggle}
        peek={newLeads.length ? 1 : 2}
      >
        {newLeads.length > 0 && <RequestPostcards leads={newLeads} />}
        {newLeads.map(lead => {
          const l = lead as Record<string, unknown>;
          return (
            <Note
              key={`lead-${l.id}`}
              icon={<Sparkles />}
              title={String(l.clientName || "New client")}
              detail={`${String(l.projectType || "Tattoo").replace(/-/g, " ")}${l.budgetLabel ? ` · ${l.budgetLabel}` : ""}`}
              when={l.createdAt ? agoLabel(l.createdAt as string, now) : undefined}
              href={`/lead/${l.id}`}
            />
          );
        })}
        {chats.map(c => (
          <Note
            key={`chat-${c.id}`}
            icon={<MessageSquare />}
            title={`${c.otherUser?.name || "Conversation"}${c.unreadCount ? ` · ${c.unreadCount} new` : ""}`}
            detail={messagePreview(c.lastMessage?.content, c.lastMessage?.messageType)}
            href={`/chat/${c.id}`}
            live={!!c.unreadCount}
          />
        ))}
        {!newLeads.length && !chats.length && (
          <Note
            icon={<MessageSquare />}
            title="No requests or messages yet"
            detail="Share your booking link to get requests"
            href="/settings?section=booking-link"
          />
        )}
      </Group>

      <Group
        id="money"
        icon={<Wallet />}
        title="Money"
        href="/money"
        open={open === "money"}
        onToggle={toggle}
        peek={2}
      >
        <Note
          icon={<Wallet />}
          title={
            balance && typeof balance.availableAmountCents === "number"
              ? `${money(balance.availableAmountCents, currency)} ready to pay out`
              : "Connect payouts"
          }
          detail={`${money(ahead, currency)} booked over the next 8 weeks`}
          href={balance ? "/money" : "/bank-payouts"}
        />
        <Link href="/money" className="iosm-mini-river" aria-label="Open Money">
          <MoneyRiver weeks={weeks} height={110} />
        </Link>
        {payments.length > 0 && <h4 className="iosm-gsub">Latest payments</h4>}
        {payments.map(p => (
          <Note
            key={`pay-${p.id}`}
            icon={<Wallet />}
            title={p.clientName || statusLabel(p.type)}
            detail={`${statusLabel(p.type)} · ${money(p.amountCents, currency)}`}
            when={p.createdAt ? agoLabel(p.createdAt, now) : undefined}
            href="/money"
          />
        ))}
      </Group>

      {people.length > 0 && (
        <Group
          id="people"
          icon={<Users />}
          title="People"
          href="/clients"
          open={open === "people"}
          onToggle={toggle}
          peek={1}
        >
          <div className="iosm-people">
            {people.slice(0, 5).map(({ sitting, client, days }, i) => (
              <Link
                key={sitting.clientId}
                href={`/clients?client=${sitting.clientId}`}
                className="iosm-person"
              >
                <Orb
                  name={client?.name || sitting.clientName || "Client"}
                  src={client?.avatar}
                  fill={1 - Math.min(1, days / MINI_DAYS)}
                  size={i ? 50 : 66}
                />
                <b>{(client?.name || sitting.clientName || "Client").split(" ")[0]}</b>
                <small>{days === 0 ? "Today" : days === 1 ? "Tomorrow" : `in ${days} days`}</small>
              </Link>
            ))}
          </div>
          {people.map(({ sitting, client, days }) => (
            <Note
              key={`person-${sitting.clientId}`}
              icon={<Users />}
              title={client?.name || sitting.clientName || "Client"}
              detail={`${projectTitle(sitting.projectName, sitting.serviceName, sitting.title) ?? "Sitting"}${client?.tlv ? ` · ${money(Math.round(client.tlv * 100), currency)} spent` : ""}`}
              when={days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days}d`}
              href={`/clients?client=${sitting.clientId}`}
            />
          ))}
        </Group>
      )}

      {campaigns && (
        <Group
          id="offers"
          icon={<Gift />}
          title="Offers"
          href="/offers"
          open={open === "offers"}
          onToggle={toggle}
        >
          {campaigns.length ? (
            campaigns.map((c: any) => (
              <Note
                key={`offer-${c.id}`}
                icon={<Gift />}
                title={c.rules.name}
                detail={
                  c.rules.expiresAt
                    ? `${ended(c) ? "Ended" : "Ends"} ${new Date(c.rules.expiresAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}`
                    : "No end date"
                }
                live={!ended(c)}
                href="/offers"
              />
            ))
          ) : (
            <Note
              icon={<Gift />}
              title="No offers running"
              detail="Create a discount or a gift voucher"
              href="/offers"
            />
          )}
        </Group>
      )}

      <Group
        id="supplies"
        icon={<Package />}
        title="Supplies"
        href="/supplies"
        open={open === "supplies"}
        onToggle={toggle}
        peek={2}
      >
        {carts.map(({ supplier, count }) => (
          <Note
            key={`cart-${supplier.id}`}
            icon={<ShoppingBag />}
            title={`${supplier.name} cart`}
            detail={`${count} item${count === 1 ? "" : "s"} · review prices and check out`}
            href={`/supplies?supplier=${supplier.id}&cart=1`}
            live
          />
        ))}
        {(suppliers.data ?? []).map(s => (
          <Note
            key={`supplier-${s.id}`}
            icon={
              s.logoUrl ? (
                <img src={getAssetUrl(s.logoUrl)} alt="" loading="lazy" />
              ) : (
                <Package />
              )
            }
            title={s.name}
            detail="Restock from this supplier"
            href={`/supplies?supplier=${s.id}`}
          />
        ))}
        {!suppliers.isLoading && !(suppliers.data ?? []).length && (
          <Note
            icon={<Package />}
            title="Supplies"
            detail="Find suppliers for your studio"
            href="/supplies"
          />
        )}
      </Group>

      <Feedback
        error={calendar.error}
        onRetry={() => calendar.refetch()}
      />
      <p className="iosm-foot">Settings live behind your photo, top right.</p>
    </div>
  );
}

/** When something happened: "today", "yesterday" or a date. */
function agoLabel(at: string | Date, now: number) {
  const d = new Date(typeof at === "string" && !at.includes("T") ? at.replace(" ", "T") + "Z" : at);
  if (Number.isNaN(d.getTime())) return undefined;
  const days = Math.round((startOfDay(now) - startOfDay(d.getTime())) / 86400000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : format(d, "d MMM");
}

/** "Coming up" in the Calendar group: the same day cards as the Calendar page, from tomorrow. Fourteen
 *  more days load as the open group scrolls near its end, up to 60 days; then a button opens the full
 *  calendar and the swipe hands back to the page. */
function MiniCalendar({
  rows,
  schedule,
  now,
  onOpen,
  onFill,
}: {
  rows: any[];
  schedule: any[];
  now: number;
  onOpen: (a: any) => void;
  onFill: (day: number) => void;
}) {
  const [shown, setShown] = useState(14);
  const end = useRef<HTMLDivElement>(null);
  const today0 = startOfDay(now);
  const byDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const a of rows) {
      if (a.status === "cancelled") continue;
      (map[format(new Date(a.startTime), DAY_KEY)] ||= []).push(a);
    }
    return map;
  }, [rows]);
  useEffect(() => {
    const el = end.current;
    const root = el?.closest(".iosm-group-body");
    if (!el || !root || shown >= MINI_DAYS) return;
    const io = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting))
          setShown(n => Math.min(MINI_DAYS, n + 14));
      },
      { root, rootMargin: "0px 0px 300px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);
  const days = Array.from({ length: shown }, (_, i) => addDays(today0, i + 1));
  return (
    <div className="iosm-minical">
      {days.map(day => (
        <DayCard
          key={day}
          day={day}
          now={now}
          sittings={byDay[format(day, DAY_KEY)] ?? []}
          schedule={schedule}
          onOpen={onOpen}
          onFill={onFill}
        />
      ))}
      {shown < MINI_DAYS ? (
        <div ref={end} className="iosm-minical-end" aria-hidden="true" />
      ) : (
        <Link href="/calendar" className="iosm-minical-open">
          Open full calendar
        </Link>
      )}
    </div>
  );
}
