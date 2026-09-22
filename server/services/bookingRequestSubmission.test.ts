// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
const state = vi.hoisted(() => ({
  tables: {} as Record<string, any[]>,
  fail: "",
  transactions: 0,
  missing: false,
}));
vi.mock("./systemLogService", () => ({ createLog: vi.fn() }));
vi.mock("../db", () => ({
  getDb: async () => {
    throw new Error("Must use transaction");
  },
}));
vi.mock("./core", () => ({
  getDb: async () => {
    throw new Error("Must use transaction");
  },
  withDatabaseTransaction: async (work: any) => {
    if (state.missing) throw new Error("Database connection failed");
    state.transactions++;
    const before = structuredClone(state.tables);
    const row = (name: string) => state.tables[name]?.[0];
    const db = {
      query: {
        artistSettings: {
          findFirst: async () => ({ userId: "artist", funnelEnabled: 1 }),
        },
        users: { findFirst: async () => undefined },
        leads: { findFirst: async () => row("leads") },
        conversations: { findFirst: async () => row("conversations") },
        messages: { findFirst: async () => row("messages") },
        consultations: { findFirst: async () => row("consultations") },
      },
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => ({
              for: async () => [{ id: "artist", role: "artist" }],
            }),
          }),
        }),
      }),
      insert: (table: any) => ({
        values: async (value: any) => {
          const name = getTableName(table);
          if (state.fail === name)
            throw new Error("Injected " + name + " failure");
          const rows = (state.tables[name] ||= []);
          const id = rows.length + 1;
          rows.push({ ...value, id });
          return [{ insertId: id }];
        },
      }),
      update: (table: any) => ({
        set: (value: any) => ({
          where: async () => {
            for (const row of state.tables[getTableName(table)] || [])
              Object.assign(row, value);
          },
        }),
      }),
    };
    try {
      return await work(db);
    } catch (error) {
      state.tables = before;
      throw error;
    }
  },
}));
import { createConsultation } from "./consultationService";
import { funnelRouter } from "../routers/funnel";
const id = "dc4a8dd4-e79b-4a0c-88bc-f2039c3d9d5e";
const clientRequest = {
  requestId: id,
  artistId: "artist",
  clientId: "client",
  subject: "Booking request",
  description: "A botanical sleeve",
};
const guestRequest = {
  requestId: id,
  artistSlug: "artist",
  firstName: "Test",
  lastName: "Client",
  email: "test@example.com",
  phone: "0400000000",
  description: "A botanical sleeve",
  styles: ["Fine Line"],
  referenceUrls: ["https://example.com/reference.jpg"],
};
const guest = () =>
  funnelRouter
    .createCaller({ user: null, req: {}, res: {} } as any)
    .submitPublicBooking(guestRequest);
beforeEach(() => {
  state.tables = {};
  state.fail = "";
  state.transactions = 0;
  state.missing = false;
});
describe("booking request persistence", () => {
  it("links a signed-in request to its saved message thread", async () => {
    const saved = await createConsultation(clientRequest);
    expect(saved).toMatchObject({ id: 1, conversationId: 1 });
    expect(state.tables.consultations[0].conversationId).toBe(1);
    expect(state.tables.messages[0]).toMatchObject({
      conversationId: 1,
      senderId: "client",
    });
    expect(state.tables.notification_outbox).toHaveLength(1);
    expect(state.transactions).toBe(1);
  });
  it("reuses the signed-in request after a lost response", async () => {
    const first = await createConsultation(clientRequest);
    const second = await createConsultation(clientRequest);
    expect(second.id).toBe(first.id);
    expect(state.tables.consultations).toHaveLength(1);
    expect(state.tables.messages).toHaveLength(1);
  });
  it("uses an existing conversation", async () => {
    state.tables.conversations = [
      { id: 44, artistId: "artist", clientId: "client" },
    ];
    const saved = await createConsultation({
      ...clientRequest,
      requestId: undefined,
    });
    expect(saved.conversationId).toBe(44);
    expect(state.tables.conversations).toHaveLength(1);
  });
  it("saves all guest records and visible messages before acknowledging", async () => {
    const saved = await guest();
    expect(saved).toMatchObject({
      success: true,
      leadId: 1,
      conversationId: 1,
    });
    expect(state.tables.consultations[0].conversationId).toBe(1);
    expect(state.tables.leads[0].consultationId).toBe(1);
    expect(state.tables.messages).toHaveLength(2);
    expect(state.tables.notification_outbox).toHaveLength(1);
  });
  it("reuses a guest request on retry", async () => {
    await guest();
    await guest();
    expect(state.tables.leads).toHaveLength(1);
    expect(state.tables.consultations).toHaveLength(1);
    expect(state.tables.messages).toHaveLength(2);
  });
  for (const table of [
    "consultations",
    "conversations",
    "messages",
    "notification_outbox",
  ])
    it(`rolls back guest writes when ${table} fails`, async () => {
      state.fail = table;
      await expect(guest()).rejects.toThrow("Injected");
      expect(state.tables).toEqual({});
    });
  for (const table of ["consultations", "messages", "notification_outbox"])
    it(`rolls back signed-in writes when ${table} fails`, async () => {
      state.fail = table;
      await expect(createConsultation(clientRequest)).rejects.toThrow(
        "Injected"
      );
      expect(state.tables).toEqual({});
    });
  it("rejects missing database instead of returning empty success", async () => {
    state.missing = true;
    await expect(createConsultation(clientRequest)).rejects.toThrow(
      "Database connection failed"
    );
  });
});
