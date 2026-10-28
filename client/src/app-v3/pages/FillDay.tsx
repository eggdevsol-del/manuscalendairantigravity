import { useState, type ReactNode } from "react";
import { format } from "date-fns";
import {
  ChevronRight,
  Gift,
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
  savedKeys,
} from "../design/calendarDays";
import { Action, Feedback } from "../design/primitives";
import { useSavedDays } from "../data/useSavedDays";
import { TouchSlider } from "../design/live";
import { OfferAudience, OfferCard } from "../components/Offers";
import type { OfferRules } from "@shared/offerRules";

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
  const saved = useSavedDays();
  const [offering, setOffering] = useState(false);
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

  if (offering)
    return <LastMinuteOffer day={day} start={start} onBack={() => setOffering(false)} />;
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
            const isSaved = saved.get(keys) === date;
            const img = firstImage(lead.referenceImages);
            const first = String(lead.clientName || "them").split(" ")[0];
            return (
              <Choice
                key={lead.id}
                icon={<Sparkles />}
                image={img}
                title={`Quote ${first} for this day`}
                detail={`${String(lead.projectType || "Tattoo").replace(/-/g, " ")}${lead.budgetLabel ? ` · ${lead.budgetLabel}` : ""}${isSaved ? " · date saved" : ""}`}
                onClick={() => {
                  // Remember the day so the booking composer offers it when you book them.
                  void saved.save(keys, date).finally(() => go(`/lead/${lead.id}`));
                }}
              />
            );
          })}
        </Choices>
      )}
      <Choices title="Reach more people">
        <Choice
          icon={<Gift />}
          title="Post a last-minute offer"
          detail={`A discount on sittings on ${format(day, "EEE d MMM")}, sent to clients you choose`}
          onClick={() => setOffering(true)}
        />
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

/** A discount for sittings on this one day. The slider sets it and the card shows the offer clients will
 *  receive. Creating it saves the offer, then the usual audience step decides who it's sent to. */
function LastMinuteOffer({
  day,
  start,
  onBack,
}: {
  day: number;
  start: Date;
  onBack: () => void;
}) {
  const offers = trpc.offers.list.useQuery();
  const save = trpc.offers.save.useMutation();
  const [percent, setPercent] = useState(15);
  const [saved, setSaved] = useState<number | null>(null);
  const [sent, setSent] = useState("");
  const end = new Date(day);
  end.setHours(23, 59, 0, 0);
  // The offer must be claimed before the day starts, or before the day ends if it's today.
  const expires = start.getTime() > Date.now() + 3600000 ? start : end;
  const rules: OfferRules = {
    name: `${percent}% off ${format(day, "EEE d MMM")}`,
    description: `A last-minute opening. ${percent}% off a sitting on ${format(day, "EEEE d MMMM")}.`,
    kind: "discount",
    valueType: "percentage",
    value: percent,
    currency: "AUD",
    eligibility: "new",
    expiresAt: expires.toISOString(),
    sittingFrom: new Date(day).toISOString(),
    sittingUntil: end.toISOString(),
    backgroundImageUrl: "",
  };
  if (offers.data?.enabled === false)
    return (
      <div className="iosm-fillsheet">
        <p>Promotions aren't switched on for this server yet.</p>
        <Action tone="secondary" onClick={onBack}>
          Back
        </Action>
      </div>
    );
  if (sent)
    return (
      <div className="iosm-fillsheet">
        <p role="status">{sent}</p>
        <Action tone="secondary" onClick={onBack}>
          Done
        </Action>
      </div>
    );
  if (saved)
    return (
      <div className="iosm-fillsheet">
        <OfferCard rules={rules} />
        <OfferAudience id={saved} onDone={setSent} />
      </div>
    );
  return (
    <div className="iosm-fillsheet">
      <OfferCard rules={rules} />
      <TouchSlider
        label="Last-minute discount"
        tone="money"
        value={percent}
        min={5}
        max={40}
        step={5}
        format={v => `${v}% off`}
        onChange={setPercent}
      />
      <p className="iosm-fill-note">
        Only for sittings on {format(day, "EEEE d MMMM")}. Clients can claim it until{" "}
        {format(expires, "h:mmaaa EEE d MMM")}. You choose who receives it next.
      </p>
      {save.error && <p role="alert">{save.error.message}</p>}
      <Action
        disabled={save.isPending}
        onClick={async () => {
          const result = await save.mutateAsync({ rules }).catch(() => null);
          if (result) setSaved(result.id);
        }}
      >
        {save.isPending ? "Creating…" : "Create offer and choose clients"}
      </Action>
      <Action tone="quiet" onClick={onBack}>
        Back
      </Action>
    </div>
  );
}
