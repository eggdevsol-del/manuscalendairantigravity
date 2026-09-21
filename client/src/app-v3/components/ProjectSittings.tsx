import { DetailsSheet } from "./DetailsSheet";
import {
  bookingDate,
  statusLabel,
} from "@/features/workspace/bookingPresentation";
import { useState, useEffect, type ReactNode } from "react";
import {
  nextProjectSitting,
  type ProjectSitting,
} from "../data/projectProgress";

/** The project disclosure reveals its sitting rows in one step. */
export function ProjectSittings<T extends ProjectSitting>({
  sittings,
  render,
}: {
  sittings: T[];
  selectedId?: number | null;
  render: (sitting: T, index: number) => ReactNode;
}) {
  const next = nextProjectSitting(sittings);
  return (
    <div className="ivory-project-sittings">
      <ol className="v3-sitting-list" aria-label="Project sittings">
        {sittings.map(s => (
          <li key={s.id} data-next={s.id === next?.id}>
            {render(s, sittings.indexOf(s))}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** One disclosure owns the sitting controls and secondary project actions. */
export function ProjectDisclosure<T extends ProjectSitting>({
  sittings,
  reveal = false,
  children,
}: {
  sittings: T[];
  reveal?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(reveal);
  useEffect(() => {
    if (reveal) setOpen(true);
  }, [reveal]);
  const next = nextProjectSitting(sittings);
  const active = sittings.filter(
    s => !["completed", "cancelled", "no-show"].includes(s.status)
  );
  const dates = [...(active.length ? active : sittings)].sort((a, b) =>
    (a.startsAt || "9999").localeCompare(b.startsAt || "9999")
  );
  return (
    <div className="ivory-project-disclosure">
      {
        <ul className="ivory-project-dates" aria-label="Project dates">
          {dates.map(s => (
            <li key={s.id} data-next={s.id === next?.id}>
              <span>
                {s.id === next?.id ? "Next: " : ""}
                {s.startsAt
                  ? bookingDate(s.startsAt, s.timeZone || undefined)
                  : "Date to be arranged"}
              </span>
              {s.rescheduled && (
                <span className="ivory-rescheduled">Rescheduled</span>
              )}
              {["completed", "cancelled", "no-show"].includes(s.status) && (
                <span className="v3-muted">{statusLabel(s.status)}</span>
              )}
            </li>
          ))}
        </ul>
      }
      <DetailsSheet
        title="Project sittings"
        label="View sittings"
        open={open}
        onOpenChange={setOpen}
      >
        {children}
      </DetailsSheet>
    </div>
  );
}
