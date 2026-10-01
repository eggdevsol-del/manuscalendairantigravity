// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as s from "../../drizzle/schema";
const m = vi.hoisted(() => ({
  database: {} as any,
  setOffer: vi.fn(),
  access: vi.fn(),
}));
vi.mock("../db", () => ({ getDb: async () => m.database }));
vi.mock("../services/offerCheckout", () => ({
  setPlanOffer: m.setOffer,
  cancelPlanOfferCheckout: vi.fn(),
  planOfferOptions: vi.fn(),
  releasePlanOffer: vi.fn(),
  validateReservedPlanOffer: vi.fn(),
}));
vi.mock("../services/access", () => ({
  requireArtist: (user: any) => {
    if (user.role !== "artist") throw new Error("artist only");
  },
  requireConversationAccess: m.access,
}));
import { sessionPlansRouter } from "./sessionPlans";
const sessions = [
  {
    sessionIndex: 1,
    startsAt: "2027-02-01T00:00:00Z",
    durationMinutes: 60,
    estimateCents: 10000,
    depositCents: 2500,
  },
];
beforeEach(() => {
  vi.clearAllMocks();
  m.access.mockResolvedValue({ clientId: "client", artistId: "artist" });
});
describe("offer-backed artist proposal", () => {
  it("applies the issued offer inside the creation transaction and publishes its revised prices", async () => {
    const writes: any[] = [];
    const tx: any = {
      query: {
        artistSettings: {
          findFirst: async () => ({ subscriptionTier: "free" }),
        },
        sessionPlans: {
          findMany: async () => [],
          findFirst: async () => ({
            totalEstimateCents: 8500,
            depositTotalCents: 2125,
            items: sessions,
          }),
        },
        offerApplications: { findFirst: async () => null },
      },
      select: () => ({
        from: () => ({ where: () => ({ for: async () => [{ id: 1 }] }) }),
      }),
      insert: (table: any) => ({
        values: async (value: any) => {
          writes.push({ table, value });
          return [{ insertId: table === s.sessionPlans ? 42 : 43 }];
        },
      }),
      update: () => ({ set: () => ({ where: async () => {} }) }),
    };
    m.database = { transaction: async (fn: any) => fn(tx) };
    const result = await sessionPlansRouter
      .createCaller({ user: { id: "artist", role: "artist" } } as any)
      .create({
        conversationId: 1,
        clientId: "client",
        offerId: 7,
        sessions,
        scheduling: { frequency: "weekly", timeZone: "Australia/Brisbane" },
      });
    expect(result.sessionPlanId).toBe(42);
    expect(m.setOffer).toHaveBeenCalledWith(
      tx,
      42,
      "client",
      7,
      "Australia/Brisbane"
    );
    const message = writes.find(w => w.table === s.messages);
    expect(JSON.parse(message.value.metadata)).toMatchObject({
      offerId: 7,
      totalEstimateCents: 8500,
      depositTotalCents: 2125,
    });
  });
  it("refuses a mismatched client before applying an offer", async () => {
    m.database = { transaction: async (fn: any) => fn({}) };
    await expect(
      sessionPlansRouter
        .createCaller({ user: { id: "artist", role: "artist" } } as any)
        .create({
          conversationId: 1,
          clientId: "outsider",
          offerId: 7,
          sessions,
        })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(m.setOffer).not.toHaveBeenCalled();
  });
});
