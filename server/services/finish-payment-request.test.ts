// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ db: vi.fn(), log: vi.fn(), appointment: {} as any, request: null as any, writes: [] as any[] }));
vi.mock("./core", () => ({ withDatabaseTransaction: async (fn: any) => fn(await m.db()) }));
vi.mock("../db", () => ({ getDb: m.db }));
vi.mock("./appointmentService", () => ({ createProcedureLog: m.log }));
vi.mock("./paymentRequestToken", () => ({ createPaymentRequestToken: () => "fixture-token" }));
import { dashboardRouter } from "../routers/dashboard";
import * as schema from "../../drizzle/schema";
const caller = () => dashboardRouter.createCaller({ user: { id: "artist", role: "artist", name: "Artist" }, req: {}, res: {} } as any);
beforeEach(() => {
  vi.clearAllMocks(); m.writes = []; m.request = null;
  m.appointment = { id: 1, artistId: "artist", clientId: "client", status: "confirmed", startTime: "2026-01-01 09:00:00", totalExpectedAmountCents: 200000, totalPaidAmountCents: 50000, remainingBalanceCents: 150000 };
  const db: any = {
    select: () => ({ from: () => ({ where: () => ({ for: async () => [m.appointment] }) }) }),
    query: { paymentRequests: { findFirst: async () => m.request }, aftercareTemplates: { findFirst: async () => ({ id: 3 }) } },
    update: (table: any) => ({ set: (value: any) => ({ where: async () => { m.writes.push({ table, value }); } }) }),
    insert: (table: any) => ({ values: async (value: any) => { m.writes.push({ table, value }); return [{ insertId: 42 }]; } }),
  };
  db.transaction = async (fn: any) => fn(db); m.db.mockResolvedValue(db);
});
describe("finish and request payment", () => {
  it("completes the sitting and requests the persisted balance, not a stale browser amount", async () => {
    await caller().requestPayment({ appointmentId: 1, amountCents: 100, completeSession: true });
    expect(m.writes.find(w => w.table === schema.appointments)?.value).toMatchObject({ status: "completed", aftercareTemplateId: 3 });
    expect(m.writes.find(w => w.table === schema.paymentRequests)?.value.amountCents).toBe(150000);
    expect(m.writes.find(w => w.table === schema.notificationOutbox)).toBeDefined();
    expect(m.log).toHaveBeenCalledWith(1);
  });
  it("finishes once while reusing the existing pending payment request", async () => {
    m.request = { id: 7, token: "existing" };
    const result = await caller().requestPayment({ appointmentId: 1, amountCents: 150000, completeSession: true });
    expect(result.requestId).toBe(7);
    expect(m.writes.filter(w => w.table === schema.paymentRequests || w.table === schema.notificationOutbox)).toEqual([]);
    expect(m.writes[0].value.status).toBe("completed");
  });
  it("completes without another request if payment settled before the artist confirms", async () => {
    m.appointment.remainingBalanceCents = 0;
    const result = await caller().requestPayment({ appointmentId: 1, amountCents: 150000, completeSession: true });
    expect(result.requestId).toBeNull();
    expect(m.writes.filter(w => w.table === schema.paymentRequests || w.table === schema.notificationOutbox)).toEqual([]);
    expect(m.writes[0].value.status).toBe("completed");
  });
  it("rejects another artist's sitting and future sittings", async () => {
    m.appointment.artistId = "other";
    await expect(caller().requestPayment({ appointmentId: 1, amountCents: 100, completeSession: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
    m.appointment.artistId = "artist"; m.appointment.startTime = "2099-01-01 09:00:00";
    await expect(caller().requestPayment({ appointmentId: 1, amountCents: 100, completeSession: true })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(m.writes).toEqual([]);
  });
});
