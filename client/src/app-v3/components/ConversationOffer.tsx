import { useEffect, useState } from "react";
import { Gift } from "lucide-react";
import { OfferCard } from "./Offers";
import { Action } from "../design/primitives";
import { money } from "@/features/workspace/bookingPresentation";
import type { OfferRules } from "@shared/offerRules";
export type ThreadOffer = {
  id: number;
  rules: OfferRules;
  remainingValue: number;
  issuedAt: string;
  requestedAt: string | null;
  status: string;
  planId: number | null;
};
export function offerThreadStatus(offer: ThreadOffer, now = Date.now()) {
  if (offer.status === "confirmed" || offer.status === "declined")
    return offer.status;
  if (offer.rules.expiresAt && +new Date(offer.rules.expiresAt) <= now)
    return "expired";
  return offer.status;
}
export const offerStatusLabel = (status: string) =>
  ({
    discussing: "Discussing your tattoo",
    awaiting_deposit: "Awaiting deposit",
    confirmed: "Booking confirmed",
    declined: "Declined",
    expired: "Expired",
    unavailable: "Unavailable",
  })[status] || status;
export function useOfferClock() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}
export function activeThreadOffer(offers: ThreadOffer[], now: number) {
  return offers
    .filter(o =>
      ["discussing", "awaiting_deposit"].includes(offerThreadStatus(o, now))
    )
    .sort(
      (a, b) =>
        (b.requestedAt || "").localeCompare(a.requestedAt || "") || b.id - a.id
    )[0];
}
export function ConversationOfferCard({
  offer,
  now,
  isArtist,
  onBook,
  onReview,
  onDecline,
  busy = false,
}: {
  offer: ThreadOffer;
  now: number;
  isArtist: boolean;
  onBook: () => void;
  onReview: () => void;
  onDecline: () => void;
  busy?: boolean;
}) {
  const status = offerThreadStatus(offer, now);
  const active = ["discussing", "awaiting_deposit"].includes(status);
  return (
    <OfferCard rules={offer.rules} remaining={offer.remainingValue}>
      <strong role="status">{offerStatusLabel(status)}</strong>
      {offer.rules.expiresAt && (
        <small>
          Expires{" "}
          {new Date(offer.rules.expiresAt).toLocaleString(undefined, {
            day: "numeric",
            month: "short",
            hour: "numeric",
            minute: "2-digit",
          })}
        </small>
      )}
      {status === "discussing" && !isArtist && (
        <small>
          Your artist will confirm the design, dates and price before sending a
          proposal. Your deposit secures the booking.
        </small>
      )}
      {active && (
        <div className="ivory-offer-actions">
          {status === "discussing" ? (
            isArtist ? (
              <Action disabled={busy} onClick={onBook}>
                Book with this offer
              </Action>
            ) : null
          ) : (
            <Action disabled={busy} onClick={onReview}>
              {isArtist ? "Review proposal" : "Review & pay deposit"}
            </Action>
          )}
          <Action tone="quiet" disabled={busy} onClick={onDecline}>
            Decline offer
          </Action>
        </div>
      )}
    </OfferCard>
  );
}
export function ConversationOfferStrip({
  offer,
  now,
  onOpen,
}: {
  offer: ThreadOffer;
  now: number;
  onOpen: () => void;
}) {
  return (
    <button
      className="ivory-thread-offer-strip"
      onClick={onOpen}
      aria-label={`View ${offer.rules.name} offer`}
    >
      <Gift size={18} />
      <span>
        <strong>
          {offer.rules.name} ·{" "}
          {offer.rules.valueType === "percentage"
            ? `${offer.rules.value}% off`
            : money(offer.remainingValue, offer.rules.currency)}
        </strong>
        <small>
          {offerStatusLabel(offerThreadStatus(offer, now))}
          {offer.rules.expiresAt
            ? ` · Expires ${new Date(offer.rules.expiresAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}`
            : ""}
        </small>
      </span>
      <span aria-hidden="true">›</span>
    </button>
  );
}
