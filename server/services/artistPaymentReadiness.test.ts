// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  retrieve: vi.fn(),
  db: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
}));
vi.mock("./stripeConnect", () => ({ getAccountStatus: mock.retrieve }));
vi.mock("./core", () => ({ getDb: mock.db }));
import {
  artistCanAcceptPayments,
  getArtistPaymentStatus,
  invalidateArtistPaymentStatus,
  reconcileArtistPaymentStatuses,
} from "./artistPaymentReadiness";
const enabled = {
  statusAvailable: true,
  accountId: "acct_test",
  chargesEnabled: true,
  payoutsEnabled: true,
  detailsSubmitted: true,
  onboardingComplete: true,
};
beforeEach(() => {
  vi.clearAllMocks();
  invalidateArtistPaymentStatus("acct_test");
  mock.where.mockResolvedValue(undefined);
  mock.set.mockReturnValue({ where: mock.where });
  mock.update.mockReturnValue({ set: mock.set });
  mock.db.mockResolvedValue({ update: mock.update });
  mock.retrieve.mockResolvedValue(enabled);
});
describe("Artist payment readiness", () => {
  it("heals a stale false database flag from live Stripe readiness", async () => {
    expect(
      await artistCanAcceptPayments({ stripeConnectAccountId: "acct_test" })
    ).toBe(true);
    expect(mock.set).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeConnectOnboardingComplete: 1,
        stripeConnectPayoutsEnabled: 1,
      })
    );
  });
  it("blocks incomplete accounts and persists their disabled state", async () => {
    mock.retrieve.mockResolvedValue({
      ...enabled,
      chargesEnabled: false,
      onboardingComplete: false,
    });
    expect(
      await artistCanAcceptPayments({ stripeConnectAccountId: "acct_test" })
    ).toBe(false);
    expect(mock.set).toHaveBeenCalledWith(
      expect.objectContaining({ stripeConnectOnboardingComplete: 0 })
    );
  });
  it("allows charges independently of bank payouts", async () => {
    mock.retrieve.mockResolvedValue({ ...enabled, payoutsEnabled: false });
    expect(
      await artistCanAcceptPayments({ stripeConnectAccountId: "acct_test" })
    ).toBe(true);
  });
  it("does not call Stripe for an unconnected artist", async () => {
    expect(await artistCanAcceptPayments(null)).toBe(false);
    expect(mock.retrieve).not.toHaveBeenCalled();
  });
  it("coalesces concurrent checks and reuses fresh results", async () => {
    await Promise.all(
      Array.from({ length: 100 }, () => getArtistPaymentStatus("acct_test"))
    );
    await getArtistPaymentStatus("acct_test");
    expect(mock.retrieve).toHaveBeenCalledTimes(1);
    expect(mock.set).toHaveBeenCalledTimes(1);
  });
  it("explicit refresh bypasses cached eligibility", async () => {
    await getArtistPaymentStatus("acct_test");
    mock.retrieve.mockResolvedValue({ ...enabled, chargesEnabled: false });
    expect(
      (await getArtistPaymentStatus("acct_test", true)).chargesEnabled
    ).toBe(false);
    expect(mock.retrieve).toHaveBeenCalledTimes(2);
  });
  it("expired results are verified again", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1000);
    await getArtistPaymentStatus("acct_test");
    now.mockReturnValue(62000);
    await getArtistPaymentStatus("acct_test");
    expect(mock.retrieve).toHaveBeenCalledTimes(2);
    now.mockRestore();
  });
  it("fails closed during Stripe outages without clearing database flags", async () => {
    mock.retrieve.mockResolvedValue({ ...enabled, statusAvailable: false });
    await expect(getArtistPaymentStatus("acct_test")).rejects.toThrow(
      "temporarily unavailable"
    );
    expect(mock.set).not.toHaveBeenCalled();
    mock.retrieve.mockResolvedValue(enabled);
    await expect(getArtistPaymentStatus("acct_test")).resolves.toMatchObject({
      chargesEnabled: true,
    });
  });
  it("does not reuse an old positive cache after a failed forced refresh", async () => {
    await getArtistPaymentStatus("acct_test");
    mock.retrieve.mockResolvedValue({ ...enabled, statusAvailable: false });
    await expect(getArtistPaymentStatus("acct_test", true)).rejects.toThrow();
    await expect(getArtistPaymentStatus("acct_test")).rejects.toThrow();
    expect(mock.retrieve).toHaveBeenCalledTimes(3);
  });
  it("does not swallow failed database synchronisation or cache it", async () => {
    mock.where.mockRejectedValueOnce(new Error("database outage"));
    await expect(getArtistPaymentStatus("acct_test")).rejects.toThrow(
      "database outage"
    );
    await expect(getArtistPaymentStatus("acct_test")).resolves.toMatchObject({
      chargesEnabled: true,
    });
    expect(mock.retrieve).toHaveBeenCalledTimes(2);
  });
});

describe("Missed webhook reconciliation", () => {
  it("bounds each pass and continues after an account fails", async () => {
    const limit = vi.fn(async () => [
      { userId: "qa-a", accountId: "acct_bad" },
      { userId: "qa-b", accountId: "acct_good" },
    ]);
    mock.db.mockResolvedValue({
      update: mock.update,
      select: () => ({
        from: () => ({ where: () => ({ orderBy: () => ({ limit }) }) }),
      }),
    });
    mock.retrieve
      .mockResolvedValueOnce({ ...enabled, statusAvailable: false })
      .mockResolvedValueOnce(enabled);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await reconcileArtistPaymentStatuses();
    expect(limit).toHaveBeenCalledWith(50);
    expect(mock.retrieve).toHaveBeenCalledTimes(2);
    expect(mock.set).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });
  it("does not overlap background passes", async () => {
    let release!: (rows: any[]) => void;
    const limit = vi.fn(
      () =>
        new Promise<any[]>(resolve => {
          release = resolve;
        })
    );
    mock.db.mockResolvedValue({
      select: () => ({
        from: () => ({ where: () => ({ orderBy: () => ({ limit }) }) }),
      }),
    });
    const first = reconcileArtistPaymentStatuses();
    await Promise.resolve();
    await reconcileArtistPaymentStatuses();
    release([]);
    await first;
    expect(limit).toHaveBeenCalledTimes(1);
  });
});
