// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({
  settings: vi.fn(),
  session: vi.fn(),
  status: vi.fn(),
  custom: vi.fn(),
  standard: vi.fn(),
  link: vi.fn(),
  customEnabled: vi.fn(),
}));
vi.mock("../db", () => ({ getArtistSettings: mocks.settings }));
vi.mock("../services/stripeConnect", () => ({
  createAccountSession: mocks.session,
  getAccountStatus: mocks.status,
  createCustomConnectAccount: mocks.custom,
  createConnectAccount: mocks.standard,
  createAccountLink: mocks.link,
  isCustomEnabled: mocks.customEnabled,
}));
import { artistSettingsRouter } from "./artistSettings";
const caller = (role = "artist") =>
  artistSettingsRouter.createCaller({
    user: { id: "artist-a", email: "a@example.test", role },
    req: {},
    res: {},
  } as any);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue("private-secret");
  mocks.status.mockResolvedValue({ onboardingComplete: false });
  mocks.customEnabled.mockReturnValue(true);
});
describe("artist embedded Stripe onboarding", () => {
  it.each(["custom", "express", "standard"])(
    "creates an artist-scoped session for existing %s accounts",
    async type => {
      mocks.settings.mockResolvedValue({
        stripeConnectAccountId: "acct_artist_a",
        stripeConnectAccountType: type,
      });
      expect(await caller().createStripeAccountSession()).toEqual({
        clientSecret: "private-secret",
      });
      expect(mocks.settings).toHaveBeenCalledWith("artist-a");
      expect(mocks.session).toHaveBeenCalledWith("acct_artist_a");
    }
  );
  it.each(["standard", "express", "custom"])(
    "reuses an incomplete %s account without migrating its money connection",
    async type => {
      mocks.settings.mockResolvedValue({
        stripeConnectAccountId: "acct_existing",
        stripeConnectAccountType: type,
      });
      expect(await caller().connectStripe({ embedded: true })).toMatchObject({
        accountId: "acct_existing",
        accountType: type,
        url: null,
      });
      expect(mocks.custom).not.toHaveBeenCalled();
      expect(mocks.standard).not.toHaveBeenCalled();
      expect(mocks.link).not.toHaveBeenCalled();
    }
  );
  it("creates a Standard account for embedded setup without requiring a hosted link", async () => {
    mocks.settings.mockResolvedValue(null);
    mocks.customEnabled.mockReturnValue(false);
    mocks.standard.mockResolvedValue("acct_new");
    expect(await caller().connectStripe({ embedded: true })).toMatchObject({
      accountId: "acct_new",
      accountType: "standard",
      url: null,
    });
    expect(mocks.link).not.toHaveBeenCalled();
  });
  it("requires a connected account before creating a session", async () => {
    mocks.settings.mockResolvedValue(null);
    await expect(caller().createStripeAccountSession()).rejects.toThrow(
      "Create one first"
    );
    expect(mocks.session).not.toHaveBeenCalled();
  });
  it("denies clients access to the artist onboarding session", async () => {
    await expect(
      caller("client").createStripeAccountSession()
    ).rejects.toThrow();
    expect(mocks.session).not.toHaveBeenCalled();
  });
});
