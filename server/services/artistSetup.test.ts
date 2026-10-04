// @vitest-environment node
import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  settings: vi.fn(),
  stripe: vi.fn(),
}));
vi.mock("../db", () => ({
  getUserById: mocks.user,
  getArtistSettings: mocks.settings,
}));
vi.mock("./stripeConnect", () => ({ getAccountStatus: mocks.stripe }));
import { getArtistSetupProgress } from "./artistSetup";
beforeEach(() => vi.resetAllMocks());
describe("persisted artist setup", () => {
  it("reads the artist from the database and rejects other roles", async () => {
    mocks.user.mockResolvedValue({ role: "client" });
    await expect(getArtistSetupProgress("id")).rejects.toThrow("Artist setup");
    expect(mocks.settings).not.toHaveBeenCalled();
  });
  it("does not contact Stripe until local required steps are saved", async () => {
    mocks.user.mockResolvedValue({ role: "artist" });
    mocks.settings.mockResolvedValue({
      stripeConnectAccountId: "acct_existing",
    });
    expect((await getArtistSetupProgress("id")).nextStep).toBe("profile");
    expect(mocks.stripe).not.toHaveBeenCalled();
  });
  it("uses live Stripe verification instead of stale payout flags", async () => {
    mocks.user.mockResolvedValue({
      role: "artist",
      name: "Alex",
      avatar: "photo",
      phone: "phone",
      city: "Brisbane",
      country: "Australia",
    });
    mocks.settings.mockResolvedValue({
      businessAddress: "1 St",
      businessCountry: "AU",
      workSchedule: JSON.stringify({
        monday: { enabled: true, start: "09:00", end: "17:00" },
      }),
      services: JSON.stringify([{ name: "Day", duration: 480, price: 1000 }]),
      stripeConnectAccountId: "acct_existing",
      stripeConnectPayoutsEnabled: 1,
    });
    mocks.stripe.mockResolvedValue({ statusAvailable: false });
    expect((await getArtistSetupProgress("id")).complete).toBe(false);
    expect(mocks.stripe).toHaveBeenCalledWith("acct_existing");
  });
});
