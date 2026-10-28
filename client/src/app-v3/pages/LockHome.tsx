import {
  Bell,
  CalendarDays,
  MessageSquare,
  Package,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useBusinessTasks } from "@/features/dashboard/useBusinessTasks";
import { useTotalUnreadCount } from "@/lib/selectors/conversation.selectors";
import { money } from "@/features/workspace/bookingPresentation";
import { Avatar, Feedback } from "../design/primitives";
import { dayTimeline, firstImage, relativeStart } from "../design/lockHome";
import {
  Group,
  Note,
  Widget,
  compactMoney,
  initials,
  progress,
  relativeDay,
  startOfDay,
  trimHours,
  useNow,
} from "../design/LockParts";

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
