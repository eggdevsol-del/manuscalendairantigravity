import { CalendarClock, ArrowRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Action, Panel, Feedback } from "../design/primitives";
import { bookingDate, money } from "@/features/workspace/bookingPresentation";
export function RescheduleRequestCard({
  id,
  onChange,
}: {
  id: number;
  onChange: () => void;
}) {
  const q = trpc.reschedules.get.useQuery({ id }, { refetchInterval: 3000 });
  const resolve = trpc.reschedules.resolve.useMutation({
    onSuccess: () => {
      void q.refetch();
      onChange();
    },
  });
  const data = q.data,
    t = data?.terms;
  return (
    <Panel>
      <div className="v3-eyebrow">
        <CalendarClock size={20} /> Reschedule proposal
      </div>
      <Feedback
        loading={q.isLoading}
        error={q.error}
        onRetry={() => q.refetch()}
      />
      {data && (
        <>
          <h3>
            Sitting {t.sessionIndex} · {t.offerName}
          </h3>
          <p>
            {bookingDate(t.oldStart, t.timeZone)} <ArrowRight size={16} />{" "}
            {bookingDate(t.newStart, t.timeZone)}
          </p>
          <p>
            This date is outside the promotion’s eligible dates.{" "}
            {t.removedDiscountCents > 0
              ? `The ${money(t.removedDiscountCents)} discount on this sitting will be removed.`
              : "Existing voucher credit stays applied."}{" "}
            Other sittings keep their current terms.
          </p>
          <dl>
            <dt>Revised sitting total</dt>
            <dd>{money(t.estimateCents)}</dd>
            <dt>Already credited</dt>
            <dd>{money(t.paidCents)}</dd>
            <dt>Remaining balance</dt>
            <dd>{money(t.remainingCents)}</dd>
          </dl>
          {data.status === "pending" ? (
            <>
              <p>
                The original sitting stays booked until you agree. The proposed
                time is held until {bookingDate(data.expiresAt, t.timeZone)}.
                Accepting does not charge you.
              </p>
              <div className="simple-actions">
                {data.isClient ? (
                  <>
                    <Action
                      disabled={resolve.isPending}
                      onClick={() => resolve.mutate({ id, action: "accept" })}
                    >
                      Agree & reschedule
                    </Action>
                    <Action
                      tone="quiet"
                      disabled={resolve.isPending}
                      onClick={() => resolve.mutate({ id, action: "decline" })}
                    >
                      Decline
                    </Action>
                  </>
                ) : (
                  <Action
                    tone="quiet"
                    disabled={resolve.isPending}
                    onClick={() => resolve.mutate({ id, action: "withdraw" })}
                  >
                    Withdraw request
                  </Action>
                )}
              </div>
            </>
          ) : (
            <p>
              {data.status === "accepted"
                ? "Accepted — date and balance updated."
                : `${data.status.charAt(0).toUpperCase() + data.status.slice(1)} — this request made no change to the original booking.`}
            </p>
          )}
          <Feedback error={resolve.error} />
        </>
      )}
    </Panel>
  );
}
