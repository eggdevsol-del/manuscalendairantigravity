// @vitest-environment node
import { vi, it, expect, beforeEach } from "vitest";
const fixture = vi.hoisted(() => ({
  membership: null as any,
  studio: null as any,
}));
vi.mock("./core", () => ({
  getDb: async () => ({
    query: {
      studioMembers: { findFirst: async () => fixture.membership },
      studios: { findFirst: async () => fixture.studio },
    },
  }),
}));
import { effectivePaymentTier } from "./paymentEntitlements";
import { calculateTransactionFees, PAYMENT_TIERS } from "../../shared/fees";
beforeEach(() => {
  fixture.membership = null;
  fixture.studio = null;
});
it("does not grant a paid plan from an unverified tier string", async () => {
  expect(
    await effectivePaymentTier({
      userId: "a",
      subscriptionTier: "pro",
      subscriptionStatus: "active",
    })
  ).toBe("free");
});
it("removes artist fees only for a confirmed active Pro subscription", async () => {
  const settings = {
    userId: "a",
    subscriptionTier: "pro",
    subscriptionStatus: "active",
    stripeSubscriptionId: "sub_pro",
  };
  expect(
    calculateTransactionFees(100000, await effectivePaymentTier(settings))
      .artistFeeCents
  ).toBe(0);
  settings.subscriptionStatus = "past_due";
  expect(
    calculateTransactionFees(100000, await effectivePaymentTier(settings))
      .artistFeeCents
  ).toBe(2000);
});
it("extends Studio payment benefits to its active artists and ends them when billing ends", async () => {
  fixture.membership = { studioId: "s", status: "active" };
  fixture.studio = {
    stripeSubscriptionId: "sub_studio",
    subscriptionStatus: "active",
  };
  expect(
    await effectivePaymentTier({ userId: "a", subscriptionTier: "basic" })
  ).toBe("top");
  expect(PAYMENT_TIERS.top.label).toBe("Studio");
  expect(PAYMENT_TIERS.top.upfrontPaymentAllowed).toBe(true);
  fixture.studio.subscriptionStatus = "canceled";
  expect(
    await effectivePaymentTier({ userId: "a", subscriptionTier: "basic" })
  ).toBe("free");
  fixture.membership = null;
  expect(await effectivePaymentTier({ userId: "a" })).toBe("free");
});
