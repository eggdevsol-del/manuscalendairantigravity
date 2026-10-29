import { SittingCard } from "../components/SittingCard";
import { SittingSummary } from "../components/SittingSummary";
import { useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Orb, startOfDay, useNow } from "../design/LockParts";
import { addDays } from "../design/calendarDays";
import {
  daysUntil,
  isExternalEvent,
  nextSittingByClient,
} from "../design/landingData";
import { useLocation, useSearch } from "wouter";
import { Plus, MessageCircle, Mail, Phone, CheckCircle2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import {
  bookingDate,
  money,
  statusLabel,
} from "@/features/workspace/bookingPresentation";
import {
  Action,
  ActionLink,
  Avatar,
  Feedback,
  Panel,
  Row,
  Screen,
  SearchField,
  Section,
  Status,
  Tabs,
} from "../design/primitives";

export default function Clients() {
  const [path, go] = useLocation();
  const params = new URLSearchParams(useSearch());
  const selected = params.get("client");
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const query = trpc.conversations.getClients.useQuery();
  const create = trpc.conversations.createClient.useMutation({
    onSuccess: () => {
      setAdding(false);
      setForm({ name: "", email: "", phone: "" });
      void query.refetch();
    },
  });
  const people = (query.data || [])
    .filter((c): c is NonNullable<typeof c> => !!c)
    .filter(c =>
      `${c.name} ${c.email} ${c.phone}`
        .toLowerCase()
        .includes(search.trim().toLowerCase())
    );
  return (
    <Screen
      title="Clients"
      subtitle="Your people and their pieces"
      wide
      action={
        <Action
          onClick={() => {
            create.reset();
            setAdding(true);
          }}
        >
          <Plus />
          Add client
        </Action>
      }
    >
      <div className={`v3-client-layout ${selected ? "has-selection" : ""}`}>
        <section className="v3-client-list">
          <SearchField
            value={search}
            onChange={setSearch}
            label="Search clients"
            placeholder="Name, email or phone"
          />
          <Feedback
            loading={query.isLoading}
            error={query.error}
            onRetry={() => query.refetch()}
            empty={
              !query.isLoading && !query.error && !people.length
                ? search
                  ? "No matching clients. Try a different name."
                  : "Clients appear here when they enquire. You can also add an existing client."
                : undefined
            }
          />
          <ClientCircles
            people={people}
            selected={selected}
            onOpen={id => go(`/clients?client=${encodeURIComponent(id)}`)}
          />
        </section>
        <aside className="v3-client-detail" aria-label="Client details">
          {selected ? (
            <ClientDetail
              key={selected}
              id={selected}
              onClose={() => go("/clients")}
            />
          ) : (
            <Feedback empty="Choose a client to see their bookings, forms and notes." />
          )}
        </aside>
      </div>
      <SheetShell
        isOpen={adding}
        onClose={() => setAdding(false)}
        title="Add client"
      >
        <form
          className="v3-form"
          onSubmit={e => {
            e.preventDefault();
            create.mutate({
              name: form.name.trim(),
              email: form.email.trim() || null,
              phone: form.phone.trim() || null,
            });
          }}
        >
          <p className="v3-muted">
            Add their details now. You can send a booking proposal when you’re
            ready.
          </p>
          <label>
            Full name
            <input
              required
              autoComplete="name"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            Email (optional)
            <input
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label>
            Phone (optional)
            <input
              type="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
            />
          </label>
          {create.error && <p role="alert">{create.error.message}</p>}
          <Action
            type="submit"
            data-tour-description="Save the entered name and optional contact details as a client record. Review the details before adding the client."
            disabled={!form.name.trim() || create.isPending}
          >
            {create.isPending ? "Adding…" : "Add client"}
          </Action>
        </form>
      </SheetShell>
    </Screen>
  );
}
function ClientDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const query = trpc.projects.clientWorkspace.useQuery({ clientId: id });
  const [tab, setTab] = useState<"Bookings" | "Forms" | "Notes">("Bookings");
  const [note, setNote] = useState("");
  const add = trpc.clientProfile.addClientNote.useMutation({
    onSuccess: () => {
      setNote("");
      void query.refetch();
    },
  });
  const data = query.data;
  return (
    <div className="v3-stack">
      <Action tone="quiet" onClick={onClose}>
        Back to all clients
      </Action>
      <Feedback
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
      />
      {data?.client && (
        <>
          <div className="v3-inline">
            <Avatar name={data.client.name} src={data.client.avatar} />
            <h2 className="v3-detail-title">{data.client.name}</h2>
          </div>
          {data.client.email && (
            <a className="v3-inline" href={`mailto:${data.client.email}`}>
              <Mail size={18} />
              {data.client.email}
            </a>
          )}
          {data.client.phone && (
            <a className="v3-inline" href={`tel:${data.client.phone}`}>
              <Phone size={18} />
              {data.client.phone}
            </a>
          )}
          <ActionLink href={`/chat/${data.conversationId}`}>
            <MessageCircle />
            Message {data.client.name?.split(" ")[0]}
          </ActionLink>
          <Tabs
            items={["Bookings", "Forms", "Notes"] as const}
            value={tab}
            onChange={setTab}
            label="Client information"
          />
          {tab === "Bookings" && (
            <Section title="Session history">
              {!data.sessions.length && (
                <Feedback empty="No sessions yet. Start a booking from the conversation." />
              )}
              {data.sessions.map(s => (
                <SittingCard
                  key={s.id}
                  title={s.title}
                  detail={`${bookingDate(s.startTime, s.timeZone)} · ${statusLabel(s.status)}`}
                >
                  {s.conversationId ? (
                    <SittingSummary
                      conversationId={s.conversationId}
                      appointmentId={s.id}
                    />
                  ) : (
                    <>
                      <p>{money(s.paidCents)} paid</p>
                      <ActionLink
                        href={`/calendar?appointment=${s.id}&date=${encodeURIComponent(s.startTime)}`}
                      >
                        Open sitting & actions
                      </ActionLink>
                    </>
                  )}
                </SittingCard>
              ))}
            </Section>
          )}
          {tab === "Forms" && (
            <Section title="Consent & medical forms">
              {!data.forms.length && (
                <Feedback empty="Forms will appear when sessions are booked." />
              )}
              {data.forms.map(f => (
                <Row
                  key={f.id}
                  title={f.title}
                  detail={statusLabel(f.status)}
                  icon={f.status === "signed" ? <CheckCircle2 /> : undefined}
                  href={
                    f.appointmentId
                      ? `/projects/${data.conversationId}?session=${f.appointmentId}`
                      : undefined
                  }
                />
              ))}
            </Section>
          )}
          {tab === "Notes" && (
            <>
              <form
                className="v3-form"
                onSubmit={e => {
                  e.preventDefault();
                  add.mutate({ clientId: id, note: note.trim() });
                }}
              >
                <label>
                  Private artist note
                  <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    required
                    placeholder="Useful details for the next session"
                  />
                </label>
                <small>Only visible in your artist account.</small>
                {add.error && <p role="alert">{add.error.message}</p>}
                <Action type="submit" disabled={!note.trim() || add.isPending}>
                  {add.isPending ? "Saving…" : "Save note"}
                </Action>
              </form>
              {data.notes.map(n => (
                <Panel key={n.id}>
                  <p style={{ whiteSpace: "pre-wrap" }}>{n.note}</p>
                  <small className="v3-muted">
                    {n.createdAt && bookingDate(n.createdAt)}
                  </small>
                </Panel>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}

/** People, as in the prototype: one circle per client, grouped by their next sitting. A bigger circle
 *  means they have spent more with you, and the ring fills as their next sitting gets closer. The amount
 *  spent and the sittings come from the client list and the calendar. */
function ClientCircles({
  people,
  selected,
  onOpen,
}: {
  people: {
    id: string;
    name?: string | null;
    avatar?: string | null;
    tlv?: number | null;
    hasLead?: boolean | null;
  }[];
  selected: string | null;
  onOpen: (id: string) => void;
}) {
  const { user } = useAuth();
  const now = useNow();
  const today0 = startOfDay(now);
  const range = useMemo(
    () => ({ start: new Date(today0), end: new Date(addDays(today0, 366)) }),
    [today0]
  );
  const calendar = trpc.appointments.getArtistCalendar.useQuery(
    { artistId: user?.id ?? "", startDate: range.start, endDate: range.end },
    { enabled: !!user?.id }
  );
  const next = new Map(
    nextSittingByClient(
      ((calendar.data ?? []) as any[]).filter(a => !isExternalEvent(a)),
      now
    ).map(a => [a.clientId as string, daysUntil(a.startTime, now)])
  );
  const most = Math.max(1, ...people.map(p => p.tlv || 0));
  const groups = [
    ["This week", people.filter(p => (next.get(p.id) ?? 999) <= 7)],
    ["This month", people.filter(p => { const d = next.get(p.id); return d !== undefined && d > 7 && d <= 31; })],
    ["Later", people.filter(p => (next.get(p.id) ?? -1) > 31)],
    ["Not booked yet", people.filter(p => !next.has(p.id))],
  ] as const;
  const note = (p: (typeof people)[number]) => {
    const d = next.get(p.id);
    if (d !== undefined) return d === 0 ? "Today" : d === 1 ? "Tomorrow" : `in ${d} days`;
    if (p.hasLead) return "Sent a request";
    return p.tlv ? `${money(Math.round(p.tlv * 100))} spent` : "New";
  };
  return (
    <div className="iosm-constellation">
      {groups
        .filter(([, list]) => list.length)
        .map(([title, list]) => (
          <section key={title} aria-label={title}>
            <h3>
              {title} <span>{list.length}</span>
            </h3>
            <div className="iosm-stars">
              {[...list]
                .sort(
                  (a, b) =>
                    (next.get(a.id) ?? 999) - (next.get(b.id) ?? 999) ||
                    (b.tlv || 0) - (a.tlv || 0)
                )
                .map(p => {
                  const d = next.get(p.id);
                  const name = p.name || "Client";
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className="iosm-star"
                      aria-label={`${name}, ${note(p)}`}
                      aria-current={selected === p.id ? "true" : undefined}
                      onClick={() => onOpen(p.id)}
                    >
                      <Orb
                        name={name}
                        src={p.avatar}
                        fill={d === undefined ? 0 : 1 - Math.min(1, d / 60)}
                        size={Math.round(48 + ((p.tlv || 0) / most) * 26)}
                      />
                      <b>{name.split(" ")[0]}</b>
                      <span>{note(p)}</span>
                    </button>
                  );
                })}
            </div>
          </section>
        ))}
      <p className="iosm-caption">
        Bigger circles have spent more with you. The ring fills as their next
        sitting gets closer.
      </p>
    </div>
  );
}
