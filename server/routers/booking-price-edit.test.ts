// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({ rows: [] as any[], writes: [] as any[] }));
vi.mock("../services/core", async importOriginal => ({
  ...(await importOriginal<typeof import("../services/core")>()),
  withDatabaseTransaction: async (work: any) =>
    work({
      select: () => ({
        from: () => ({ where: () => ({ for: async () => fixture.rows }) }),
      }),
      update: () => ({
        set: (values: any) => ({
          where: async () => fixture.writes.push(values),
        }),
      }),
    }),
}));
import { appointmentsRouter } from "./appointments";
const caller = (id = "artist") =>
  appointmentsRouter.createCaller({
    user: { id, role: "artist" },
    req: {},
    res: {},
  } as any);
beforeEach(() => {
  fixture.rows = [
    { id: 1, totalPaidAmountCents: 15000 },
    { id: 2, totalPaidAmountCents: 20000 },
  ];
  fixture.writes = [];
});
describe("apply price to upcoming bookings", () => {
  it("recalculates each selected session balance independently", async () => {
    await caller().batchUpdateClientPrices({
      clientId: "client",
      artistId: "artist",
      appointmentId: 1,
      price: 700,
    });
    expect(fixture.writes.map(row => row.remainingBalanceCents)).toEqual([
      55000, 50000,
    ]);
    expect(fixture.writes.map(row => row.totalPaidAmountCents)).toEqual([
      15000, 20000,
    ]);
  });
  it("validates every session before writing any price", async () => {
    fixture.rows[1].totalPaidAmountCents = 80000;
    await expect(
      caller().batchUpdateClientPrices({
        clientId: "client",
        artistId: "artist",
        appointmentId: 1,
        price: 700,
      })
    ).rejects.toThrow("already received");
    expect(fixture.writes).toEqual([]);
  });
  it("rejects a current appointment outside the editable scope", async () => {
    await expect(
      caller().batchUpdateClientPrices({
        clientId: "client",
        artistId: "artist",
        appointmentId: 99,
        price: 700,
      })
    ).rejects.toThrow("no longer editable");
    expect(fixture.writes).toEqual([]);
  });
  it("rejects an unrelated artist", async () => {
    await expect(
      caller("other").batchUpdateClientPrices({
        clientId: "client",
        artistId: "artist",
        price: 700,
      })
    ).rejects.toThrow("Not authorized");
    expect(fixture.writes).toEqual([]);
  });
});
