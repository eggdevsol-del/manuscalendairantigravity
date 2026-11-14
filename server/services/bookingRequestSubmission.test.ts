// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
const state = vi.hoisted(() => ({
  tables: {} as Record<string, any[]>,
  fail: "",
  transactions: 0,
  missing: false,
  account: undefined as any,
  timeZone: "Australia/Brisbane",
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
          findFirst: async () => ({
            userId: "artist",
            funnelEnabled: 1,
            timeZone: state.timeZone,
          }),
        },
        users: { findFirst: async () => state.account },
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
  birthdate: "1990-01-01",
  acceptedTerms: true,
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
  state.account = undefined;
  state.timeZone = "Australia/Brisbane";
  vi.useRealTimers();
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
  it("rejects a guest under 18, or with no real date of birth, before saving anything", async () => {
    const submit = (birthdate?: string) =>
      funnelRouter
        .createCaller({ user: null, req: {}, res: {} } as any)
        .submitPublicBooking({ ...guestRequest, birthdate });
    const year = new Date().getFullYear();
    for (const birthdate of [`${year - 17}-01-01`, "2001-02-30", "", undefined])
      await expect(submit(birthdate)).rejects.toThrow(
        "You must be 18 or over to request a tattoo booking."
      );
    expect(state.tables).toEqual({});
  });
  it("leaves a guest request unlinked when the typed email belongs to an account", async () => {
    state.account = { id: "victim", email: "test@example.com" };
    await guest();
    // Linking is left to auth.claimLead, which checks the password.
    expect(state.tables.leads[0].clientId).toBeNull();
    expect(state.tables.consultations[0].clientId).toBeNull();
    expect(state.tables.conversations[0].clientId).toBeNull();
    expect(state.tables.messages.map(row => row.senderId)).toEqual([
      "artist",
      "artist",
    ]);
    expect(JSON.stringify(state.tables)).not.toContain("victim");
  });
  it("counts a guest's 18th birthday in the artist's time zone and stores the trimmed date", async () => {
    // 14:30 UTC on 13 Nov: already the 14th in Brisbane, still the 13th in New York.
    vi.useFakeTimers({ now: new Date("2026-11-13T14:30:00Z") });
    const submit = () =>
      funnelRouter
        .createCaller({ user: null, req: {}, res: {} } as any)
        .submitPublicBooking({ ...guestRequest, birthdate: " 2008-11-14 " });
    state.timeZone = "America/New_York";
    await expect(submit()).rejects.toThrow("You must be 18 or over");
    expect(state.tables).toEqual({});
    state.timeZone = "Australia/Brisbane";
    await submit();
    expect(state.tables.leads[0].clientBirthdate).toBe("2008-11-14");
  });
  it("rejects a guest who has not accepted the terms", async () => {
    for (const acceptedTerms of [false, undefined])
      await expect(
        funnelRouter
          .createCaller({ user: null, req: {}, res: {} } as any)
          .submitPublicBooking({ ...guestRequest, acceptedTerms })
      ).rejects.toThrow("Please agree to the Terms of Service");
    expect(state.tables).toEqual({});
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
