import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { money, bookingDate } from "@/features/workspace/bookingPresentation";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import {
  Action,
  Feedback,
  Panel,
  Row,
  Screen,
  Section,
  Status,
} from "../design/primitives";

export default function PayoutHistory() {
  const history = trpc.payouts.payoutHistory.useQuery({ limit: 100 });
  const [refund, setRefund] = useState<number | null>(null);
  const data = history.data;
  return (
    <Screen
      title="Payment history"
      subtitle="Client payments, refunds and transfers to your bank."
      back="/money"
    >
      <Feedback
        loading={history.isLoading}
        error={history.error || (data && "error" in data ? data.error : null)}
        onRetry={() => history.refetch()}
      />
      {data && !("error" in data) && (
        <>
          <Section title="Bank payouts">
            {!data.payouts.length && (
              <Feedback empty="No bank payouts recorded yet." />
            )}
            {data.payouts.map(payout => (
              <Panel key={payout.id}>
                <Row
                  title={money(payout.amountCents, payout.currency)}
                  detail={`${bookingDate(payout.arrivalDate)}${payout.bankLast4 ? ` · Bank ending ${payout.bankLast4}` : ""}`}
                  trailing={
                    <Status
                      tone={
                        payout.status === "paid"
                          ? "success"
                          : payout.status === "failed"
                            ? "danger"
                            : "neutral"
                      }
                    >
                      {payout.status}
                    </Status>
                  }
                />
                {payout.description && <p>{payout.description}</p>}
              </Panel>
            ))}
          </Section>
          <Section title="Payment ledger">
            <p className="v3-muted">
              Amounts below are recorded in AUD. Open a refund to verify the
              original charge and its currency.
            </p>
            {!data.entries.length && (
              <Feedback empty="Your recorded client payments will appear here." />
            )}
            {data.entries.map(entry => (
              <Panel key={entry.id}>
                <Row
                  title={entry.clientName || "Transaction"}
                  detail={`${entry.type.replaceAll("_", " ")} · ${entry.createdAt ? bookingDate(entry.createdAt) : "Date unavailable"}`}
                  trailing={<strong>{money(entry.amountCents)}</strong>}
                />
                <dl className="v3-facts">
                  <div>
                    <dt>Platform fee</dt>
                    <dd>{money(entry.platformFeeCents)}</dd>
                  </div>
                  <div>
                    <dt>Artist fee</dt>
                    <dd>{money(entry.artistFeeCents)}</dd>
                  </div>
                </dl>
                {entry.stripePaymentId &&
                  ["deposit", "balance", "store_order"].includes(
                    entry.type
                  ) && (
                    <Action tone="quiet" onClick={() => setRefund(entry.id)}>
                      Review refund
                    </Action>
                  )}
              </Panel>
            ))}
          </Section>
          {data.hasMore && (
            <p className="v3-muted">
              Showing the most recent 100 records. Older records remain
              available in Stripe.
            </p>
          )}
        </>
      )}
      {refund !== null && (
        <RefundSheet
          ledgerId={refund}
          onClose={() => setRefund(null)}
          onSuccess={() => void history.refetch()}
        />
      )}
    </Screen>
  );
}

export function RefundSheet({
  ledgerId,
  onClose,
  onSuccess,
}: {
  ledgerId: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const preview = trpc.payouts.refundPreview.useQuery(
    { ledgerId },
    { retry: false, staleTime: 0 }
  );
  const request = trpc.payouts.refundTransaction.useMutation();
  const utils = trpc.useUtils();
  const [acknowledged, setAcknowledged] = useState(false);
  const data = preview.data;
  async function submit() {
    if (!data || !acknowledged || request.isPending) return;
    try {
      await request.mutateAsync({
        ledgerId,
        expectedAmountCents: data.amountCents,
      });
      [0, 600, 1500].forEach(delay =>
        setTimeout(() => {
          void utils.payouts.invalidate();
          void utils.projects.invalidate();
          void utils.appointments.invalidate();
        }, delay)
      );
      onSuccess();
    } catch {}
  }
  return (
    <SheetShell
      isOpen
      title="Review refund"
      onClose={() => {
        if (!request.isPending) onClose();
      }}
    >
      <div className="v3-stack">
        {request.data ? (
          <>
            <Status tone={request.data.success ? "success" : "warning"}>
              {request.data.success
                ? "Stripe accepted the refund"
                : `Refund ${request.data.status || "pending"}`}
            </Status>
            <p>
              {money(request.data.amountCents, request.data.currency)} ·{" "}
              {request.data.currency.toUpperCase()}
            </p>
            <p>
              Your payment history and affected bookings update when Stripe’s
              confirmation arrives. The client’s bank controls when the funds
              become available.
            </p>
            <Action onClick={onClose}>Done</Action>
          </>
        ) : (
          <>
            {preview.isLoading && <Feedback loading />}
            {preview.error && <p role="alert">{preview.error.message}</p>}
            {preview.error && (
              <Action tone="secondary" onClick={() => preview.refetch()}>
                Check again
              </Action>
            )}
            {data && (
              <>
                <Panel>
                  <h2>{money(data.amountCents, data.currency)}</h2>
                  <p>
                    {data.currency.toUpperCase()} · remaining refundable amount
                  </p>
                </Panel>
                {data.amountCents > 0 ? (
                  <>
                    <p>
                      This refunds the remaining original payment, including its
                      remaining platform fee
                      {data.sessionCount > 1
                        ? ` and deposits for all ${data.sessionCount} sessions paid together`
                        : ""}
                      . It does not cancel appointments.
                    </p>
                    <label className="v3-inline">
                      <input
                        type="checkbox"
                        checked={acknowledged}
                        disabled={request.isPending}
                        onChange={e => setAcknowledged(e.target.checked)}
                      />
                      I’ve checked the amount and want to issue this refund.
                    </label>
                    {request.error && (
                      <p role="alert">{request.error.message}</p>
                    )}
                    <Action
                      tone="danger"
                      disabled={
                        !acknowledged || request.isPending || preview.isFetching
                      }
                      onClick={submit}
                    >
                      {request.isPending
                        ? "Submitting…"
                        : `Refund ${money(data.amountCents, data.currency)}`}
                    </Action>
                  </>
                ) : (
                  <p>This payment has already been fully refunded.</p>
                )}
              </>
            )}
          </>
        )}
      </div>
    </SheetShell>
  );
}
