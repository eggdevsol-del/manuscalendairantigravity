import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { bookingDate, money } from "@/features/workspace/bookingPresentation";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import {
  Action,
  ActionLink,
  Feedback,
  Panel,
  Screen,
  Status,
} from "../design/primitives";
export default function Events() {
  const query = trpc.storefront.getSeminars.useQuery();
  const settings = trpc.artistSettings.get.useQuery();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    title: "",
    description: "",
    type: "in_person" as "in_person" | "virtual",
    date: "",
    location: "",
    capacity: "10",
    price: "",
  });
  const create = trpc.storefront.createSeminar.useMutation({
    onSuccess: () => {
      void query.refetch();
      setOpen(false);
      setDraft({
        title: "",
        description: "",
        type: "in_person",
        date: "",
        location: "",
        capacity: "10",
        price: "",
      });
    },
  });
  return (
    <Screen
      title="Your events"
      subtitle="Workshops and seminars, in person or online."
      back="/artist-profile"
      action={
        <Action
          onClick={() => {
            create.reset();
            setOpen(true);
          }}
        >
          Create event
        </Action>
      }
    >
      {settings.data?.publicSlug && (
        <ActionLink
          href={`/events/${encodeURIComponent(settings.data.publicSlug)}`}
        >
          Preview events page
        </ActionLink>
      )}
      <Feedback
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
      />
      {query.data?.length === 0 && (
        <Feedback empty="Create your first workshop when you’re ready to take registrations." />
      )}
      {query.data?.map(event => (
        <Panel key={event.id}>
          <Status>{event.type === "virtual" ? "Online" : "In person"}</Status>
          <h2>{event.title}</h2>
          <p>{bookingDate(event.date)}</p>
          <p>{event.description}</p>
          <p>
            {event.ticketsSold} / {event.capacity} places booked ·{" "}
            {money(event.priceCents)} AUD
          </p>
          {event.locationUrl && <p>{event.locationUrl}</p>}
        </Panel>
      ))}
      <SheetShell
        isOpen={open}
        title="Create an event"
        onClose={() => {
          if (!create.isPending) setOpen(false);
        }}
      >
        <form
          className="v3-form"
          onSubmit={e => {
            e.preventDefault();
            create.mutate({
              title: draft.title.trim(),
              description: draft.description.trim(),
              type: draft.type,
              date: new Date(draft.date).toISOString(),
              locationUrl: draft.location.trim() || undefined,
              capacity: Number(draft.capacity),
              priceCents: Math.round(Number(draft.price) * 100),
            });
          }}
        >
          <fieldset disabled={create.isPending}>
            <label>
              Event name
              <input
                required
                maxLength={255}
                value={draft.title}
                onChange={e => setDraft({ ...draft, title: e.target.value })}
              />
            </label>
            <label>
              Description
              <textarea
                required
                rows={4}
                value={draft.description}
                onChange={e =>
                  setDraft({ ...draft, description: e.target.value })
                }
              />
            </label>
            <label>
              Format
              <select
                aria-label="Event format"
                value={draft.type}
                onChange={e =>
                  setDraft({
                    ...draft,
                    type: e.target.value as typeof draft.type,
                  })
                }
              >
                <option value="in_person">In person</option>
                <option value="virtual">Online</option>
              </select>
            </label>
            <label>
              Date and time
              <input
                required
                type="datetime-local"
                value={draft.date}
                onChange={e => setDraft({ ...draft, date: e.target.value })}
              />
              <small>{Intl.DateTimeFormat().resolvedOptions().timeZone}</small>
            </label>
            <label>
              {draft.type === "virtual"
                ? "Event access URL"
                : "Venue or location URL"}
              <input
                required
                type={draft.type === "virtual" ? "url" : "text"}
                value={draft.location}
                onChange={e => setDraft({ ...draft, location: e.target.value })}
              />
            </label>
            <label>
              Available places
              <input
                required
                type="number"
                min={1}
                max={10000}
                step={1}
                value={draft.capacity}
                onChange={e => setDraft({ ...draft, capacity: e.target.value })}
              />
            </label>
            <label>
              Price per person · AUD
              <input
                required
                type="number"
                min={1}
                max={100000}
                step={0.01}
                value={draft.price}
                onChange={e => setDraft({ ...draft, price: e.target.value })}
              />
            </label>
            <p>
              The event is published when you create it. Online access links are
              shown to paid attendees.
            </p>
            {create.error && <p role="alert">{create.error.message}</p>}
            <Action type="submit">
              {create.isPending ? "Publishing…" : "Publish event"}
            </Action>
          </fieldset>
        </form>
      </SheetShell>
    </Screen>
  );
}
