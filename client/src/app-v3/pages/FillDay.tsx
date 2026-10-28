import { useState, type ReactNode } from "react";
import { format } from "date-fns";
import {
  ChevronRight,
  Hourglass,
  Link2,
  Plus,
  Sparkles,
} from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { money } from "@/features/workspace/bookingPresentation";
import { firstImage } from "../design/lockHome";
import {
  duration,
  freeMinutes,
  hoursFor,
  saveDay,
  savedDay,
  savedKeys,
} from "../design/calendarDays";
import { Feedback } from "../design/primitives";

const clock = (mins: number) =>
  format(new Date(2000, 0, 1, Math.floor(mins / 60), mins % 60), "h:mmaaa");

/** Every way to turn a free day into a booked one, best match first, under a live display of the day. */
export function FillDay({
  day,
  sittings,
  schedule,
  services,
  onBook,
}: {
  day: number;
  sittings: any[];
  schedule: any[];
  services: { name: string; duration: number; price: number }[];
  onBook: () => void;
}) {
  const [, go] = useLocation();
  const waitlist = trpc.waitlist.list.useQuery();
  const leads = trpc.funnel.getLeads.useQuery({
    status: "new",
    limit: 5,
    offset: 0,
  });
  const [, rerender] = useState(0);
  const hours = hoursFor(schedule, day);
  const free = freeMinutes(schedule, day, sittings);
  const date = format(day, "yyyy-MM-dd");
  const start = new Date(day);
  start.setHours(Math.floor(hours.start / 60), hours.start % 60, 0, 0);
  // What the free time is worth at the rate of the first saved service.
  const svc = services.find(s => s.duration > 0 && s.price > 0);
  const worth = svc
    ? Math.round(((svc.price * 100) / svc.duration) * free / 5000) * 5000
    : 0;
  const waiting = (waitlist.data ?? []).filter(w => w.status === "waiting");
  const requests = leads.data?.leads ?? [];

  return (
    <div className="iosm-fillsheet">
      <div className="iosm-fill-stage">
        <small>
          {format(day, "EEEE d MMMM")}
          {hours.open ? "" : " · usually a day off"}
        </small>
        <b>{worth ? money(worth).replace(/\.00$/, "") : duration(free)}</b>
        <em>
          {worth ? `open to earn · ${duration(free)} free` : "free"}
          {sittings.length
            ? ` around ${sittings.length} booking${sittings.length === 1 ? "" : "s"}`
            : ` · ${clock(hours.start)}–${clock(hours.end)}`}
        </em>
        <span className="iosm-fill-ghost">
          <b>{sittings.length ? "Room for more" : "Your empty day"}</b>
          <em>{duration(free)} free</em>
        </span>
      </div>
      <Feedback
        loading={waitlist.isLoading || leads.isLoading}
        error={waitlist.error || leads.error}
        onRetry={() => {
          void waitlist.refetch();
          void leads.refetch();
        }}
      />
      {waiting.length > 0 && (
        <Choices title="Ready to come in sooner">
          {waiting.map(w => (
            <Choice
              key={w.id}
              icon={<Hourglass />}
              title={`Offer it to ${w.name || "your client"}`}
              detail={w.note || "On your cancellation waitlist"}
              onClick={() =>
                go(
                  `/waitlist?offer=${w.id}&start=${format(start, "yyyy-MM-dd'T'HH:mm")}`
                )
              }
            />
          ))}
        </Choices>
      )}
      {requests.length > 0 && (
        <Choices title="Waiting on a reply">
          {requests.slice(0, 3).map(lead => {
            const keys = savedKeys(lead.clientId, lead.conversationId);
            const saved = savedDay(keys) === date;
            const img = firstImage(lead.referenceImages);
            const first = String(lead.clientName || "them").split(" ")[0];
            return (
              <Choice
                key={lead.id}
                icon={<Sparkles />}
                image={img}
                title={`Quote ${first} for this day`}
                detail={`${String(lead.projectType || "Tattoo").replace(/-/g, " ")}${lead.budgetLabel ? ` · ${lead.budgetLabel}` : ""}${saved ? " · date saved" : ""}`}
                onClick={() => {
                  // Remember the day so the booking composer offers it when you book them.
                  if (keys.length) saveDay(keys, date);
                  rerender(n => n + 1);
                  go(`/lead/${lead.id}`);
                }}
              />
            );
          })}
        </Choices>
      )}
      <Choices title="Reach more people">
        <Choice
          icon={<Link2 />}
          title="Share your booking page"
          detail="New clients can ask for this day"
          onClick={() => go("/artist-profile")}
        />
      </Choices>
      <Choices title="Or">
        <Choice
          icon={<Plus />}
          title="Book someone yourself"
          detail="Choose a client, a service and a time"
          onClick={onBook}
        />
      </Choices>
    </div>
  );
}

function Choices({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="iosm-choices">
      <h4>{title}</h4>
      {children}
    </section>
  );
}

function Choice({
  icon,
  image,
  title,
  detail,
  onClick,
}: {
  icon: ReactNode;
  image?: string | null;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="iosm-note" onClick={onClick}>
      {image ? (
        <img className="iosm-note-icon" src={image} alt="" />
      ) : (
        <span className="iosm-note-icon">{icon}</span>
      )}
      <span className="iosm-note-copy">
        <strong>{title}</strong>
        <span>{detail}</span>
      </span>
      <ChevronRight className="iosm-note-chev" aria-hidden="true" />
    </button>
  );
}
