// @vitest-environment node
import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  candidates: [] as any[],
  related: [] as string[],
  notes: [] as any[],
  relationships: vi.fn(),
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
vi.mock("./userService", () => ({
  getClientRelationships: mocks.relationships,
}));
vi.mock("./core", async () => {
  const schema = await vi.importActual<typeof import("../../drizzle/schema")>(
    "../../drizzle/schema"
  );
  const database = {
    query: {
      artistSettings: {
        findFirst: async () => ({ services: JSON.stringify(mocks.services) }),
      },
      conversations: { findFirst: async () => mocks.conversation },
      appointments: { findFirst: async () => mocks.appointment },
    },
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          limit: async () =>
            table === schema.users
              ? mocks.candidates
              : table === schema.clientNotes
                ? mocks.notes
                : mocks.conflicts,
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
import { importedEmailNoteId, processImport } from "./dataImport";
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
  mocks.related = [];
  mocks.notes = [];
  mocks.relationships.mockImplementation(
    async (_db: any, _artistId: string, ids: string[]) => ({
      related: new Set(ids.filter(id => mocks.related.includes(id))),
      unclaimed: new Set<string>(),
    })
  );
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
    mocks.candidates = [{ id: "client-a", email: "client@example.test" }];
    mocks.related = ["client-a"];
    mocks.conversation = { id: 3 };
    const result = await processImport(
      "artist-a",
      { mode: "clients", serviceMap: {}, rows: [row()] },
      true
    );
    expect(result[0].status).toBe("duplicate");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("asks the artist to resolve a contact that matches two of their own clients", async () => {
    mocks.candidates = [
      { id: "one", email: "client@example.test" },
      { id: "two", email: null },
    ];
    mocks.related = ["one", "two"];
    const result = await processImport(
      "artist-a",
      { mode: "clients", serviceMap: {}, rows: [row({ phone: "0412345678" })] },
      true
    );
    expect(result[0].status).toBe("conflict");
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

describe("contacts that belong to someone else's account", () => {
  const stranger = { id: "user_victim", email: "Client@Example.test " };
  const appointmentRow = () =>
    row({ date: "2026-12-01", startTime: "10:00", price: 500 });
  const usersInsert = () =>
    mocks.insert.mock.calls.map(c => c[0]).find(v => v.loginMethod);

  it("previews an unrelated account exactly like a person nobody has heard of", async () => {
    const input = {
      mode: "appointments" as const,
      serviceMap: {},
      rows: [appointmentRow()],
    };
    const unknown = await processImport("artist-a", input, false);
    mocks.candidates = [stranger];
    const taken = await processImport("artist-a", input, false);
    expect(taken).toEqual(unknown);
    expect(taken[0].status).toBe("new");
    expect(mocks.relationships).toHaveBeenCalledWith(
      expect.anything(),
      "artist-a",
      ["user_victim"]
    );
  });

  it("writes nothing against the unrelated account and leaves its email off the new record", async () => {
    mocks.candidates = [stranger];
    const result = await processImport(
      "artist-a",
      { mode: "appointments", serviceMap: {}, rows: [appointmentRow()] },
      true,
      new Date("2026-11-10T00:00:00Z")
    );
    expect(result[0].status).toBe("imported");
    const [user, note, conversation, appointment] = mocks.insert.mock.calls.map(
      c => c[0]
    );
    expect(note.clientId).toBe(user.id);
    expect(user).toMatchObject({
      name: "Client",
      email: null,
      role: "client",
      loginMethod: "imported",
    });
    expect(user.id).toMatch(/^usr_imp_/);
    expect(conversation).toEqual({ artistId: "artist-a", clientId: user.id });
    expect(appointment.clientId).toBe(user.id);
    expect(JSON.stringify(mocks.insert.mock.calls)).not.toContain(
      "user_victim"
    );
  });

  it("treats another artist's or a non-client account the same way", async () => {
    mocks.candidates = [
      { id: "artist-b", email: "client@example.test" },
      { id: "usr_imp_theirs", email: "client@example.test" },
    ];
    const result = await processImport(
      "artist-a",
      { mode: "clients", serviceMap: {}, rows: [row()] },
      true
    );
    expect(result[0].status).toBe("imported");
    expect(usersInsert()).toMatchObject({ email: null });
    expect(usersInsert().id).toMatch(/^usr_imp_/);
  });

  it("keeps a phone-only match's email, which nobody else holds", async () => {
    mocks.candidates = [{ id: "user_victim", email: "other@example.test" }];
    await processImport(
      "artist-a",
      { mode: "clients", serviceMap: {}, rows: [row({ phone: "0412345678" })] },
      true
    );
    expect(usersInsert()).toMatchObject({
      email: "client@example.test",
      phone: "+61412345678",
    });
  });

  it("reuses the account when the artist already works with that client", async () => {
    mocks.candidates = [stranger];
    mocks.related = ["user_victim"];
    const preview = await processImport(
      "artist-a",
      { mode: "appointments", serviceMap: {}, rows: [appointmentRow()] },
      false
    );
    expect(preview[0].status).toBe("matched");
    await processImport(
      "artist-a",
      { mode: "appointments", serviceMap: {}, rows: [appointmentRow()] },
      true
    );
    expect(usersInsert()).toBeUndefined();
    expect(mocks.insert.mock.calls.at(-1)![0].clientId).toBe("user_victim");
  });

  it("picks the artist's own client out of several accounts sharing a contact", async () => {
    mocks.candidates = [stranger, { id: "usr_imp_mine", email: null }];
    mocks.related = ["usr_imp_mine"];
    await processImport(
      "artist-a",
      { mode: "clients", serviceMap: {}, rows: [row({ phone: "0412345678" })] },
      true
    );
    expect(mocks.insert).toHaveBeenCalledOnce();
    expect(mocks.insert.mock.calls[0][0]).toEqual({
      artistId: "artist-a",
      clientId: "usr_imp_mine",
    });
  });

  it("keeps the dropped email in the artist's own note, keyed by artist and address", async () => {
    mocks.candidates = [stranger];
    await processImport(
      "artist-a",
      { mode: "clients", serviceMap: {}, rows: [row()] },
      true
    );
    const [user, note] = mocks.insert.mock.calls.map(c => c[0]);
    expect(user.email).toBeNull();
    expect(note).toEqual({
      id: importedEmailNoteId("artist-a", "client@example.test"),
      artistId: "artist-a",
      clientId: user.id,
      note: "Email from import: client@example.test",
    });
    expect(note.id).not.toBe(
      importedEmailNoteId("artist-b", "client@example.test")
    );
  });

  it("writes no note when nobody else holds the email", async () => {
    await processImport(
      "artist-a",
      { mode: "clients", serviceMap: {}, rows: [row()] },
      true
    );
    const written = mocks.insert.mock.calls.map(c => c[0]);
    expect(written).toHaveLength(2);
    expect(written[0]).toMatchObject({ email: "client@example.test" });
    expect(written.some(v => "note" in v)).toBe(false);
  });

  it("keeps the email of a walk-in another artist imported first, without touching their record", async () => {
    mocks.candidates = [{ id: "usr_imp_theirs", email: "client@example.test" }];
    const result = await processImport(
      "artist-a",
      { mode: "clients", serviceMap: {}, rows: [row()] },
      true
    );
    expect(result[0].status).toBe("imported");
    const [user, note, conversation] = mocks.insert.mock.calls.map(c => c[0]);
    expect(user).toMatchObject({ email: null, phone: null });
    expect(note).toMatchObject({
      clientId: user.id,
      note: "Email from import: client@example.test",
    });
    expect(conversation.clientId).toBe(user.id);
    expect(JSON.stringify(mocks.insert.mock.calls)).not.toContain(
      "usr_imp_theirs"
    );
  });

  it.each([
    ["the same row", {}],
    ["a phone added", { phone: "0412345678" }],
    ["the name corrected", { name: "Cliente" }],
  ])(
    "does not add the same person again when re-imported with %s",
    async (_label, changes) => {
      mocks.candidates = [stranger];
      mocks.notes = [{ clientId: "usr_imp_earlier" }];
      mocks.related = ["usr_imp_earlier"];
      mocks.conversation = { id: 9 };
      const result = await processImport(
        "artist-a",
        { mode: "clients", serviceMap: {}, rows: [row(changes)] },
        true
      );
      expect(result[0].status).toBe("duplicate");
      expect(mocks.insert).not.toHaveBeenCalled();
    }
  );

  it("does not book the same sitting twice on a re-import, even when replacing", async () => {
    mocks.candidates = [stranger];
    mocks.notes = [{ clientId: "usr_imp_earlier" }];
    mocks.related = ["usr_imp_earlier"];
    mocks.conversation = { id: 9 };
    mocks.appointment = { id: 5 };
    mocks.conflicts = [{ id: 5 }];
    await processImport(
      "artist-a",
      {
        mode: "appointments",
        serviceMap: {},
        rows: [appointmentRow()],
        replaceExisting: true,
      },
      true
    );
    const written = mocks.insert.mock.calls.map(c => c[0]);
    expect(written).toHaveLength(1);
    expect(written[0].clientId).toBe("usr_imp_earlier");
    expect(mocks.update).toHaveBeenCalledWith({ status: "cancelled" });
  });

  it("never merges two same-named people: the name is not a key", async () => {
    mocks.candidates = [stranger];
    await processImport(
      "artist-a",
      { mode: "clients", serviceMap: {}, rows: [row()] },
      true
    );
    const first = mocks.insert.mock.calls[0][0].id;
    mocks.insert.mockClear();
    mocks.candidates = [{ id: "user_other", email: "second@example.test" }];
    await processImport(
      "artist-a",
      {
        mode: "clients",
        serviceMap: {},
        rows: [row({ email: "second@example.test" })],
      },
      true
    );
    const [user, note] = mocks.insert.mock.calls.map(c => c[0]);
    expect(user.id).not.toBe(first);
    expect(note.id).toBe(
      importedEmailNoteId("artist-a", "second@example.test")
    );
  });

  it("re-points a note whose record is no longer the artist's client", async () => {
    mocks.candidates = [stranger];
    mocks.notes = [{ clientId: "usr_imp_gone" }];
    await processImport(
      "artist-a",
      { mode: "clients", serviceMap: {}, rows: [row()] },
      true
    );
    const written = mocks.insert.mock.calls.map(c => c[0]);
    expect(written.some(v => "note" in v)).toBe(false);
    expect(mocks.update).toHaveBeenCalledWith({
      clientId: written[0].id,
      note: "Email from import: client@example.test",
    });
  });
});
