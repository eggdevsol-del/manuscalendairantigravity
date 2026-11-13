import { useEffect, useId, useRef, useState } from "react";
import { Check, Clock } from "lucide-react";
import {
  describeOutsideHours,
  outsideHoursFromError,
  outsideHoursWhen,
  unconfirmedOutsideHours,
  type HoursSitting,
  type OutsideHoursIssue,
} from "@shared/businessHours";
import { Action } from "../design/primitives";

/**
 * Tracks which sittings run outside business hours and which of those the artist has confirmed.
 * A confirmation belongs to one sitting (its place in the list) at one exact start and end, so changing
 * the time, or giving that time to another sitting, asks again. `timeZone` is the zone the screen builds
 * its times in; the server judges hours in the same zone.
 */
export function useOutsideHours(
  sittings: HoursSitting[],
  workSchedule: unknown,
  timeZone: string
) {
  const [confirmed, setConfirmed] = useState<string[]>([]);
  const [refused, setRefused] = useState<OutsideHoursIssue[]>([]);
  const local = unconfirmedOutsideHours(workSchedule, timeZone, sittings);
  const current = sittings.flatMap(s => {
    const start = new Date(s.start),
      end = new Date(s.end);
    return Number.isFinite(+start) && Number.isFinite(+end)
      ? [
          {
            key: `${start.toISOString()}/${end.toISOString()}`,
            sessionIndex: s.sessionIndex,
          },
        ]
      : [];
  });
  // The server's verdict wins when hours changed since this screen loaded them.
  const issues = [
    ...local,
    ...refused.flatMap(r => {
      const sitting = current.find(c => c.key === r.key);
      return sitting && !local.some(l => l.key === r.key)
        ? [{ ...r, sessionIndex: sitting.sessionIndex }]
        : [];
    }),
  ];
  const mark = (issue: OutsideHoursIssue) =>
    `${issue.sessionIndex ?? ""}|${issue.key}`;
  const keys = issues.filter(i => confirmed.includes(mark(i))).map(i => i.key);
  return {
    issues,
    confirmed: keys,
    pending: issues.filter(i => !keys.includes(i.key)),
    toggle: (key: string) => {
      const marks = issues.filter(i => i.key === key).map(mark);
      setConfirmed(list =>
        marks.some(m => list.includes(m))
          ? list.filter(m => !marks.includes(m))
          : [...list, ...marks]
      );
    },
    /**
     * Takes a failed booking; true when it was the outside-hours refusal and one of the sittings on
     * screen now asks for it. A refusal about some other time is not answerable here, so the caller
     * shows the server's message instead.
     */
    refuse: (error: unknown) => {
      const found = outsideHoursFromError(error);
      if (!found || !found.some(i => current.some(c => c.key === i.key)))
        return false;
      setRefused(found);
      setConfirmed(list =>
        list.filter(m => !found.some(i => m.endsWith(`|${i.key}`)))
      );
      return true;
    },
    /** Forgets every answer: a sheet opened for another client or sitting starts unasked. */
    reset: () => {
      setConfirmed([]);
      setRefused([]);
    },
  };
}

/** Names each sitting outside business hours and why, and takes a separate "Book anyway" for each one. */
export function OutsideHoursConfirm({
  issues,
  confirmed,
  onToggle,
  onChangeTime,
  attention = 0,
}: {
  issues: OutsideHoursIssue[];
  confirmed: string[];
  onToggle: (key: string) => void;
  onChangeTime?: () => void;
  /** Bump to move focus here, e.g. when a submit was held back. */
  attention?: number;
}) {
  const id = useId();
  const box = useRef<HTMLElement>(null);
  const shown = issues.length > 0;
  useEffect(() => {
    if (shown && attention) box.current?.focus();
  }, [attention, shown]);
  if (!shown) return null;
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const left = issues.filter(i => !confirmed.includes(i.key)).length;
  return (
    <section
      ref={box}
      tabIndex={-1}
      role="group"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-help`}
      className="iosm-hours-confirm"
    >
      <h3 id={`${id}-title`}>
        <Clock aria-hidden="true" />
        Outside your business hours
      </h3>
      <p id={`${id}-help`}>
        {issues.length === 1
          ? "This sitting is outside your hours. Confirm it to book it anyway, or change the time."
          : "These sittings are outside your hours. Confirm each one to book it anyway, or change its time."}
      </p>
      <ul>
        {issues.map(issue => {
          const done = confirmed.includes(issue.key);
          const when = `${issues.length > 1 && issue.sessionIndex ? `Sitting ${issue.sessionIndex} · ` : ""}${outsideHoursWhen(issue)}${issue.timeZone === zone ? "" : ` (${issue.timeZone.replaceAll("_", " ")})`}`;
          return (
            <li key={issue.key} data-confirmed={done || undefined}>
              <div>
                <strong>{when}</strong>
                <span>{describeOutsideHours(issue)}</span>
              </div>
              <button
                type="button"
                aria-pressed={done}
                aria-label={`Book anyway: ${when}`}
                onClick={() => onToggle(issue.key)}
              >
                {done ? (
                  <>
                    <Check aria-hidden="true" />
                    Confirmed
                  </>
                ) : (
                  "Book anyway"
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="iosm-hours-confirm-status" role="status">
        {left === 0
          ? issues.length === 1
            ? "Confirmed. This sitting will be booked outside your hours."
            : "All confirmed. These sittings will be booked outside your hours."
          : left === issues.length
            ? ""
            : `${left} still to confirm.`}
      </p>
      {onChangeTime && (
        <Action tone="quiet" onClick={onChangeTime}>
          Change the time
        </Action>
      )}
    </section>
  );
}
