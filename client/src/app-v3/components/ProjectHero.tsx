import { Droplets } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { trpc } from "@/lib/trpc";
import { conversationMedia } from "../data/messagePresentation";
import { projectProgress, type ProjectSitting } from "../data/projectProgress";
import { ProjectArt } from "../design/LockParts";
import { aftercareStage } from "../design/landingData";

/** The top of a project, as in the prototype: the project's picture (the first reference shared in its
 *  conversation, or the client's initials), a dot for each sitting with its date, and, while a finished
 *  sitting heals, the stage from the artist's aftercare guide with a ring for the healing days. */
export function ProjectHero({
  conversationId,
  title,
  person,
  sittings,
}: {
  conversationId: number;
  title: string;
  person: string;
  sittings: (ProjectSitting & { startsAt?: string | null })[];
}) {
  const references = trpc.messages.references.useQuery(
    { conversationId },
    { enabled: conversationId > 0 }
  );
  const image = conversationMedia(references.data || [])[0];
  // Dots follow the sitting number, so a rescheduled sitting keeps its place; each shows its own date.
  const ordered = [...sittings].sort(
    (a, b) =>
      (a.sessionIndex || Infinity) - (b.sessionIndex || Infinity) ||
      Date.parse(a.startsAt || "") - Date.parse(b.startsAt || "") ||
      a.id - b.id
  );
  // The last finished sitting is the one most recently done, whatever its number.
  const byDate = [...sittings].sort(
    (a, b) => Date.parse(a.startsAt || "") - Date.parse(b.startsAt || "")
  );
  const progress = projectProgress(sittings);
  const toBook = Math.max(0, (progress.total ?? 0) - ordered.length);
  const lastDone = [...byDate].reverse().find(s => s.status === "completed");
  const aftercare = trpc.aftercare.getForBooking.useQuery(
    { appointmentId: lastDone?.id ?? 0 },
    { enabled: !!lastDone }
  );
  const care = aftercare.data;
  const phases = [...(care?.template?.phases ?? [])].sort(
    (a: any, b: any) => a.fromDay - b.fromDay
  );
  const healing = care && !care.isHealed && care.daysSince <= care.totalDays;
  const stage = healing ? aftercareStage(phases, care.daysSince) : null;
  const ringR = 15;
  const ringC = 2 * Math.PI * ringR;
  const ringF = healing ? Math.min(1, care.daysSince / Math.max(1, care.totalDays)) : 0;
  return (
    <section className="iosm-project-hero" aria-label={title}>
      <span className="iosm-hero-art">
        <ProjectArt src={image} name={person} />
        <span className="iosm-hero-copy">
          <i>with {person}</i>
          <b>{title}</b>
        </span>
      </span>
      <ol className="iosm-sprog" aria-label="Sittings">
        {ordered.map((s, i) => (
          <li key={s.id} className={s.status}>
            <b>{s.sessionIndex || i + 1}</b>
            <small>
              {s.startsAt
                ? formatInTimeZone(
                    new Date(s.startsAt),
                    s.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
                    "d MMM"
                  )
                : "No date"}
            </small>
          </li>
        ))}
        {Array.from({ length: toBook }, (_, i) => (
          <li key={`todo-${i}`} className="todo">
            <b>{ordered.length + i + 1}</b>
            <small>to book</small>
          </li>
        ))}
      </ol>
      {healing && (
        <div className="iosm-hero-heal">
          <i aria-hidden="true">
            <Droplets />
          </i>
          <span>
            <b>
              Healing, day {care.daysSince}
              {stage ? ` · ${stage.label}` : ""}
            </b>
            {stage?.instruction && <em>{stage.instruction}</em>}
          </span>
          <svg viewBox="0 0 34 34" aria-label={`Day ${care.daysSince} of ${care.totalDays}`}>
            <circle cx="17" cy="17" r={ringR} className="bg" />
            <circle
              cx="17"
              cy="17"
              r={ringR}
              className="fg"
              strokeDasharray={`${ringC * ringF} ${ringC}`}
              transform="rotate(-90 17 17)"
            />
          </svg>
        </div>
      )}
    </section>
  );
}
