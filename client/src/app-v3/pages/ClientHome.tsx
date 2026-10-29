import {
  CalendarDays,
  ClipboardCheck,
  Compass,
  Droplets,
  Gift,
  Hourglass,
  Images,
  MessageSquare,
} from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { money } from "@/features/workspace/bookingPresentation";
import { Avatar, Feedback } from "../design/primitives";
import { messagePreview } from "../data/messagePresentation";
import { projectTitle, relativeStart } from "../design/lockHome";
import { Group, Note, ProjectArt, Widget, relativeDay, useNow } from "../design/LockParts";
import {
  aftercareStage,
  clientProjects,
  daysUntil,
  discoverArtists,
  healingDay,
} from "../design/landingData";
import { ArtistCards, ProjectPostcards } from "../components/ClientParts";

/** The client's landing page: the same lock screen as the artist's, about their own tattoos. A clock and
 *  rings for the next sitting, healing and forms, then groups for sittings, healing, forms, requests,
 *  messages and discovering artists. Settings sit behind the avatar. */
export default function ClientHome() {
  const { user } = useAuth();
  const now = useNow();
  const upcoming = trpc.appointments.getClientBookings.useQuery({ tab: "upcoming" });
  const past = trpc.appointments.getClientBookings.useQuery({ tab: "past" });
  const conversations = trpc.conversations.list.useQuery(undefined, {
    refetchInterval: 30000,
  });
  const offers = trpc.offers.list.useQuery();
  const feed = trpc.feed.getDiscoverFeed.useQuery({ limit: 20 });
  const [open, setOpen] = useState<string | null>(null);
  const toggle = (key: string) => setOpen(o => (o === key ? null : key));

  const sittings = (upcoming.data?.appointments ?? []).filter(
    a =>
      a.startsAt &&
      !["cancelled", "completed", "no-show"].includes(a.status) &&
      new Date(a.endsAt).getTime() > now
  );
  const next = sittings[0];
  const live = next && new Date(next.startsAt).getTime() <= now ? next : null;
  const forms = sittings.filter(a => a.pendingFormCount > 0 && a.conversationId);
  const formCount = forms.reduce((n, a) => n + a.pendingFormCount, 0);
  // Look back 60 days, then let the artist's aftercare guide decide whether it's still healing.
  const recent = healingDay(past.data?.appointments ?? [], now, 60);
  const aftercare = trpc.aftercare.getForBooking.useQuery(
    { appointmentId: recent?.sitting.id ?? 0 },
    { enabled: !!recent }
  );
  const care = aftercare.data;
  const totalDays = care?.totalDays ?? 0;
  const healing =
    recent && care && !care.isHealed && care.daysSince <= totalDays
      ? { ...recent, day: care.daysSince }
      : null;
  const phases = [...(care?.template?.phases ?? [])].sort(
    (a, b) => a.fromDay - b.fromDay
  );
  const stage = healing ? aftercareStage(phases, healing.day) : null;
  const waiting = [
    ...(upcoming.data?.pendingRequests ?? []).map(r => ({
      key: `r${r.id}`,
      title: `Waiting on ${r.artistName}`,
      detail: r.description || "Your booking request",
      href: r.conversationId ? `/chat/${r.conversationId}` : "/bookings",
    })),
    ...(upcoming.data?.pendingConsults ?? []).map(c => ({
      key: `c${c.id}`,
      title: `Consultation with ${c.artistName}`,
      detail: c.subject || "Waiting for a time",
      href: c.conversationId ? `/chat/${c.conversationId}` : "/bookings",
    })),
  ];
  // Vouchers and offers the client can still use, like the list on their bookings page.
  const vouchers = (offers.data?.offers ?? []).filter(
    o =>
      (o.remainingValue > 0 || o.purchaseRequired) &&
      (!o.rules.expiresAt || new Date(o.rules.expiresAt).getTime() > now)
  );
  const projects = clientProjects([
    ...(upcoming.data?.appointments ?? []),
    ...(past.data?.appointments ?? []),
  ]);
  const artists = discoverArtists(feed.data?.cards ?? []);
  const chats = [...(conversations.data ?? [])].sort(
    (a, b) => (b.unreadCount || 0) - (a.unreadCount || 0)
  );
  const days = next ? daysUntil(next.startsAt, now) : null;
  const sitting = (a: (typeof sittings)[number]) =>
    a.sessionTotal && a.sessionTotal > 1
      ? `sitting ${a.sessionIndex} of ${a.sessionTotal}`
      : a.serviceName || "sitting";
  const project = (a: (typeof sittings)[number]) =>
    projectTitle(a.projectName, a.serviceName, a.title) ?? "Your tattoo";
  const inDays = (date: string) => {
    const n = daysUntil(date, now);
    return n === 0 ? relativeDay(date, now) : n === 1 ? "tomorrow" : `in ${n} days`;
  };
  const projectHref = (a: { conversationId: number | null; id: number }) =>
    a.conversationId ? `/projects/${a.conversationId}?session=${a.id}` : "/bookings";

  return (
    <div className="v3-screen iosm-home">
      <Link href="/settings" className="iosm-avatar" aria-label="Settings">
        <Avatar name={user?.name} src={user?.avatar} />
      </Link>
      <section className="iosm-lock" aria-label="Your tattoos at a glance">
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
          {/* The ring fills as the next sitting gets closer, over about two months. */}
          <Widget
            href="/bookings"
            value={days === null ? 0 : 1 - Math.min(1, days / 60)}
            label={days === null ? "–" : days === 0 ? "Today" : `${days}d`}
            caption={days === null ? "no sitting booked" : "to next sitting"}
          />
          {healing && (
            <Widget
              href={projectHref(healing.sitting)}
              value={healing.day / totalDays}
              label={`D${healing.day}`}
              caption={stage ? stage.label.toLowerCase() : "healing"}
            />
          )}
          <Widget
            href={forms[0] ? `${projectHref(forms[0])}&action=forms` : "/bookings"}
            value={formCount ? 1 : 0}
            label={String(formCount)}
            caption={formCount === 1 ? "form to sign" : "forms to sign"}
          />
        </div>
        {next && (
          <Link href={projectHref(next)} className="iosm-live">
            <span className="iosm-live-mark" aria-hidden="true">
              <ProjectArt src={next.imageUrl} name={project(next)} />
            </span>
            <span className="iosm-live-copy">
              <small>
                {live
                  ? "In the chair now"
                  : `Next sitting ${days === 0 ? relativeStart(next.startsAt, now) : days === 1 ? "tomorrow" : `in ${days} days`}`}
              </small>
              <strong>{project(next)}</strong>
              <em>
                with {next.artist.name} · {sitting(next)}
              </em>
            </span>
          </Link>
        )}
      </section>

      <Feedback
        loading={upcoming.isLoading}
        error={upcoming.error || conversations.error}
        onRetry={() => {
          void upcoming.refetch();
          void conversations.refetch();
        }}
      />

      {projects.length > 0 && (
        <Group
          id="tattoos"
          icon={<Images />}
          title="My tattoos"
          href="/bookings"
          open={open === "tattoos"}
          onToggle={toggle}
          peek={1}
        >
          <ProjectPostcards projects={projects} />
        </Group>
      )}

      {sittings.length > 0 && (
        <Group
          id="sittings"
          icon={<CalendarDays />}
          title="Your sittings"
          href="/bookings"
          open={open === "sittings"}
          onToggle={toggle}
        >
          {sittings.map(a => (
            <Note
              key={a.id}
              icon={a.imageUrl ? <ProjectArt src={a.imageUrl} name={project(a)} /> : <CalendarDays />}
              title={project(a)}
              detail={`${new Date(a.startsAt).toLocaleDateString("en-AU", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })} · ${a.artist.name}${a.balanceDueCents > 0 ? ` · ${money(a.balanceDueCents)} to pay` : ""}`}
              when={inDays(a.startsAt)}
              href={projectHref(a)}
              live={a === live}
            />
          ))}
        </Group>
      )}

      {healing && (
        <Group
          id="healing"
          icon={<Droplets />}
          title="Healing"
          href={projectHref(healing.sitting)}
          open={open === "healing"}
          onToggle={toggle}
          peek={1}
        >
          <Note
            icon={<Droplets />}
            title={`Day ${healing.day} of healing${stage ? ` · ${stage.label}` : ""}`}
            detail={
              stage?.instruction ||
              `${healing.sitting.projectName || "Your new tattoo"} · follow ${healing.sitting.artist.name}'s aftercare`
            }
            when="today"
            href={projectHref(healing.sitting)}
          />
          {phases
            .filter(p => p !== stage)
            .map(p => (
              <Note
                key={p.id}
                icon={<Droplets />}
                title={p.label}
                detail={`Days ${p.fromDay} to ${p.toDay} · ${p.instruction}`}
                when={healing.day > p.toDay ? "done" : `day ${p.fromDay}`}
                href={projectHref(healing.sitting)}
              />
            ))}
        </Group>
      )}

      {forms.length > 0 && (
        <Group
          id="forms"
          icon={<ClipboardCheck />}
          title="To sign"
          href="/bookings"
          open={open === "forms"}
          onToggle={toggle}
        >
          {forms.map(a => (
            <Note
              key={a.id}
              icon={<ClipboardCheck />}
              title={`${a.pendingFormCount} ${a.pendingFormCount === 1 ? "form" : "forms"} for ${project(a)}`}
              detail={`Before your sitting with ${a.artist.name}`}
              when={inDays(a.startsAt)}
              href={`${projectHref(a)}&action=forms`}
            />
          ))}
        </Group>
      )}

      {waiting.length > 0 && (
        <Group
          id="waiting"
          icon={<Hourglass />}
          title="Requests"
          href="/bookings"
          open={open === "waiting"}
          onToggle={toggle}
        >
          {waiting.map(w => (
            <Note
              key={w.key}
              icon={<Hourglass />}
              title={w.title}
              detail={w.detail}
              href={w.href}
            />
          ))}
        </Group>
      )}

      {chats.length > 0 && (
        <Group
          id="messages"
          icon={<MessageSquare />}
          title="Messages"
          href="/conversations"
          open={open === "messages"}
          onToggle={toggle}
        >
          {chats.map(c => (
            <Note
              key={c.id}
              icon={<MessageSquare />}
              title={`${c.otherUser?.name || "Conversation"}${c.unreadCount ? ` · ${c.unreadCount} new` : ""}`}
              detail={messagePreview(c.lastMessage?.content, c.lastMessage?.messageType)}
              href={`/chat/${c.id}`}
              live={!!c.unreadCount}
            />
          ))}
        </Group>
      )}

      {vouchers.length > 0 && (
        <Group
          id="vouchers"
          icon={<Gift />}
          title="Vouchers & offers"
          href="/bookings"
          open={open === "vouchers"}
          onToggle={toggle}
        >
          {vouchers.map(o => (
            <Note
              key={o.id}
              icon={<Gift />}
              title={o.rules.name}
              detail={`${o.artistName || "Your artist"} · ${
                o.purchaseRequired
                  ? "gift voucher to buy"
                  : o.rules.valueType === "percentage"
                    ? `${o.rules.value}% off`
                    : `${money(o.remainingValue, o.rules.currency)} left`
              }`}
              when={
                o.rules.expiresAt
                  ? `until ${new Date(o.rules.expiresAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}`
                  : undefined
              }
              href="/bookings"
            />
          ))}
        </Group>
      )}

      <Group
        id="discover"
        icon={<Compass />}
        title="Discover"
        href="/discover"
        open={open === "discover"}
        onToggle={toggle}
      >
        {artists.length > 0 ? (
          <ArtistCards artists={artists} />
        ) : (
          <Note
            icon={<Compass />}
            title="Find your next artist"
            detail="Browse artists by style and city"
            href="/discover"
          />
        )}
        <Note
          icon={<Gift />}
          title="Vouchers and purchases"
          detail="Gift cards, offers and shop orders"
          href="/purchases"
        />
      </Group>
      <p className="iosm-foot">Your details and settings live behind your photo, top right.</p>
    </div>
  );
}
