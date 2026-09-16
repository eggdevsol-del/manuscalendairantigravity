import { SittingCard } from "./SittingCard";
import { bookingDate, money } from "@/features/workspace/bookingPresentation";
/** Proposal items stay distinct from confirmed appointments, and use server plan values. */
export function ProposedSittingCard({
  item,
}: {
  item: {
    sessionIndex: number;
    startsAt: string;
    durationMinutes: number;
    estimateCents: number;
    depositCents: number;
  };
}) {
  return (
    <SittingCard
      title={`Sitting ${item.sessionIndex}`}
      detail={bookingDate(item.startsAt)}
    >
      <dl className="v3-facts">
        <div>
          <dt>Duration</dt>
          <dd>{item.durationMinutes} minutes</dd>
        </div>
        <div>
          <dt>Session estimate</dt>
          <dd>{money(item.estimateCents)}</dd>
        </div>
        <div>
          <dt>Deposit</dt>
          <dd>{money(item.depositCents)}</dd>
        </div>
      </dl>
    </SittingCard>
  );
}
