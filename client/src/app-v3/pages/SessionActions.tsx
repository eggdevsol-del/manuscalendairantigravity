import { useState } from "react";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { trpc } from "@/lib/trpc";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import { instant, money } from "@/features/workspace/bookingPresentation";
import { Action, Panel } from "../design/primitives";
interface Session {
  id: number;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  status: string;
  remainingCents: number;
  sessionPlanId?: number | null;
}
export function SessionActions({
  session: s,
  onChange,
}: {
  session: Session;
  onChange: () => void;
}) {
  const [mode, setMode] = useState<
    "finish" | "reschedule" | "cancel" | "no-show" | null
  >(null);
  const [date, setDate] = useState(""),
    [time, setTime] = useState("");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const update = trpc.appointments.update.useMutation();
  const reschedule = trpc.appointments.reschedule.useMutation();
  const cancel = trpc.appointments.cancelSession.useMutation();
  const cancelAll = trpc.appointments.cancelProjectSessions.useMutation();
  const request = trpc.dashboard.requestPayment.useMutation();
  const [all, setAll] = useState(false);
  const canFinish =
    s.status === "completed" ||
    (s.status === "confirmed" && instant(s.startsAt) <= new Date());
  const open = (next: typeof mode) => {
    setError("");
    setAll(false);
    setDate(formatInTimeZone(instant(s.startsAt), s.timeZone, "yyyy-MM-dd"));
    setTime(formatInTimeZone(instant(s.startsAt), s.timeZone, "HH:mm"));
    setMode(next);
  };
  async function save() {
    if (busy) return;
    if ((mode === "finish" || mode === "no-show") && !canFinish) {
      setError("This action is available once the confirmed session starts.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (mode === "reschedule") {
        const start = fromZonedTime(`${date}T${time}`, s.timeZone);
        if (!Number.isFinite(+start) || start <= new Date())
          throw new Error("Choose a valid future time.");
        const end = new Date(
          +start + (+instant(s.endsAt) - +instant(s.startsAt))
        );
        await reschedule.mutateAsync({
          appointmentId: s.id,
          newStartTime: start.toISOString(),
          newEndTime: end.toISOString(),
        });
      } else if (mode === "cancel") {
        if (all && s.sessionPlanId)
          await cancelAll.mutateAsync({ sessionPlanId: s.sessionPlanId });
        else await cancel.mutateAsync({ appointmentId: s.id });
      } else if (mode === "no-show")
        await update.mutateAsync({ id: s.id, status: "no-show" });
      else if (mode === "finish") {
        if (s.remainingCents > 0)
          await request.mutateAsync({
            appointmentId: s.id,
            amountCents: s.remainingCents,
          });
        else
          await update.mutateAsync({
            id: s.id,
            status: "completed",
            actualEndTime: new Date().toISOString(),
          });
      }
      setMode(null);
      onChange();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Couldn’t save this change. Try again."
      );
    } finally {
      setBusy(false);
    }
  }
  if (
    ["cancelled", "no-show"].includes(s.status) ||
    (s.status === "completed" && s.remainingCents <= 0)
  )
    return null;
  return (
    <>
      {canFinish && (
        <Action onClick={() => open("finish")}>
          {s.status === "completed"
            ? "Request remaining balance"
            : "Finish session"}
        </Action>
      )}
      {s.status !== "completed" && (
        <>
          <Action tone="quiet" onClick={() => open("reschedule")}>
            Reschedule
          </Action>
          <details>
            <summary className="v3-row">More session options</summary>
            {canFinish && (
              <Action tone="quiet" onClick={() => open("no-show")}>
                Mark no-show
              </Action>
            )}
            <Action tone="danger" onClick={() => open("cancel")}>
              Cancel session
            </Action>
          </details>
        </>
      )}
      <SheetShell
        isOpen={!!mode}
        onClose={() => !busy && setMode(null)}
        title={
          mode === "reschedule"
            ? "Reschedule session"
            : mode === "cancel"
              ? "Cancel session"
              : mode === "no-show"
                ? "Mark no-show"
                : "Finish session"
        }
      >
        <div className="v3-stack">
          {mode === "reschedule" ? (
            <div className="v3-form">
              <label>
                New date
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                />
              </label>
              <label>
                New time
                <input
                  type="time"
                  value={time}
                  onChange={e => setTime(e.target.value)}
                />
              </label>
              <small>
                {s.timeZone.replaceAll("_", " ")}. The session duration and
                existing payments stay the same.
              </small>
            </div>
          ) : mode === "finish" ? (
            <Panel>
              <h2>
                {s.remainingCents > 0
                  ? `${money(s.remainingCents)} remaining`
                  : "Paid in full"}
              </h2>
              <p>
                {s.remainingCents > 0
                  ? "Send your client a payment request for this session. Completion follows the payment workflow."
                  : "Mark the session complete and record its finish time."}
              </p>
            </Panel>
          ) : (
            <>
              <p>
                {mode === "cancel"
                  ? "Cancel this session? Payment records remain available. Cancellation does not automatically issue a refund."
                  : "Record that the client did not attend this session?"}
              </p>
              {mode === "cancel" && s.sessionPlanId && (
                <label className="v3-inline">
                  <input
                    type="checkbox"
                    checked={all}
                    onChange={e => setAll(e.target.checked)}
                  />
                  Cancel all remaining sessions in this plan
                </label>
              )}
            </>
          )}
          {error && <p role="alert">{error}</p>}
          <Action
            tone={
              mode === "cancel" || mode === "no-show" ? "danger" : "primary"
            }
            disabled={busy}
            onClick={save}
          >
            {busy
              ? "Saving…"
              : mode === "finish" && s.remainingCents > 0
                ? "Send payment request"
                : mode === "reschedule"
                  ? "Save new time"
                  : mode === "cancel"
                    ? "Confirm cancellation"
                    : mode === "no-show"
                      ? "Confirm no-show"
                      : "Complete session"}
          </Action>
          <Action tone="quiet" disabled={busy} onClick={() => setMode(null)}>
            Go back
          </Action>
        </div>
      </SheetShell>
    </>
  );
}
