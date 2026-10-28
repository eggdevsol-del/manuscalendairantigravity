import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import {
  Action,
  ActionLink,
  Feedback,
  Panel,
  Row,
  Screen,
  Section,
} from "../design/primitives";
import { LiveStage } from "../design/live";
type Trip = {
  id: string;
  location: string;
  country: string;
  startDate: string;
  endDate: string;
  lat?: number;
  lng?: number;
  [key: string]: unknown;
};
export default function Travel() {
  const query = trpc.artistSettings.get.useQuery();
  let trips: Trip[] = [],
    invalid = false;
  try {
    trips = JSON.parse(query.data?.travelDates || "[]");
    if (
      !Array.isArray(trips) ||
      trips.some(
        trip =>
          !trip ||
          typeof trip.id !== "string" ||
          typeof trip.location !== "string" ||
          typeof trip.country !== "string"
      )
    )
      throw new Error();
  } catch {
    invalid = true;
  }
  return (
    <Screen
      title="Travel & guest spots"
      subtitle="Your itinerary and clients at each destination."
      back="/settings"
    >
      <Feedback
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
      />
      {invalid ? (
        <p role="alert">
          Your saved trips could not be read. They have not been changed.
        </p>
      ) : (
        query.data && <Itinerary initial={trips} />
      )}
    </Screen>
  );
}
function Itinerary({ initial }: { initial: Trip[] }) {
  const [trips, setTrips] = useState(initial);
  const [draft, setDraft] = useState<Trip | null>(null);
  const [remove, setRemove] = useState<Trip | null>(null);
  const [matching, setMatching] = useState<Trip | null>(null);
  const utils = trpc.useUtils();
  const save = trpc.artistSettings.upsert.useMutation();
  function write(next: Trip[]) {
    save.mutate(
      { travelDates: JSON.stringify(next) },
      {
        onSuccess: () => {
          setTrips(next);
          setDraft(null);
          setRemove(null);
          void utils.artistSettings.invalidate();
        },
      }
    );
  }
  return (
    <>
      <TravelRibbon trips={trips} />
      <Panel>
        <p>
          Save your guest spots and find existing clients in the same city or
          country. Saving a trip does not send messages or change your booking
          availability.
        </p>
        <ActionLink href="/work-hours">Manage working hours</ActionLink>
      </Panel>
      <Section
        title="Your itinerary"
        action={
          <Action
            onClick={() => {
              save.reset();
              setDraft({
                id: crypto.randomUUID(),
                location: "",
                country: "",
                startDate: "",
                endDate: "",
              });
            }}
          >
            Add trip
          </Action>
        }
      >
        {!trips.length && <p>No travel dates yet.</p>}
        {trips
          .slice()
          .sort((a, b) => a.startDate.localeCompare(b.startDate))
          .map(trip => (
            <Panel key={trip.id}>
              <h2>
                {trip.location}, {trip.country}
              </h2>
              <p>
                {trip.startDate} – {trip.endDate}
              </p>
              <div className="v3-inline">
                <Action tone="secondary" onClick={() => setMatching(trip)}>
                  Find clients
                </Action>
                <Action
                  tone="quiet"
                  onClick={() => {
                    save.reset();
                    setDraft({ ...trip });
                  }}
                >
                  Edit trip
                </Action>
                <Action
                  tone="quiet"
                  onClick={() => {
                    save.reset();
                    setRemove(trip);
                  }}
                >
                  Remove
                </Action>
              </div>
            </Panel>
          ))}
      </Section>
      {draft && (
        <SheetShell
          isOpen
          title="Travel dates"
          onClose={() => {
            if (!save.isPending) setDraft(null);
          }}
        >
          <form
            className="v3-form"
            onSubmit={e => {
              e.preventDefault();
              write([...trips.filter(trip => trip.id !== draft.id), draft]);
            }}
          >
            <TravelRibbon
              trips={[...trips.filter(trip => trip.id !== draft.id), draft]}
              highlight={draft.id}
            />
            <fieldset disabled={save.isPending}>
              <label>
                City
                <input
                  required
                  maxLength={120}
                  value={draft.location}
                  onChange={e =>
                    setDraft({
                      ...draft,
                      location: e.target.value,
                      lat: undefined,
                      lng: undefined,
                    })
                  }
                />
              </label>
              <label>
                Country
                <input
                  required
                  maxLength={120}
                  value={draft.country}
                  onChange={e =>
                    setDraft({
                      ...draft,
                      country: e.target.value,
                      lat: undefined,
                      lng: undefined,
                    })
                  }
                />
              </label>
              <div className="v3-form-pair">
                <label>
                  From
                  <input
                    type="date"
                    required
                    value={draft.startDate}
                    onChange={e =>
                      setDraft({ ...draft, startDate: e.target.value })
                    }
                  />
                </label>
                <label>
                  Until
                  <input
                    type="date"
                    required
                    min={draft.startDate}
                    value={draft.endDate}
                    onChange={e =>
                      setDraft({ ...draft, endDate: e.target.value })
                    }
                  />
                </label>
              </div>
              {save.error && <p role="alert">{save.error.message}</p>}
              <Action type="submit">
                {save.isPending ? "Saving…" : "Save trip"}
              </Action>
            </fieldset>
          </form>
        </SheetShell>
      )}
      {remove && (
        <SheetShell
          isOpen
          title={`Remove ${remove.location} trip?`}
          onClose={() => {
            if (!save.isPending) setRemove(null);
          }}
        >
          <div className="v3-stack">
            <p>Your existing bookings remain unchanged.</p>
            {save.error && <p role="alert">{save.error.message}</p>}
            <Action
              tone="danger"
              disabled={save.isPending}
              onClick={() => write(trips.filter(trip => trip.id !== remove.id))}
            >
              {save.isPending ? "Removing…" : "Remove trip"}
            </Action>
            <Action
              tone="secondary"
              onClick={() => setRemove(null)}
              disabled={save.isPending}
            >
              Keep trip
            </Action>
          </div>
        </SheetShell>
      )}
      {matching && (
        <SheetShell
          isOpen
          title={`Clients near ${matching.location}`}
          onClose={() => setMatching(null)}
        >
          <MatchedClients trip={matching} />
        </SheetShell>
      )}
    </>
  );
}
function MatchedClients({ trip }: { trip: Trip }) {
  const query = trpc.artistSettings.matchClientsByLocation.useQuery({
    city: trip.location,
    country: trip.country,
  });
  return (
    <div className="v3-stack">
      <p>
        Matches use the city or country on your existing clients’ profiles.
        Review their location before making plans.
      </p>
      <Feedback
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
      />
      {query.data?.total === 0 && <p>No matching clients.</p>}
      {query.data?.clients.map(client => (
        <Row
          key={client.id}
          title={client.name || client.email || "Client"}
          detail={[client.city, client.country].filter(Boolean).join(", ")}
          href={`/clients?client=${client.id}`}
        />
      ))}
    </div>
  );
}

