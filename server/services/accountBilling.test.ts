// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  settings: {} as any,
  studios: [] as any[],
  retrieve: vi.fn(),
  checkout: vi.fn(),
}));
vi.mock("./core", () => ({
  getDb: async () => ({
    query: {
      artistSettings: { findFirst: async () => mocks.settings },
      studios: { findMany: async () => mocks.studios },
    },
  }),
}));
vi.mock("./stripe", () => ({
  stripe: {
    subscriptions: { retrieve: mocks.retrieve },
    checkout: { sessions: { retrieve: mocks.checkout } },
  },
}));
import { assertAccountBillingClosed } from "./accountBilling";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.settings = {};
  mocks.studios = [];
});
describe("account deletion billing guard", () => {
  it("allows accounts without recurring billing", async () => {
    await assertAccountBillingClosed("artist");
    expect(mocks.retrieve).not.toHaveBeenCalled();
  });
  it("checks Stripe rather than trusting stale local cancellation", async () => {
    mocks.settings = {
      stripeSubscriptionId: "sub_live",
      subscriptionStatus: "canceled",
    };
    mocks.retrieve.mockResolvedValue({
      status: "active",
      cancel_at_period_end: true,
    });
    await expect(assertAccountBillingClosed("artist")).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });
  it("allows fully canceled subscriptions", async () => {
    mocks.settings = { stripeSubscriptionId: "sub_cancelled" };
    mocks.retrieve.mockResolvedValue({ status: "canceled" });
    await assertAccountBillingClosed("artist");
  });
  it("blocks an owned studio subscription", async () => {
    mocks.studios = [{ stripeSubscriptionId: "sub_studio" }];
    mocks.retrieve.mockResolvedValue({ status: "past_due" });
    await expect(assertAccountBillingClosed("artist")).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });
  it("blocks uncompleted studio checkout", async () => {
    mocks.studios = [{ stripeCheckoutSessionId: "cs_open" }];
    mocks.checkout.mockResolvedValue({ status: "open" });
    await expect(assertAccountBillingClosed("artist")).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });
  it("fails closed when Stripe is unavailable", async () => {
    mocks.settings = { stripeSubscriptionId: "sub_unknown" };
    mocks.retrieve.mockRejectedValue(new Error("unavailable"));
    await expect(assertAccountBillingClosed("artist")).rejects.toThrow(
      "unavailable"
    );
  });
});
