// @vitest-environment node
import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  candidates: [] as any[],
  services: [] as any[],
  conversation: null as any,
  appointment: null as any,
  conflicts: [] as any[],
  insert: vi.fn(),
  update: vi.fn(),
  forms: vi.fn(),
  transactions: vi.fn(),
}));
vi.mock("./appointmentService", () => ({ generateRequiredForms: mocks.forms }));
vi.mock("./core", () => {
  const database = {
    query: {
      artistSettings: {
        findFirst: async () => ({ services: JSON.stringify(mocks.services) }),
      },
      conversations: { findFirst: async () => mocks.conversation },
      appointments: { findFirst: async () => mocks.appointment },
    },
    select: () => ({
      from: () => ({
        where: () => ({
          then: (resolve: any) =>
            Promise.resolve(mocks.candidates).then(resolve),
          limit: async (n: number) =>
            n === 3 ? mocks.candidates : mocks.conflicts,
          for: async () => [],
        }),
      }),
    }),
    insert: () => ({ values: mocks.insert }),
    update: () => ({ set: (v: any) => ({ where: () => mocks.update(v) }) }),
  };
  return {
    getDb: async () => database,
    withDatabaseTransaction: async (fn: any) => {
      mocks.transactions();
      return fn(database);
    },
  };
});
import { processImport } from "./dataImport";
import { importRowSchema } from "../../shared/importData";
const row = (changes: any = {}) =>
  importRowSchema.parse({
    name: "Client",
    email: "client@example.test",
    sourceRow: 2,
    ...changes,
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.candidates = [];
  mocks.services = [];
  mocks.conversation = null;
  mocks.appointment = null;
  mocks.conflicts = [];
  mocks.insert.mockResolvedValue([{ insertId: 42 }]);
  mocks.forms.mockResolvedValue(undefined);
});
describe("duplicate-aware imports", () => {
  it("previews without writes and detects repeated normalized contacts", async () => {
    const result = await processImport(
      "artist-a",
      {
        mode: "clients",
        serviceMap: {},
        rows: [row(), row({ email: " CLIENT@EXAMPLE.TEST " })],
      },
      false
    );
    expect(result.map(r => r.status)).toEqual(["new", "duplicate"]);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("skips existing client relationships without overwriting an account", async () => {
    mocks.candidates = [{ id: "client-a", role: "client" }];
    mocks.conversation = { id: 3 };
    const result = await processImport(
      "artist-a",
      { mode: "clients", serviceMap: {}, rows: [row()] },
      true
    );
    expect(result[0].status).toBe("duplicate");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("rejects ambiguous matches and non-client identities", async () => {
    for (const candidates of [
      [
        { id: "one", role: "client" },
        { id: "two", role: "client" },
      ],
      [{ id: "artist", role: "artist" }],
    ]) {
      mocks.candidates = candidates;
      const result = await processImport(
        "artist-a",
        { mode: "clients", serviceMap: {}, rows: [row()] },
        true
      );
      expect(result[0].status).toBe("conflict");
    }
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("flags conflicting appointment times before creating users or forms", async () => {
    mocks.conflicts = [{ id: 10 }];
    const result = await processImport(
      "artist-a",
      {
        mode: "appointments",
        serviceMap: {},
        rows: [row({ date: "2026-10-09", startTime: "10:00" })],
      },
      true
    );
    expect(result[0].status).toBe("conflict");
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.forms).not.toHaveBeenCalled();
  });
  it("creates appointments and forms in the transaction path and retains source row identity", async () => {
    const result = await processImport(
      "artist-a",
      {
        mode: "appointments",
        serviceMap: {},
        rows: [
          row({
            sourceRow: 18,
            date: "09/10/2026",
            startTime: "10:00",
            price: 100.25,
          }),
        ],
        depositsPaid: false,
      },
      true,
      new Date("2026-09-01T00:00:00Z")
    );
    expect(mocks.transactions).toHaveBeenCalledOnce();
    expect(mocks.forms).toHaveBeenCalledWith(42, expect.anything());
    expect(result[0]).toMatchObject({ status: "imported", sourceRow: 18 });
    expect(mocks.insert.mock.calls[2][0]).toMatchObject({
      totalExpectedAmountCents: 10025,
      totalPaidAmountCents: 0,
    });
  });
  it("does not map an unknown imported service to a legacy service without an id", async () => {
    mocks.services = [{ name: "Full day", price: 900, duration: 480 }];
    const result = await processImport(
      "artist-a",
      {
        mode: "appointments",
        serviceMap: {},
        rows: [
          row({
            date: "2026-10-09",
            startTime: "10:00",
            serviceName: "Unknown",
            price: 100.25,
          }),
        ],
      },
      true
    );
    expect(result[0].status).toBe("imported");
    expect(mocks.insert.mock.calls[2][0]).toMatchObject({
      totalExpectedAmountCents: 10025,
    });
  });
  it("keeps row failures visible without aborting later rows", async () => {
    const result = await processImport(
      "artist-a",
      {
        mode: "clients",
        serviceMap: {},
        rows: [
          row({ email: "invalid" }),
          row({ email: "second@example.test", sourceRow: 3 }),
        ],
      },
      true
    );
    expect(result.map(r => r.status)).toEqual(["invalid", "imported"]);
  });
});

describe("imported appointment payments", () => {
  const now = new Date("2026-11-10T00:00:00Z");
  const appt = (date: string, price = 2000) =>
    row({ date, startTime: "10:00", endTime: "18:00", price });
  it("marks sittings that have already happened as completed and paid in full", async () => {
    await processImport(
      "artist-a",
      { mode: "appointments", serviceMap: {}, rows: [appt("2026-10-01")] },
      true,
      now
    );
    const values = mocks.insert.mock.calls.at(-1)![0];
    expect(values).toMatchObject({
      status: "completed",
      paymentStatus: "fully_paid",
      totalPaidAmountCents: 200000,
      remainingBalanceCents: 0,
    });
    expect(mocks.forms).not.toHaveBeenCalled();
  });
  it("gives upcoming sittings the chosen deposit, paid or still to request", async () => {
    await processImport(
      "artist-a",
      {
        mode: "appointments",
        serviceMap: {},
        rows: [appt("2026-12-01")],
        depositPercent: 30,
      },
      true,
      now
    );
    expect(mocks.insert.mock.calls.at(-1)![0]).toMatchObject({
      status: "confirmed",
      paymentStatus: "deposit_paid",
      depositAmount: 600,
      totalPaidAmountCents: 60000,
      remainingBalanceCents: 140000,
    });
    await processImport(
      "artist-a",
      {
        mode: "appointments",
        serviceMap: {},
        rows: [appt("2026-12-02")],
        depositPercent: 30,
        depositsPaid: false,
      },
      true,
      now
    );
    expect(mocks.insert.mock.calls.at(-1)![0]).toMatchObject({
      paymentStatus: "pending_deposit",
      depositAmount: 600,
      totalPaidAmountCents: 0,
      remainingBalanceCents: 200000,
    });
  });
  it("skips clashing rows by default, and cancels the clashing bookings when replacing", async () => {
    mocks.conflicts = [{ id: 7 }];
    const skipped = await processImport(
      "artist-a",
      { mode: "appointments", serviceMap: {}, rows: [appt("2026-12-03")] },
      false,
      now
    );
    expect(skipped[0].status).toBe("conflict");
    const preview = await processImport(
      "artist-a",
      {
        mode: "appointments",
        serviceMap: {},
        rows: [appt("2026-12-03")],
        replaceExisting: true,
      },
      false,
      now
    );
    expect(preview[0]).toMatchObject({ status: "new", replaces: 1 });
    expect(mocks.update).not.toHaveBeenCalled();
    await processImport(
      "artist-a",
      {
        mode: "appointments",
        serviceMap: {},
        rows: [appt("2026-12-03")],
        replaceExisting: true,
      },
      true,
      now
    );
    expect(mocks.update).toHaveBeenCalledWith({ status: "cancelled" });
    expect(mocks.insert).toHaveBeenCalled();
  });
});