/** The next six months as a flight ribbon, with a stamp for each trip. The trip you're editing glows. */
function TravelRibbon({ trips, highlight }: { trips: Trip[]; highlight?: string }) {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 6);
  const span = end.getTime() - start.getTime();
  const at = (d: string) => new Date(`${d}T00:00`).getTime();
  const months = Array.from({ length: 6 }, (_, i) => {
    const m = new Date(start);
    m.setMonth(m.getMonth() + i);
    return m.toLocaleDateString("en-AU", { month: "short" });
  });
  const shown = trips.filter(
    t => t.startDate && t.endDate && at(t.endDate) >= start.getTime() && at(t.startDate) < end.getTime()
  );
  return (
    <LiveStage className="iosm-ribbon" label="Your next six months of travel">
      <span className="iosm-rib-months">
        {months.map(m => (
          <span key={m}>{m}</span>
        ))}
      </span>
      <span className="iosm-rib-road">
        {shown.map(t => {
          const left = Math.max(0, ((at(t.startDate) - start.getTime()) / span) * 100);
          const width = Math.max(
            2,
            ((at(t.endDate) + 86400000 - Math.max(at(t.startDate), start.getTime())) / span) * 100
          );
          return (
            <span key={t.id}>
              <i
                className={t.id === highlight ? "on" : ""}
                style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }}
              />
              <s
                className={t.id === highlight ? "on" : ""}
                style={{ left: `${Math.min(70, left)}%` }}
              >
                <b>{t.location || "New trip"}</b>
                <small>
                  {new Date(`${t.startDate}T12:00`).toLocaleDateString("en-AU", {
                    day: "numeric",
                    month: "short",
                  })}
                </small>
              </s>
            </span>
          );
        })}
        {!shown.length && <em>No trips in the next six months</em>}
      </span>
    </LiveStage>
  );
}
