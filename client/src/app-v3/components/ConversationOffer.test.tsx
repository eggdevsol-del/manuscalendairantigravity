import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import {
  ConversationOfferCard,
  ConversationOfferStrip,
  activeThreadOffer,
  offerThreadStatus,
  type ThreadOffer,
} from "./ConversationOffer";
const now = +new Date("2027-01-01T10:00Z");
const offer: ThreadOffer = {
  id: 1,
  rules: {
    name: "January tattoo",
    description: "Fill a January sitting",
    kind: "discount",
    valueType: "percentage",
    value: 15,
    currency: "AUD",
    eligibility: "new",
    expiresAt: "2027-01-01T11:00:00Z",
    sittingMonths: ["2027-01"],
    sittingFrom: null,
    sittingUntil: null,
    backgroundImageUrl: "",
  },
  remainingValue: 15,
  issuedAt: "2027-01-01T00:00:00Z",
  requestedAt: "2027-01-01T01:00:00Z",
  status: "discussing",
  planId: null,
};
const actions = () => ({
  onBook: vi.fn(),
  onReview: vi.fn(),
  onDecline: vi.fn(),
});
describe("conversation offer lifecycle", () => {
  it("gives artists direct offer booking and clients consultation context", () => {
    const callbacks = actions();
    const view = render(
      <ConversationOfferCard offer={offer} now={now} isArtist {...callbacks} />
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Book with this offer" })
    );
    expect(callbacks.onBook).toHaveBeenCalledOnce();
    view.rerender(
      <ConversationOfferCard
        offer={offer}
        now={now}
        isArtist={false}
        {...callbacks}
      />
    );
    expect(
      screen.queryByRole("button", { name: "Book with this offer" })
    ).toBeNull();
    expect(screen.getByText(/Your artist will confirm/)).toBeTruthy();
    view.rerender(
      <ConversationOfferCard
        offer={{ ...offer, status: "awaiting_deposit", planId: 4 }}
        now={now}
        isArtist={false}
        {...callbacks}
      />
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Review & pay deposit" })
    );
    expect(callbacks.onReview).toHaveBeenCalledOnce();
  });
  it("removes terminal and expired offers from the pin, leaving history without booking actions", () => {
    const expired = now + 3600000;
    expect(activeThreadOffer([offer], expired)).toBeUndefined();
    expect(offerThreadStatus({ ...offer, status: "confirmed" }, expired)).toBe(
      "confirmed"
    );
    expect(
      activeThreadOffer([{ ...offer, status: "declined" }], now)
    ).toBeUndefined();
    render(
      <ConversationOfferCard
        offer={offer}
        now={expired}
        isArtist
        {...actions()}
      />
    );
    expect(screen.getByText("Expired")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("pins only the most recently requested active offer and opens its details", () => {
    expect(
      activeThreadOffer(
        [offer, { ...offer, id: 2, requestedAt: "2027-01-01T02:00:00Z" }],
        now
      )?.id
    ).toBe(2);
    const open = vi.fn();
    render(<ConversationOfferStrip offer={offer} now={now} onOpen={open} />);
    fireEvent.click(
      screen.getByRole("button", { name: "View January tattoo offer" })
    );
    expect(open).toHaveBeenCalledOnce();
  });
});
