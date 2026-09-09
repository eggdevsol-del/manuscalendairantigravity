// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ lead: vi.fn() }));
vi.mock("../db", () => ({
  getDb: async () => ({
    query: {
      leads: { findFirst: mocks.lead },
      artistSettings: {
        findFirst: async () => ({
          subscriptionTier: "free",
          businessName: "Test artist",
        }),
      },
      users: { findFirst: async () => ({ name: "Artist" }) },
    },
    select: () => ({
      from: () => ({ where: () => ({ limit: async () => [] }) }),
    }),
  }),
}));
import { funnelRouter } from "./funnel";
import { createDepositToken } from "../services/depositToken";
import type { TrpcContext } from "../_core/context";
const caller = funnelRouter.createCaller({
  user: null,
  req: {},
  res: {},
} as TrpcContext);
beforeEach(() => vi.clearAllMocks());
describe("public deposit confirmation", () => {
  it("keeps a paid link readable so the client can confirm authoritative payment status", async () => {
    mocks.lead.mockResolvedValue({
      id: 42,
      artistId: "artist-a",
      depositAmount: 5000,
      depositVerifiedAt: "2026-09-09 00:00:00",
      status: "scheduled",
    });
    const result = await caller.getDepositInfo({
      token: createDepositToken(42),
    });
    expect(result).toMatchObject({
      status: "deposit_verified",
      depositAmount: 5000,
    });
  });
  it("does not represent a manual payment claim as verified", async () => {
    mocks.lead.mockResolvedValue({
      id: 42,
      artistId: "artist-a",
      depositAmount: 5000,
      depositClaimedAt: "2026-09-09 00:00:00",
      depositVerifiedAt: null,
      status: "deposit_claimed",
    });
    expect(
      await caller.getDepositInfo({ token: createDepositToken(42) })
    ).toMatchObject({ status: "deposit_claimed" });
  });
  it("does not expose payment details through an invalid link", async () => {
    expect(await caller.getDepositInfo({ token: "invalid" })).toBeNull();
    expect(mocks.lead).not.toHaveBeenCalled();
  });
});
