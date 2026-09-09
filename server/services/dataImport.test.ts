// @vitest-environment node
import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  candidates: [] as any[],
  conversation: null as any,
  appointment: null as any,
  conflicts: [] as any[],
  insert: vi.fn(),
  forms: vi.fn(),
  transactions: vi.fn(),
}));
vi.mock("./appointmentService", () => ({ generateRequiredForms: mocks.forms }));
vi.mock("./core", () => {
  const database = {
    query: {
      artistSettings: { findFirst: async () => ({ services: "[]" }) },
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
      },
      true
    );
    expect(mocks.transactions).toHaveBeenCalledOnce();
    expect(mocks.forms).toHaveBeenCalledWith(42, expect.anything());
    expect(result[0]).toMatchObject({ status: "imported", sourceRow: 18 });
    expect(mocks.insert.mock.calls[2][0]).toMatchObject({
      totalExpectedAmountCents: 10025,
      totalPaidAmountCents: 0,
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
