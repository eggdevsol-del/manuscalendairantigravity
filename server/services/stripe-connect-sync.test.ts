// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ refresh: vi.fn(), invalidate: vi.fn() }));
vi.mock("./stripe", () => ({ stripe: {} }));
vi.mock("./artistPaymentReadiness", () => ({
  getArtistPaymentStatus: mock.refresh,
  invalidateArtistPaymentStatus: mock.invalidate,
}));
import { syncAccountStatusToDb } from "./stripeConnect";
beforeEach(() => vi.clearAllMocks());
it("refreshes webhook account state and invalidates cached readiness", async () => {
  mock.refresh.mockResolvedValue({});
  await syncAccountStatusToDb("acct_fixture");
  expect(mock.refresh).toHaveBeenCalledWith("acct_fixture", true);
  expect(mock.invalidate).toHaveBeenCalledTimes(2);
});
it("propagates a failed sync so the webhook can return an error and Stripe retries", async () => {
  mock.refresh.mockRejectedValue(new Error("temporary database failure"));
  await expect(syncAccountStatusToDb("acct_fixture")).rejects.toThrow(
    "temporary database failure"
  );
});
