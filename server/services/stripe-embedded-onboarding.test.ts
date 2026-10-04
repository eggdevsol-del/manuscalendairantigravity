// @vitest-environment node
import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({ retrieve: vi.fn(), session: vi.fn() }));
vi.mock("./stripe", () => ({
  stripe: {
    accounts: { retrieve: mocks.retrieve },
    accountSessions: { create: mocks.session },
  },
}));
vi.mock("./core", () => ({ getDb: vi.fn() }));
import { createAccountSession } from "./stripeConnect";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ client_secret: "secret" });
});
describe("embedded onboarding Stripe session configuration", () => {
  it.each(["standard", "express"])(
    "keeps Stripe authentication enabled for %s accounts",
    async type => {
      mocks.retrieve.mockResolvedValue({
        type,
        controller: { requirement_collection: "stripe" },
      });
      expect(await createAccountSession("acct_artist")).toBe("secret");
      expect(mocks.session).toHaveBeenCalledWith({
        account: "acct_artist",
        components: {
          account_onboarding: {
            enabled: true,
            features: {
              external_account_collection: true,
              disable_stripe_user_authentication: false,
            },
          },
        },
      });
    }
  );
  it("collects the bank account without requiring Stripe login for application-collected accounts", async () => {
    mocks.retrieve.mockResolvedValue({
      type: "custom",
      controller: { requirement_collection: "application" },
    });
    await createAccountSession("acct_artist");
    expect(
      mocks.session.mock.calls[0][0].components.account_onboarding.features
    ).toEqual({
      external_account_collection: true,
      disable_stripe_user_authentication: true,
    });
  });
  it("uses the actual account controller instead of a stale stored type", async () => {
    mocks.retrieve.mockResolvedValue({
      type: "custom",
      controller: { requirement_collection: "stripe" },
    });
    await createAccountSession("acct_artist");
    expect(
      mocks.session.mock.calls[0][0].components.account_onboarding.features
        .disable_stripe_user_authentication
    ).toBe(false);
  });
  it("propagates Stripe session failures without inventing successful onboarding", async () => {
    mocks.retrieve.mockResolvedValue({
      type: "custom",
      controller: { requirement_collection: "application" },
    });
    mocks.session.mockRejectedValueOnce(new Error("Stripe unavailable"));
    await expect(createAccountSession("acct_artist")).rejects.toThrow(
      "Stripe unavailable"
    );
  });
});
