import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { PAYMENT_TIERS, resolvePaymentTier, roundCents } from "@shared/fees";
import { bookingDate, money } from "@/features/workspace/bookingPresentation";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import { SessionPlanCheckoutSheet } from "./Checkout";
import {
  Action,
  ActionLink,
  Feedback,
  Panel,
  Screen,
  Status,
} from "../design/primitives";
export default function Waitlist() {
  const { user } = useAuth();
  const artist = user?.role === "artist" || user?.role === "admin";
  const settings = trpc.artistSettings.get.useQuery(undefined, {
    enabled: artist,
  });
  const config =
    PAYMENT_TIERS[resolvePaymentTier(settings.data?.subscriptionTier)];
  const query = trpc.waitlist.list.useQuery(undefined, {
    refetchInterval: 30000,
  });
  const [offering, setOffering] = useState<number | null>(null);
  const [checkout, setCheckout] = useState<{
    id: number;
    conversationId: number;
  } | null>(null);
  const [withdraw, setWithdraw] = useState<number | null>(null);
  const [draft, setDraft] = useState({
    startsAt: "",
    duration: "60",
    estimate: "",
    deposit: "",
    expiry: "24",
  });
  const offer = trpc.waitlist.offer.useMutation({
    onSuccess: () => {
      setOffering(null);
      void query.refetch();
    },
  });
  const accept = trpc.waitlist.accept.useMutation({
    onSuccess: (data, variables) => {
      const row = query.data?.find(row => row.id === variables.id);
      if (row)
        setCheckout({
          id: data.sessionPlanId,
          conversationId: row.conversationId,
        });
      void query.refetch();
    },
  });
  const leave = trpc.waitlist.leave.useMutation({
    onSuccess: () => {
      setWithdraw(null);
      void query.refetch();
    },
  });
  const error = offer.error || accept.error || leave.error;
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    <Screen
      title={artist ? "Cancellation waitlist" : "Earlier appointments"}
      subtitle={
        artist
          ? "Offer a space to a client who’s ready for it."
          : "Offers from your artist when a space opens up."
      }
      back={artist ? "/business" : "/bookings"}
    >
      <Feedback
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
      />
      {error && <p role="alert">{error.message}</p>}
      {query.data?.length === 0 && (
        <Panel>
          <p>
            {artist
              ? "No clients have joined yet. Clients can opt in from their booking workspace."
              : "Open your booking workspace to join your artist’s cancellation waitlist."}
          </p>
        </Panel>
      )}
      {query.data?.map(row => (
        <Panel key={row.id}>
          <div className="v3-inline">
            <h2>{row.name || (artist ? "Client" : "Artist")}</h2>
            <Status
              tone={row.planStatus === "accepted" ? "success" : "neutral"}
            >
              {row.planStatus === "accepted"
                ? "Booked"
                : row.expired
                  ? "Expired"
                  : row.status === "accepted"
                    ? "Awaiting deposit"
                    : row.status}
            </Status>
          </div>
          {row.note && <p>{row.note}</p>}
          {row.startsAt && (
            <p>
              {bookingDate(row.startsAt, zone)} · {row.durationMinutes} minutes
            </p>
          )}
          {row.estimateCents != null && (
            <dl className="v3-facts">
              <div>
                <dt>Session estimate</dt>
                <dd>{money(row.estimateCents)} AUD</dd>
              </div>
              <div>
                <dt>Deposit</dt>
                <dd>{money(row.depositCents || 0)} plus platform fee</dd>
              </div>
            </dl>
          )}
          {row.status === "offered" && row.expiresAt && (
            <p className="v3-muted">
              Respond by {bookingDate(row.expiresAt, zone)}. Dates are confirmed
              after payment and availability is checked again.
            </p>
          )}
          <div className="v3-inline">
            {artist &&
              ["waiting", "offered", "declined"].includes(row.status) && (
                <Action
                  onClick={() => {
                    setDraft({
                      startsAt: "",
                      duration: "60",
                      estimate: "",
                      deposit: "",
                      expiry: "24",
                    });
                    offer.reset();
                    setOffering(row.id);
                  }}
                >
                  Offer a time
                </Action>
              )}
            {!artist && row.status === "offered" && !row.expired && (
              <Action
                disabled={accept.isPending}
                onClick={() => accept.mutate({ id: row.id })}
              >
                {accept.isPending
                  ? "Checking availability…"
                  : "Review dates & deposit"}
              </Action>
            )}
            {!artist &&
              row.status === "accepted" &&
              row.planStatus === "pending" &&
              row.sessionPlanId && (
                <Action
                  onClick={() =>
                    setCheckout({
                      id: row.sessionPlanId!,
                      conversationId: row.conversationId,
                    })
                  }
                >
                  Continue to deposit
                </Action>
              )}
            {["waiting", "offered"].includes(row.status) && (
              <Action
                tone="quiet"
                onClick={() => {
                  leave.reset();
                  setWithdraw(row.id);
                }}
              >
                {artist ? "Withdraw" : "Leave waitlist"}
              </Action>
            )}
            <ActionLink href={`/chat/${row.conversationId}`}>
              Message
            </ActionLink>
          </div>
        </Panel>
      ))}
      {offering !== null && (
        <SheetShell
          isOpen
          title="Offer an available time"
          onClose={() => {
            if (!offer.isPending) setOffering(null);
          }}
        >
          <form
            className="v3-form"
            onSubmit={e => {
              e.preventDefault();
              offer.mutate({
                id: offering,
                startsAt: new Date(draft.startsAt).toISOString(),
                durationMinutes: Number(draft.duration),
                estimateCents: Math.round(Number(draft.estimate) * 100),
                depositCents: config.depositCustomisable
                  ? Math.round(Number(draft.deposit) * 100)
                  : roundCents(
                      (Math.round(Number(draft.estimate) * 100) *
                        config.defaultDepositPercent) /
                        100
                    ),
                expiresInHours: Number(draft.expiry),
              });
            }}
          >
            <p>
              The client reviews the price and pays the deposit before the
              session is confirmed.
            </p>
            <fieldset
              disabled={
                offer.isPending || settings.isLoading || !!settings.error
              }
            >
              <label>
                Date and time
                <input
                  aria-label="Offer date and time"
                  type="datetime-local"
                  required
                  value={draft.startsAt}
                  onChange={e =>
                    setDraft({ ...draft, startsAt: e.target.value })
                  }
                />
                <small>{zone}</small>
              </label>
              {(
                [
                  ["duration", "Duration in minutes", 15, 1440, 1],
                  ["estimate", "Session estimate · AUD", 1, 100000, 0.01],
                  [
                    "deposit",
                    "Deposit · AUD",
                    1,
                    Number(draft.estimate) || 100000,
                    0.01,
                  ],
                  ["expiry", "Offer valid for hours", 1, 72, 1],
                ] as const
              ).map(([key, label, min, max, step]) => (
                <label key={key}>
                  {label}
                  <input
                    type="number"
                    required
                    min={min}
                    max={max}
                    step={step}
                    readOnly={key === "deposit" && !config.depositCustomisable}
                    value={
                      key === "deposit" && !config.depositCustomisable
                        ? (
                            roundCents(
                              (Math.round(Number(draft.estimate) * 100) *
                                config.defaultDepositPercent) /
                                100
                            ) / 100
                          ).toFixed(2)
                        : draft[key]
                    }
                    onChange={e =>
                      setDraft({ ...draft, [key]: e.target.value })
                    }
                  />
                </label>
              ))}
              {!config.depositCustomisable && (
                <p className="v3-muted">
                  Free plan deposits are fixed at {config.defaultDepositPercent}
                  %.
                </p>
              )}
              <Feedback
                error={settings.error}
                onRetry={() => settings.refetch()}
              />
              {offer.error && <p role="alert">{offer.error.message}</p>}
              <Action type="submit">
                {offer.isPending ? "Sending…" : "Send offer"}
              </Action>
            </fieldset>
          </form>
        </SheetShell>
      )}
      {withdraw !== null && (
        <SheetShell
          isOpen
          title={
            artist ? "Withdraw this waitlist entry?" : "Leave this waitlist?"
          }
          onClose={() => {
            if (!leave.isPending) setWithdraw(null);
          }}
        >
          <div className="v3-stack">
            <p>Existing confirmed appointments stay booked.</p>
            {leave.error && <p role="alert">{leave.error.message}</p>}
            <Action
              tone="danger"
              disabled={leave.isPending}
              onClick={() => leave.mutate({ id: withdraw })}
            >
              {leave.isPending
                ? "Updating…"
                : artist
                  ? "Withdraw entry"
                  : "Leave waitlist"}
            </Action>
            <Action
              tone="secondary"
              disabled={leave.isPending}
              onClick={() => setWithdraw(null)}
            >
              Keep waiting
            </Action>
          </div>
        </SheetShell>
      )}
      {checkout && (
        <SessionPlanCheckoutSheet
          sessionPlanId={checkout.id}
          conversationId={checkout.conversationId}
          onClose={() => {
            setCheckout(null);
            void query.refetch();
          }}
        />
      )}
    </Screen>
  );
}
