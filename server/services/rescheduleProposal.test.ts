// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import * as s from "../../drizzle/schema";
const m = vi.hoisted(() => ({
  conflict: vi.fn(),
  message: vi.fn(),
  writes: [] as any[],
  checkout: false,
  pending: [] as any[],
}));
vi.mock("./appointmentService", () => ({
  checkAppointmentOverlap: m.conflict,
}));
vi.mock("./conversationService", () => ({ createMessage: m.message }));
import { proposeReschedule } from "./rescheduleApproval";
const booking = {
  id: 4,
  artistId: "artist",
  clientId: "client",
  conversationId: 9,
  timeZone: "Australia/Brisbane",
  sessionIndex: 2,
  startTime: "2027-01-05T00:00:00Z",
  endTime: "2027-01-05T01:00:00Z",
  totalExpectedAmountCents: 75000,
  totalPaidAmountCents: 20000,
};
const application = {
  id: 6,
  originalJson: JSON.stringify({ items: [{ id: 3, estimateCents: 100000 }] }),
  quoteJson: JSON.stringify({ items: [{ id: 3, estimateCents: 75000 }] }),
};
const start = new Date("2027-02-05T00:00:00Z"),
  end = new Date("2027-02-05T01:00:00Z");
function database() {
  return {
    query: { sessionPlanItems: { findFirst: async () => ({ id: 3 }) } },
    select: () => ({
      from: () => ({
        where: async () => m.pending,
        innerJoin: () => ({
          where: () => ({ limit: async () => (m.checkout ? [{ id: 8 }] : []) }),
        }),
      }),
    }),
    insert: (table: any) => ({
      values: async (value: any) => {
        m.writes.push({ table, value });
        return [{ insertId: 12 }];
      },
    }),
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  m.writes = [];
  m.pending = [];
  m.checkout = false;
  m.conflict.mockResolvedValue(false);
});
it("saves a hold and notification without changing the existing booking", async () => {
  const result = await proposeReschedule(
    database(),
    booking,
    application,
    { kind: "discount", name: "January" },
    start,
    end,
    true
  );
  expect(result).toMatchObject({
    success: true,
    requestId: 12,
    requiresApproval: true,
  });
  const hold = m.writes.find(w => w.table === s.rescheduleRequests).value;
  expect(hold.startsAt).toBe("2027-02-05 00:00:00");
  expect(JSON.parse(hold.termsJson).remainingCents).toBe(80000);
  expect(
    +new Date(hold.expiresAt.replace(" ", "T") + "Z") - Date.now()
  ).toBeLessThanOrEqual(24 * 3600000);
  expect(m.writes.some(w => w.table === s.appointments)).toBe(false);
  expect(m.message).toHaveBeenCalledOnce();
  expect(m.writes.some(w => w.table === s.notificationOutbox)).toBe(true);
});
it("refuses a hold when another provider checkout is already underway", async () => {
  m.checkout = true;
  await expect(
    proposeReschedule(
      database(),
      booking,
      application,
      { kind: "discount", name: "January" },
      start,
      end,
      true
    )
  ).rejects.toThrow("checking out");
  expect(m.writes).toHaveLength(0);
});
it("preview creates no hold, message or push", async () => {
  const result = await proposeReschedule(
    database(),
    booking,
    application,
    { kind: "discount", name: "January" },
    start,
    end,
    false
  );
  expect(result).toMatchObject({ success: false, requiresApproval: true });
  expect(m.writes).toHaveLength(0);
  expect(m.message).not.toHaveBeenCalled();
});
