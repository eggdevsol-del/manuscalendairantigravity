// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ account: vi.fn(), balance: vi.fn() }));
vi.mock("./stripe", () => ({
  stripe: {
    accounts: { retrieve: mocks.account },
    balance: { retrieve: mocks.balance },
  },
}));
vi.mock("./core", () => ({ getDb: vi.fn() }));
import { getAccountStatus, getPayoutSchedule } from "./stripeConnect";
beforeEach(() => vi.clearAllMocks());
describe("Stripe payout status", () => {
  it("uses the account settlement currency rather than assuming AUD", async () => {
    mocks.account.mockResolvedValue({
      id: "acct_nz",
      country: "NZ",
      default_currency: "nzd",
      settings: {
        payouts: { schedule: { interval: "weekly", weekly_anchor: "friday" } },
      },
    });
    mocks.balance.mockResolvedValue({
      available: [
        { currency: "aud", amount: 900 },
        { currency: "nzd", amount: 25000 },
      ],
      pending: [{ currency: "nzd", amount: 14000 }],
    });
    expect(await getPayoutSchedule("acct_nz")).toMatchObject({
      currency: "nzd",
      availableBalance: 25000,
      pendingBalance: 14000,
      weeklyAnchor: "friday",
    });
  });
  it("does not report payouts enabled merely because details were submitted", async () => {
    mocks.account.mockResolvedValue({
      id: "acct_pending",
      charges_enabled: true,
      details_submitted: true,
      payouts_enabled: false,
      requirements: {
        pending_verification: ["individual.verification.document"],
        currently_due: [],
      },
    });
    expect(await getAccountStatus("acct_pending")).toMatchObject({
      statusAvailable: true,
      pendingVerification: true,
      payoutsEnabled: false,
    });
  });
  it("distinguishes a failed Stripe read from an unverified account", async () => {
    mocks.account.mockRejectedValue(new Error("Fixture outage"));
    expect(await getAccountStatus("acct_fixture")).toMatchObject({
      statusAvailable: false,
      payoutsEnabled: false,
    });
  });
});
