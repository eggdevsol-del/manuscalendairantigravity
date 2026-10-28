import { useEffect, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { money } from "@/features/workspace/bookingPresentation";
import { LiveStage } from "../design/live";
import { sittingProgress } from "../design/liveDisplays";
import { relativeStart } from "../design/lockHome";

/** A sitting shown like a now-playing card: start, a progress bar that fills while it's under way, end. */
export function SessionStage({
  session,
  clientName,
}: {
  session: {
    title?: string | null;
    startsAt: string;
    endsAt: string;
    timeZone: string;
    status: string;
    paidCents: number;
    remainingCents: number;
  };
  clientName?: string | null;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);
  const start = new Date(session.startsAt).getTime();
  const end = new Date(session.endsAt).getTime();
  const progress = sittingProgress(session.startsAt, session.endsAt, now);
  const live = progress > 0 && progress < 1 && session.status !== "cancelled";
  const time = (t: string) =>
    formatInTimeZone(new Date(t), session.timeZone, "h:mmaaa");
  const when = live
    ? "Now"
    : end <= now
      ? "Finished"
      : start - now < 86400000
        ? relativeStart(session.startsAt, now)
        : formatInTimeZone(new Date(start), session.timeZone, "EEE d MMM");
  const name = clientName || session.title || "Sitting";
  return (
    <LiveStage className={`iosm-np${live ? " live" : ""}`}>
      <span className="iosm-np-art" aria-hidden="true">
        {name
          .split(/\s+/)
          .slice(0, 2)
          .map(w => w[0])
          .join("")
          .toUpperCase()}
      </span>
      <span className="iosm-np-copy">
        <small>{live ? "In the chair" : when}</small>
        <b>{name}</b>
        <em>
          {session.remainingCents > 0
            ? `${money(session.remainingCents)} still to pay`
            : session.paidCents > 0
              ? "Paid in full"
              : "No payment yet"}
        </em>
      </span>
      <span
        className="iosm-np-bar"
        role="progressbar"
        aria-label="Sitting progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        <i style={{ width: `${progress * 100}%` }} />
      </span>
      <span className="iosm-np-times">
        <span>{time(session.startsAt)}</span>
        <span>{when}</span>
        <span>{time(session.endsAt)}</span>
      </span>
    </LiveStage>
  );
}
