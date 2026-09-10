import { useState, useEffect } from "react";
import { useRoute, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { DotsCheckout } from "@/components/ui/ssot/DotsCheckout";
import {
  Action,
  ActionLink,
  Feedback,
  Panel,
  Screen,
  Status,
} from "../design/primitives";
import {
  money as formatMoney,
  bookingDate,
} from "@/features/workspace/bookingPresentation";

export function PaymentRequestPage() {
  const [, params] = useRoute("/pay/:token");
  const token = params?.token || "";
  const search = new URLSearchParams(useSearch());
  const [submitted, setSubmitted] = useState(
    search.get("status") === "success" ||
      search.get("redirect_status") === "succeeded"
  );
  const [timedOut, setTimedOut] = useState(false);
  const [checkout, setCheckout] = useState<{
    secret: string;
    total: number;
  } | null>(null);
  const query = trpc.funnel.getPaymentRequestInfo.useQuery(
    { token },
    {
      enabled: !!token,
      retry: false,
      refetchInterval: submitted && !timedOut ? 2000 : false,
    }
  );
  const create = trpc.funnel.createPaymentRequestCheckout.useMutation();
  const [error, setError] = useState("");
  useEffect(() => {
    if (!submitted) return;
    const timer = setTimeout(() => setTimedOut(true), 60000);
    return () => clearTimeout(timer);
  }, [submitted]);
  const paid = query.data?.error === "already_paid";
  const info =
    query.data &&
    !query.data.error &&
    query.data.requestId != null &&
    query.data.amountCents != null &&
    query.data.fees
      ? {
          ...query.data,
          amountCents: query.data.amountCents,
          fees: query.data.fees,
        }
      : null;
  const unavailable = query.error || (!query.isLoading && !info && !paid);
  async function start() {
    if (create.isPending) return;
    setError("");
    try {
      const result = await create.mutateAsync({ token });
      if (result.error || !result.clientSecret) {
        setError(
          result.error === "already_paid"
            ? "This payment is already paid. Refresh to see the confirmation."
            : "This request changed or checkout is unavailable. Please refresh the details."
        );
        void query.refetch();
        return;
      }
      setCheckout({
        secret: result.clientSecret,
        total: result.fees.clientTotalCents,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t prepare checkout.");
    }
  }
  return (
    <Screen
      publicView
      title={
        paid
          ? "Payment confirmed"
          : submitted
            ? "Confirming your payment"
            : "Review your payment"
      }
      subtitle={info?.artistName}
      action={
        <ActionLink href="/login" tone="quiet">
          Sign in
        </ActionLink>
      }
    >
      <Feedback loading={query.isLoading} />
      {paid ? (
        <Panel>
          <Status tone="success">Payment received</Status>
          <p>Your artist has the payment confirmation.</p>
          <ActionLink href="/bookings">Open my bookings</ActionLink>
        </Panel>
      ) : unavailable ? (
        <Panel>
          <h2>This payment link isn’t available</h2>
          <p>
            {query.data?.error === "expired"
              ? "The link has expired. Ask your artist for a new link."
              : query.data?.error === "cancelled"
                ? "Your artist cancelled this payment request."
                : "Ask your artist to check the request or try again."}
          </p>
          <Action onClick={() => query.refetch()}>Check again</Action>
        </Panel>
      ) : submitted ? (
        <Panel>
          <Status tone="warning">Waiting for confirmation</Status>
          <p>
            Your payment was submitted. Please don’t pay again while we check
            its status.
          </p>
          <Action onClick={() => query.refetch()}>Check confirmation</Action>
          <ActionLink href="/bookings">Open my bookings</ActionLink>
        </Panel>
      ) : (
        info &&
        (checkout ? (
          <DotsCheckout
            clientSecret={checkout.secret}
            amountCents={checkout.total}
            artistName={info.artistName}
            onBack={() => setCheckout(null)}
            onComplete={() => {
              setSubmitted(true);
              void query.refetch();
            }}
          />
        ) : (
          <>
            <Panel>
              <h2>{info.serviceName}</h2>
              <p>
                {info.sessionDate
                  ? bookingDate(info.sessionDate)
                  : "Your appointment"}
              </p>
              <dl className="v3-facts">
                <div>
                  <dt>Requested payment</dt>
                  <dd>{formatMoney(info.amountCents)}</dd>
                </div>
                <div>
                  <dt>Platform fee</dt>
                  <dd>{formatMoney(info.fees.platformFeeCents)}</dd>
                </div>
                <div>
                  <dt>Total · AUD</dt>
                  <dd>{formatMoney(info.fees.clientTotalCents)}</dd>
                </div>
              </dl>
            </Panel>
            {error && <p role="alert">{error}</p>}
            <Action disabled={create.isPending} onClick={start}>
              {create.isPending
                ? "Preparing checkout…"
                : "Continue to secure checkout"}
            </Action>
          </>
        ))
      )}
    </Screen>
  );
}

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
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (!submitted) return;
    const timer = setTimeout(() => setTimedOut(true), 60000);
    return () => clearTimeout(timer);
  }, [submitted]);
  const [claimed, setClaimed] = useState(false);
  const [checkout, setCheckout] = useState<{
    secret: string;
    amount: number;
  } | null>(null);
  const deposit = trpc.funnel.getDepositInfo.useQuery(
    { token },
    {
      enabled: isDeposit && !!token,
      refetchInterval: submitted && !timedOut ? 3000 : false,
    }
  );
  const balance = trpc.funnel.getBalanceInfo.useQuery(
    { bookingId, token: token || undefined },
    {
      enabled: !isDeposit && !!bookingId,
      refetchInterval: submitted && !timedOut ? 3000 : false,
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
    <Screen
      publicView
      title={
        paid
          ? "Payment confirmed"
          : claimed
            ? "Sent for verification"
            : submitted
              ? "Confirming your payment"
              : isDeposit
                ? "Secure your booking"
                : "Your session balance"
      }
      subtitle={data?.artistName}
      action={
        <ActionLink href="/login" tone="quiet">
          Sign in
        </ActionLink>
      }
    >
      <Feedback loading={query.isLoading} />
      {(query.error || (!query.isLoading && !data)) && (
        <Panel>
          <h2>This payment link isn’t available</h2>
          <p>
            It may have expired or the booking may have changed. Ask your artist
            for a new link.
          </p>
          <Action onClick={() => query.refetch()}>Try again</Action>
          <ActionLink href="/bookings">Open my bookings</ActionLink>
        </Panel>
      )}
      {data &&
        (paid || claimed || submitted ? (
          <Panel>
            <Status tone={paid ? "success" : "warning"}>
              {paid
                ? "Payment received"
                : claimed
                  ? "Artist verification needed"
                  : "Waiting for confirmation"}
            </Status>
            <p>
              {paid
                ? "Your artist has the payment confirmation. Your booking details are available in the app."
                : claimed
                  ? "Your artist will check the payment and update your booking. This report does not mark it paid."
                  : "Your payment was submitted. Please don’t pay again while we check its status."}
            </p>
            {!paid && (
              <Action tone="secondary" onClick={() => query.refetch()}>
                Check confirmation
              </Action>
            )}
            <ActionLink href="/bookings">Open my bookings</ActionLink>
          </Panel>
        ) : checkout ? (
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
        ) : (
          <>
            <Panel>
              <h2>{data.projectType || "Your tattoo appointment"}</h2>
              <dl className="v3-facts">
                <div>
                  <dt>{isDeposit ? "Deposit" : "Balance"}</dt>
                  <dd>{money(amount)}</dd>
                </div>
                <div>
                  <dt>Card platform fee</dt>
                  <dd>{money(data.platformFeeCents)}</dd>
                </div>
                <div>
                  <dt>Card total · AUD</dt>
                  <dd>{money(data.clientTotalCents)}</dd>
                </div>
              </dl>
            </Panel>
            {error && <p role="alert">{error.message}</p>}
            {data.paymentMethods.stripe && (
              <Action
                disabled={busy}
                onClick={() =>
                  isDeposit
                    ? startDeposit.mutate({ token })
                    : startBalance.mutate({
                        bookingId,
                        balanceToken: token || undefined,
                      })
                }
              >
                {busy ? "Preparing checkout…" : "Pay securely by card"}
              </Action>
            )}
            {data.paymentMethods.bank && data.bankDetails && (
              <details className="v3-panel">
                <summary>Pay by bank transfer</summary>
                <div className="v3-stack">
                  <p>
                    Transfer {money(amount)} using your name as the reference.
                  </p>
                  <p>
                    {data.bankDetails.accountName}
                    <br />
                    Bank code: {data.bankDetails.bsb}
                    <br />
                    Account: {data.bankDetails.accountNumber}
                  </p>
                  <Action
                    tone="secondary"
                    disabled={busy}
                    onClick={() => claim("bank")}
                  >
                    I’ve made the transfer
                  </Action>
                  <p>Your artist will verify receipt before marking it paid.</p>
                </div>
              </details>
            )}
            {data.paymentMethods.cash && (
              <Action
                tone="secondary"
                disabled={busy}
                onClick={() => claim("cash")}
              >
                Report a cash payment
              </Action>
            )}
            {!data.paymentMethods.stripe &&
              !data.paymentMethods.bank &&
              !data.paymentMethods.cash && (
                <Feedback empty="Your artist hasn’t enabled a payment method yet. Contact them in Messages." />
              )}
          </>
        ))}
    </Screen>
  );
}
