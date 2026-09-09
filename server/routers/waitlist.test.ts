// @vitest-environment node
import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  entry: null as any,
  insert: vi.fn(),
  settings: {
    stripeConnectAccountId: "acct_test",
    stripeConnectOnboardingComplete: 1,
    subscriptionTier: "basic",
  },
  conflicts: [] as any[],
}));
vi.mock("../services/core", () => {
  const db = {
    query: {
      waitlistEntries: { findFirst: async () => mocks.entry },
      artistSettings: { findFirst: async () => mocks.settings },
    },
    select: () => ({
      from: () => ({
        where: () => ({
          for: async () => [mocks.entry],
          limit: async () => mocks.conflicts,
        }),
      }),
    }),
    insert: () => ({ values: mocks.insert }),
    update: () => ({
      set: () => ({ where: async () => [{ affectedRows: 1 }] }),
    }),
  };
  return {
    getDb: async () => db,
    withDatabaseTransaction: async (work: any) => work(db),
  };
});
import { waitlistRouter } from "./waitlist";
import type { TrpcContext } from "../_core/context";
const caller = (id = "client-a", role = "client") =>
  waitlistRouter.createCaller({
    user: { id, role },
    req: {},
    res: {},
  } as TrpcContext);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.entry = {
    id: 1,
    artistId: "artist-a",
    clientId: "client-a",
    conversationId: 3,
    status: "offered",
    startsAt: "2099-09-10 00:00:00",
    expiresAt: "2099-09-09 12:00:00",
    estimateCents: 20000,
    depositCents: 5000,
    durationMinutes: 60,
  };
  mocks.conflicts = [];
  mocks.insert.mockResolvedValue([{ insertId: 7 }]);
});
describe("waitlist acceptance", () => {
  it("denies another client before creating any records", async () => {
    await expect(caller("outsider").accept({ id: 1 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("rejects an expired offer and a newly conflicting appointment", async () => {
    mocks.entry.expiresAt = "2000-01-01 00:00:00";
    await expect(caller().accept({ id: 1 })).rejects.toThrow("expired");
    mocks.entry.expiresAt = "2099-09-09 12:00:00";
    mocks.conflicts = [{ id: 9 }];
    await expect(caller().accept({ id: 1 })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("reuses the proposal on a repeated acceptance", async () => {
    mocks.entry.status = "accepted";
    mocks.entry.sessionPlanId = 42;
    expect(await caller().accept({ id: 1 })).toEqual({ sessionPlanId: 42 });
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("creates a pending proposal with integer cents, rather than a paid booking", async () => {
    expect(await caller().accept({ id: 1 })).toEqual({ sessionPlanId: 7 });
    expect(mocks.insert.mock.calls[0][0]).toMatchObject({
      depositTotalCents: 5000,
      totalEstimateCents: 20000,
      clientId: "client-a",
    });
    expect(mocks.insert.mock.calls).toHaveLength(3);
    expect(mocks.insert.mock.calls[0][0]).not.toHaveProperty("depositPaid");
  });
  it("does not let clients issue offers", async () => {
    await expect(
      caller().offer({
        id: 1,
        startsAt: "2099-09-10T00:00:00Z",
        durationMinutes: 60,
        estimateCents: 10000,
        depositCents: 5000,
        expiresInHours: 24,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
