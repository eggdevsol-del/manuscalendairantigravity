// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setPlanOffer, consumePlanOffer } from "./offerCheckout";
import * as s from "../../drizzle/schema";
beforeEach(() => vi.stubEnv("IVORY_OFFERS_ENABLED", "true"));
afterEach(() => vi.unstubAllEnvs());
const planDb = (plan: any) => ({
  select: () => ({
    from: () => ({ where: () => ({ for: async () => [plan] }) }),
  }),
});
describe("checkout offer safeguards", () => {
  it("rejects another client before touching prices", async () => {
    await expect(
      setPlanOffer(planDb({ clientId: "owner" }), 1, "intruder", 1)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("rejects a checkout that already has a provider payment", async () => {
    await expect(
      setPlanOffer(
        planDb({
          clientId: "owner",
          status: "pending",
          stripeSessionId: "pi_live",
        }),
        1,
        "owner",
        1
      )
    ).rejects.toThrow("already started");
  });
  it("requires explicit activation", async () => {
    vi.stubEnv("IVORY_OFFERS_ENABLED", "false");
    await expect(setPlanOffer({}, 1, "owner", 1)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
  });
  it("consumes only the reserved voucher amount and preserves the rest", async () => {
    const updates: any[] = [];
    const rules = {
      name: "Gift",
      description: "",
      kind: "voucher",
      valueType: "fixed",
      value: 10000,
      currency: "AUD",
      eligibility: "unpaid",
      expiresAt: null,
      sittingFrom: null,
      sittingUntil: null,
      backgroundImageUrl: "",
    };
    const tx = {
      query: {
        offerApplications: {
          findFirst: async () => ({
            id: 3,
            offerId: 2,
            quoteJson: JSON.stringify({ amount: 4000, items: [] }),
          }),
        },
      },
      select: () => ({
        from: () => ({
          where: () => ({
            for: async () => [
              {
                id: 2,
                rulesJson: JSON.stringify(rules),
                remainingValue: 10000,
                reservedPlanId: 1,
                transferTo: null,
              },
            ],
          }),
        }),
      }),
      update: (table: any) => ({
        set: (values: any) => ({
          where: async () => updates.push({ table, values }),
        }),
      }),
    };
    await consumePlanOffer(tx, 1);
    expect(updates.find(u => u.table === s.clientOffers)?.values).toEqual({
      remainingValue: 6000,
      reservedPlanId: null,
      interestAt: null,
    });
    expect(
      updates.find(u => u.table === s.offerApplications)?.values.status
    ).toBe("redeemed");
  });
  it("refuses to consume a voucher reserved for a different checkout", async () => {
    const rules = {
      name: "Gift",
      description: "",
      kind: "voucher",
      valueType: "fixed",
      value: 10000,
      currency: "AUD",
      eligibility: "unpaid",
      expiresAt: null,
      sittingFrom: null,
      sittingUntil: null,
      backgroundImageUrl: "",
    };
    const tx = {
      query: {
        offerApplications: {
          findFirst: async () => ({
            id: 3,
            offerId: 2,
            quoteJson: '{"amount":4000}',
          }),
        },
      },
      select: () => ({
        from: () => ({
          where: () => ({
            for: async () => [
              {
                rulesJson: JSON.stringify(rules),
                remainingValue: 10000,
                reservedPlanId: 99,
              },
            ],
          }),
        }),
      }),
    };
    await expect(consumePlanOffer(tx, 1)).rejects.toThrow("reconciliation");
  });
});
