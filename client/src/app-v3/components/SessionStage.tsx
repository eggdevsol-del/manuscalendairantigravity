import { useEffect, useState, type ReactNode } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { money } from "@/features/workspace/bookingPresentation";
import { useAppointmentCheckIn } from "@/features/appointments/useAppointmentCheckIn";
import { LiveStage } from "../design/live";
import { Action } from "../design/primitives";
import { sittingProgress } from "../design/liveDisplays";
import { relativeStart } from "../design/lockHome";
import { SplitBar } from "./DetailStages";
import { availableSessionActions } from "../pages/SessionActions";

const ARRIVAL_WINDOW = 15 * 60000;
const whole = (cents: number) => money(cents).replace(/\.00$/, "");

/** A sitting shown like a now-playing card: start, a progress bar that fills while it's under way, end,
 *  and how much of its price is paid. `next` holds the sitting's next step, when there is one. */
export function SessionStage({
  session,
  clientName,
  next,
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
  next?: ReactNode;
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
      {session.status !== "cancelled" && (
        <span className="iosm-np-split">
          <SplitBar
            parts={[
              { label: `${whole(session.paidCents)} paid`, value: session.paidCents, tone: "ok" },
              { label: `${whole(session.remainingCents)} to pay`, value: session.remainingCents },
            ]}
          />
        </span>
      )}
      {next}
    </LiveStage>
  );
}

/** Whether the live sitting card shows a next step, and which: "arrived" from 15 minutes before the start
 *  until the end while the client isn't marked as arrived, then "finish" once the sitting has started. */
export function sittingNextStep(
  session: Parameters<typeof availableSessionActions>[0],
  arrived: boolean | null,
  now: number
): "arrived" | "finish" | null {
  if (session.status !== "confirmed") return null;
  const start = new Date(session.startsAt).getTime();
  const end = new Date(session.endsAt).getTime();
  if (arrived === false && now >= start - ARRIVAL_WINDOW && now < end)
    return "arrived";
  return availableSessionActions(session, new Date(now)).includes("finish")
    ? "finish"
    : null;
}

/** The live sitting's next step, as in the prototype. "Client arrived" saves the arrival with the same
 *  appointment update as the arrival prompt. "Finish and request" opens the finish review, which sends
 *  the balance request. Arrival comes from today's calendar, which the arrival prompt already loads. */
export function SittingNext({
  session,
  clientName,
  onFinish,
}: {
  session: Parameters<typeof availableSessionActions>[0];
  clientName?: string | null;
  onFinish: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);
  const { appointments, updateAppointment } = useAppointmentCheckIn();
  const row = appointments.find((a: { id: number }) => a.id === session.id);
  const step = sittingNextStep(session, row ? !!row.clientArrived : null, now);
  if (!step) return null;
  const first = (clientName || "").split(" ")[0] || "your client";
  return (
    <div className="iosm-np-next">
      {step === "arrived" ? (
        <>
          <Action
            disabled={updateAppointment.isPending}
            onClick={() =>
              updateAppointment.mutate({
                id: session.id,
                clientArrived: 1,
                actualStartTime: new Date().toISOString(),
                status: "confirmed",
              })
            }
          >
            {updateAppointment.isPending ? "Saving…" : "Client arrived"}
          </Action>
          {updateAppointment.error ? (
            <p role="alert">{updateAppointment.error.message}</p>
          ) : (
            <p>Tap when {first} is in the studio.</p>
          )}
        </>
      ) : (
        <Action onClick={onFinish}>
          {session.remainingCents > 0
            ? `Finish and request ${whole(session.remainingCents)}`
            : "Finish session"}
        </Action>
      )}
    </div>
  );
}
