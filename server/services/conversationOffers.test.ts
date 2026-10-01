// @vitest-environment node
import { beforeEach, describe, it, expect, vi } from "vitest";
import * as s from "../../drizzle/schema";
const m = vi.hoisted(() => ({ access: vi.fn(), cancel: vi.fn() }));
vi.mock("./access", () => ({ requireConversationAccess: m.access }));
vi.mock("./offerCheckout", () => ({ cancelPlanOfferCheckout: m.cancel }));
import {
  conversationOffers,
  declineConversationOffer,
} from "./conversationOffers";
const rules = {
  name: "January",
  kind: "discount",
  valueType: "percentage",
  value: 20,
  currency: "AUD",
  eligibility: "new",
  expiresAt: null,
  sittingFrom: null,
  sittingUntil: null,
};
function fixture() {
  const offer = {
    id: 1,
    clientId: "client",
    artistId: "artist",
    interestAt: "2027-01-01 01:00:00",
    issuedAt: "2027-01-01 00:00:00",
    remainingValue: 20,
    rulesJson: JSON.stringify(rules),
    reservedPlanId: null as number | null,
  };
  const applications: any[] = [];
  const plans: any[] = [];
  const writes: any[] = [];
  const db = {
    select: () => ({
      from: (table: any) => ({
        where: () =>
          Object.assign(
            Promise.resolve(table === s.clientOffers ? [offer] : applications),
            { for: async () => [offer] }
          ),
      }),
    }),
    query: {
      messages: {
        findMany: async () => [
          {
            metadata: JSON.stringify({
              type: "promotion_interest",
              offerId: 1,
            }),
          },
        ],
      },
      clientOffers: { findFirst: async () => offer },
      sessionPlans: {
        findMany: async () => plans,
        findFirst: async () => plans[0],
      },
      offerApplications: {
        findFirst: async () => applications.find(a => a.status === "redeemed"),
      },
    },
    update: (table: any) => ({
      set: (value: any) => ({
        where: async () => {
          writes.push({ table, value });
          if (table === s.clientOffers) Object.assign(offer, value);
        },
      }),
    }),
    insert: (table: any) => ({
      values: async (value: any) => writes.push({ table, value }),
    }),
  };
  return { offer, applications, plans, writes, db };
}
beforeEach(() => {
  vi.stubEnv("IVORY_OFFERS_ENABLED", "true");
  vi.clearAllMocks();
  m.access.mockResolvedValue({ artistId: "artist", clientId: "client" });
});
describe("conversation offer source of truth", () => {
  it("requires conversation membership before querying offers", async () => {
    m.access.mockRejectedValue(new Error("forbidden"));
    await expect(conversationOffers({}, 1, "outsider")).rejects.toThrow(
      "forbidden"
    );
  });
  it("moves from discussing to awaiting deposit, then confirmed only after redemption", async () => {
    const f = fixture();
    expect((await conversationOffers(f.db, 1, "artist")).offers[0].status).toBe(
      "discussing"
    );
    f.offer.reservedPlanId = 4;
    f.plans.push({ id: 4, status: "pending" });
    expect(
      (await conversationOffers(f.db, 1, "artist")).offers[0]
    ).toMatchObject({ status: "awaiting_deposit", planId: 4 });
    f.applications.push({
      offerId: 1,
      planId: 4,
      status: "redeemed",
      createdAt: "2027-01-01 02:00:00",
    });
    expect((await conversationOffers(f.db, 1, "client")).offers[0].status).toBe(
      "confirmed"
    );
  });
  it("retains expired and declined cards in history", async () => {
    const f = fixture();
    f.offer.rulesJson = JSON.stringify({
      ...rules,
      expiresAt: "2020-01-01T00:00:00Z",
    });
    expect((await conversationOffers(f.db, 1, "client")).offers[0].status).toBe(
      "expired"
    );
    f.offer.rulesJson = JSON.stringify(rules);
    await declineConversationOffer(f.db, 1, 1, "client");
    expect((await conversationOffers(f.db, 1, "client")).offers[0].status).toBe(
      "declined"
    );
    expect(
      f.writes.find(w => w.table === s.messages)?.value.metadata
    ).toContain("promotion_declined");
  });
  it("cannot decline an offer after payment confirmed it", async () => {
    const f = fixture();
    f.applications.push({
      status: "redeemed",
      createdAt: "2027-01-01 02:00:00",
    });
    await expect(
      declineConversationOffer(f.db, 1, 1, "client")
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(f.writes).toEqual([]);
  });
  it("cancels an unpaid checkout before closing the offer and propagates processing refusal", async () => {
    const f = fixture();
    f.offer.reservedPlanId = 4;
    f.plans.push({ id: 4, conversationId: 1 });
    m.cancel.mockRejectedValueOnce(new Error("Payment is confirming"));
    await expect(
      declineConversationOffer(f.db, 1, 1, "artist")
    ).rejects.toThrow("Payment is confirming");
    expect(f.writes).toEqual([]);
    await declineConversationOffer(f.db, 1, 1, "artist");
    expect(m.cancel).toHaveBeenCalledWith(f.db, 4, "client");
    expect(f.writes.find(w => w.table === s.sessionPlans)?.value.status).toBe(
      "declined"
    );
  });
});
