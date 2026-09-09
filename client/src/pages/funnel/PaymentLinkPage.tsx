import { useState } from "react";
import { Link, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { DotsCheckout } from "@/components/ui/ssot/DotsCheckout";
import { Button } from "@/components/ui";
import { Check, Lock } from "lucide-react";

export function PaymentLinkPage({
  kind,
  token,
  bookingId = 0,
}: {
  kind: "deposit" | "balance";
  token: string;
  bookingId?: number;
}) {
  const isDeposit = kind === "deposit";
  const search = useSearch();
  const returned =
    new URLSearchParams(search).get("redirect_status") === "succeeded" ||
    new URLSearchParams(search).get("status") === "success";
  const [submitted, setSubmitted] = useState(returned);
  const [claimed, setClaimed] = useState(false);
  const [checkout, setCheckout] = useState<{
    secret: string;
    amount: number;
  } | null>(null);
  const deposit = trpc.funnel.getDepositInfo.useQuery(
    { token },
    { enabled: isDeposit && !!token, refetchInterval: submitted ? 3000 : false }
  );
  const balance = trpc.funnel.getBalanceInfo.useQuery(
    { bookingId, token: token || undefined },
    {
      enabled: !isDeposit && !!bookingId,
      refetchInterval: submitted ? 3000 : false,
    }
  );
  const query = isDeposit ? deposit : balance;
  const data = query.data;
  const paid = isDeposit
    ? deposit.data?.status === "deposit_verified" ||
      deposit.data?.status === "scheduled" ||
      deposit.data?.status === "completed"
    : balance.data?.status === "fully_paid";
  const startDeposit = trpc.funnel.createDepositCheckout.useMutation({
    onSuccess: result => {
      if (result.clientSecret)
        setCheckout({
          secret: result.clientSecret,
          amount: result.fees.clientTotalCents,
        });
    },
  });
  const startBalance = trpc.funnel.createBalanceCheckout.useMutation({
    onSuccess: result => {
      if (result.clientSecret)
        setCheckout({
          secret: result.clientSecret,
          amount: result.fees.clientTotalCents,
        });
    },
  });
  const claimDeposit = trpc.funnel.confirmDeposit.useMutation({
    onSuccess: () => setClaimed(true),
  });
  const claimBalance = trpc.funnel.confirmBalance.useMutation({
    onSuccess: () => setClaimed(true),
  });
  const busy =
    startDeposit.isPending ||
    startBalance.isPending ||
    claimDeposit.isPending ||
    claimBalance.isPending;
  const error =
    startDeposit.error ||
    startBalance.error ||
    claimDeposit.error ||
    claimBalance.error;
  const amount = isDeposit
    ? deposit.data?.depositAmount || 0
    : balance.data?.remainingBalanceCents || 0;
  const money = (cents: number) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
    }).format(cents / 100);
  const claim = (method: "bank" | "cash") =>
    isDeposit
      ? claimDeposit.mutate({ token, paymentMethod: method })
      : claimBalance.mutate({
          bookingId,
          token: token || undefined,
          paymentMethod: method,
        });
  return (
    <main className="app-document min-h-[100dvh] bg-background text-foreground px-5 py-8 pb-12">
      <div className="max-w-lg mx-auto">
        <Link
          href="/login"
          className="inline-block text-xl tracking-[.22em] font-semibold mb-8"
        >
          tattoi.
        </Link>
        {query.isLoading && <p role="status">Loading your payment details…</p>}
        {(query.error || (!query.isLoading && !data)) && (
          <div className="rounded-2xl border p-6 space-y-4">
            <h1 className="text-xl font-semibold">
              This payment link isn't available
            </h1>
            <p className="text-muted-foreground">
              It may have expired or the booking may have changed. Ask your
              artist for a new link.
            </p>
            <Button variant="outline" onClick={() => query.refetch()}>
              Try again
            </Button>
            <Link href="/bookings" className="block underline">
              Open my bookings
            </Link>
          </div>
        )}
        {data && (
          <>
            <p className="text-sm text-muted-foreground mb-2">
              {data.artistName}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight mb-2">
              {paid
                ? "Payment confirmed"
                : claimed
                  ? "Sent for verification"
                  : submitted
                    ? "Confirming your payment"
                    : isDeposit
                      ? "Secure your booking"
                      : "Your session balance"}
            </h1>
            {paid || claimed || submitted ? (
              <section
                className="border rounded-2xl p-6 mt-6 space-y-4"
                role="status"
              >
                {paid && <Check className="text-primary h-9 w-9" />}
                <p className="leading-relaxed">
                  {paid
                    ? "Your artist has the payment confirmation. Your booking details are available in the app."
                    : claimed
                      ? "Your artist will check the payment and update your booking. This report does not mark the balance paid."
                      : "Your payment was submitted. We're waiting for confirmation; please don't pay again."}
                </p>
                {submitted && !paid && (
                  <Button variant="outline" onClick={() => query.refetch()}>
                    Check confirmation
                  </Button>
                )}
                <Link
                  href="/bookings"
                  className="block underline underline-offset-4"
                >
                  Open my bookings
                </Link>
              </section>
            ) : checkout ? (
              <div className="mt-6">
                <DotsCheckout
                  clientSecret={checkout.secret}
                  amountCents={checkout.amount}
                  artistName={data.artistName}
                  onBack={() => setCheckout(null)}
                  onComplete={() => {
                    setSubmitted(true);
                    void query.refetch();
                  }}
                />
              </div>
            ) : (
              <>
                <p className="text-muted-foreground">
                  {data.projectType || "Your tattoo appointment"}
                </p>
                <dl className="rounded-2xl border bg-card p-5 mt-6 space-y-4">
                  <div className="flex justify-between gap-3">
                    <dt className="capitalize">{kind}</dt>
                    <dd>{money(amount)}</dd>
                  </div>
                  <div className="flex justify-between gap-3 text-muted-foreground text-sm">
                    <dt>Card platform fee</dt>
                    <dd>{money(data.platformFeeCents)}</dd>
                  </div>
                  <div className="flex justify-between gap-3 border-t pt-4 font-semibold text-lg">
                    <dt>Card total</dt>
                    <dd>{money(data.clientTotalCents)}</dd>
                  </div>
                </dl>
                {error && (
                  <p role="alert" className="text-destructive text-sm mt-4">
                    {error.message}
                  </p>
                )}
                <div className="mt-5 space-y-3">
                  {data.paymentMethods.stripe && (
                    <Button
                      disabled={busy}
                      className="w-full h-12"
                      onClick={() =>
                        isDeposit
                          ? startDeposit.mutate({ token })
                          : startBalance.mutate({
                              bookingId,
                              balanceToken: token || undefined,
                            })
                      }
                    >
                      <Lock className="h-4 w-4 mr-2" />
                      {busy ? "Please wait…" : "Pay securely by card"}
                    </Button>
                  )}
                  {data.paymentMethods.bank && data.bankDetails && (
                    <details className="border rounded-xl p-4">
                      <summary className="cursor-pointer min-h-8 font-medium">
                        Pay by bank transfer
                      </summary>
                      <div className="pt-3 space-y-3 text-sm">
                        <p>
                          Transfer {money(amount)} using your name as the
                          reference.
                        </p>
                        <p>
                          {data.bankDetails.accountName}
                          <br />
                          Bank code: {data.bankDetails.bsb}
                          <br />
                          Account: {data.bankDetails.accountNumber}
                        </p>
                        <Button
                          variant="outline"
                          className="w-full min-h-12"
                          disabled={busy}
                          onClick={() => claim("bank")}
                        >
                          I've made the transfer
                        </Button>
                        <p className="text-muted-foreground">
                          Your artist will verify receipt before marking it
                          paid.
                        </p>
                      </div>
                    </details>
                  )}
                  {data.paymentMethods.cash && (
                    <Button
                      variant="outline"
                      className="w-full min-h-12"
                      disabled={busy}
                      onClick={() => claim("cash")}
                    >
                      Report a cash payment
                    </Button>
                  )}
                  {!data.paymentMethods.stripe &&
                    !data.paymentMethods.bank &&
                    !data.paymentMethods.cash && (
                      <p className="text-sm text-muted-foreground">
                        Your artist hasn't enabled a payment method yet. Contact
                        them in Messages.
                      </p>
                    )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
