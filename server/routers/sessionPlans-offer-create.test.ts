// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as s from "../../drizzle/schema";
import { OutsideHoursError } from "../../shared/businessHours";
const m = vi.hoisted(() => ({
  database: {} as any,
  setOffer: vi.fn(),
  access: vi.fn(),
  conflict: false,
  settings: {} as any,
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
  m.conflict = false;
  m.settings = { subscriptionTier: "free" };
  m.access.mockResolvedValue({ clientId: "client", artistId: "artist" });
});
describe("offer-backed artist proposal", () => {
  const propose = async (
    conflict: boolean,
    confirmedOutsideHours?: string[]
  ) => {
    m.conflict = conflict;
    const writes: any[] = [];
    const tx: any = {
      query: {
        artistSettings: {
          findFirst: async () => m.settings,
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
        from: (table: any) => ({ where: () => ({ for: async () => [{ id: 1 }], limit: async () => table === s.appointments && m.conflict ? [{id:99}] : [] }) }),
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
    const operation = sessionPlansRouter
      .createCaller({ user: { id: "artist", role: "artist" } } as any)
      .create({
        conversationId: 1,
        clientId: "client",
        offerId: 7,
        sessions,
        scheduling: { frequency: "weekly", timeZone: "Australia/Brisbane" },
        confirmedOutsideHours,
      });
    if (conflict) {
      await expect(operation).rejects.toThrow("conflicts with an existing booking");
      expect(writes).toEqual([]);
      expect(m.setOffer).not.toHaveBeenCalled();
      return;
    }
    const result = await operation;
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
  };
  it.each([false, true])(
    "checks occupied dates before writing the proposal (conflict=%s)",
    conflict => propose(conflict)
  );
  describe("outside business hours", () => {
    // The sitting is Monday 10:00–11:00 am in Brisbane; the artist only works Tuesdays.
    const key = "2027-02-01T00:00:00.000Z/2027-02-01T01:00:00.000Z";
    beforeEach(() => {
      m.settings = {
        subscriptionTier: "free",
        // Hours belong to the artist's zone even when the proposal names another.
        timeZone: "Australia/Brisbane",
        workSchedule: JSON.stringify({
          tuesday: { enabled: true, start: "09:00", end: "17:00" },
        }),
      };
    });
    it("refuses an unconfirmed sitting and names it", async () => {
      const error = await propose(false).catch(e => e);
      expect(error).toMatchObject({ code: "PRECONDITION_FAILED" });
      expect(error.cause).toBeInstanceOf(OutsideHoursError);
      expect(error.cause.issues).toMatchObject([
        { key, reason: "closed", day: "Monday", sessionIndex: 1 },
      ]);
      expect(m.setOffer).not.toHaveBeenCalled();
    });
    it("is not satisfied by a confirmation for a different time", async () => {
      await expect(
        propose(false, ["2027-02-08T00:00:00.000Z/2027-02-08T01:00:00.000Z"])
      ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
      expect(m.setOffer).not.toHaveBeenCalled();
    });
    it("sends the proposal once the sitting is confirmed", () =>
      propose(false, [key]));
    it("does not ask when hours were never set up", async () => {
      m.settings.workSchedule = "{}";
      await propose(false);
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
