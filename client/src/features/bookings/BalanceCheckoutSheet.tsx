import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { DotsCheckout } from "@/components/ui/ssot/DotsCheckout";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import { Button } from "@/components/ui";
interface BalanceCheckoutSheetProps {
  open: boolean;
  onClose: () => void;
  appointmentId: number;
  balanceDueCents: number;
  artistName: string;
  projectName: string;
}
export function BalanceCheckoutSheet({
  open,
  onClose,
  appointmentId,
  artistName,
  projectName,
}: BalanceCheckoutSheetProps) {
  const [step, setStep] = useState<"review" | "payment" | "confirming">(
    "review"
  );
  const query = trpc.funnel.getBalanceInfo.useQuery(
    { bookingId: appointmentId },
    {
      enabled: open && appointmentId > 0,
      refetchInterval: step === "confirming" ? 2500 : false,
    }
  );
  const create = trpc.appointments.createBalancePaymentIntent.useMutation({
    onSuccess: () => setStep("payment"),
  });
  const utils = trpc.useUtils();
  const paid = query.data?.status === "fully_paid";
  useEffect(() => {
    if (open) {
      setStep("review");
      create.reset();
    }
  }, [open, appointmentId]);
  useEffect(() => {
    if (paid) void utils.appointments.getClientBookings.invalidate();
  }, [paid, utils]);
  const money = (cents: number) => `AUD $${(cents / 100).toFixed(2)}`;
  return (
    <SheetShell
      isOpen={open}
      onClose={onClose}
      title={paid ? "Payment confirmed" : "Pay your balance"}
      description={`${projectName} · ${artistName}`}
    >
      {query.isLoading && <p role="status">Loading payment details…</p>}
      {query.error && (
        <div role="alert">
          <p>We couldn't load the current balance.</p>
          <Button variant="outline" onClick={() => query.refetch()}>
            Try again
          </Button>
        </div>
      )}
      {create.error && (
        <p role="alert" className="text-destructive mb-4">
          {create.error.message}
        </p>
      )}
      {paid ? (
        <div className="space-y-4">
          <p>Your payment is confirmed. Your booking has been updated.</p>
          <Button className="w-full h-12" onClick={onClose}>
            Done
          </Button>
        </div>
      ) : step === "confirming" ? (
        <div role="status" className="space-y-4">
          <h3 className="text-lg font-semibold">Confirming your payment</h3>
          <p className="text-muted-foreground">
            Your payment was submitted. Please don't pay again. You can close
            this sheet and check Bookings.
          </p>
          <Button variant="outline" onClick={() => query.refetch()}>
            Check confirmation
          </Button>
        </div>
      ) : step === "payment" && create.data ? (
        <DotsCheckout
          clientSecret={create.data.clientSecret}
          amountCents={create.data.totalCents}
          onBack={() => setStep("review")}
          onComplete={() => {
            setStep("confirming");
            void query.refetch();
          }}
        />
      ) : (
        query.data && (
          <div className="space-y-5">
            <dl className="rounded-2xl border p-5 space-y-3">
              <div className="flex justify-between">
                <dt>Balance</dt>
                <dd>{money(query.data.remainingBalanceCents)}</dd>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <dt>Platform fee</dt>
                <dd>{money(query.data.platformFeeCents)}</dd>
              </div>
              <div className="flex justify-between border-t pt-3 font-semibold">
                <dt>Total due</dt>
                <dd>{money(query.data.clientTotalCents)}</dd>
              </div>
            </dl>
            <Button
              className="w-full h-12"
              disabled={create.isPending}
              onClick={() => create.mutate({ appointmentId })}
            >
              {create.isPending
                ? "Preparing checkout…"
                : "Continue to secure checkout"}
            </Button>
          </div>
        )
      )}
    </SheetShell>
  );
}
