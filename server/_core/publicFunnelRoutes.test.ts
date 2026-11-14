// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
const state = vi.hoisted(() => ({
  tables: {} as Record<string, any[]>,
  updated: [] as { table: string; value: any }[],
  queried: [] as string[],
}));
vi.mock("../db", () => ({
  getDb: async () => {
    // Reads the column = value pairs out of a drizzle eq()/and() condition.
    const pairs = (node: any, out: [string, unknown][] = []) => {
      const chunks: any[] = node?.queryChunks ?? [];
      chunks.forEach((chunk, index) => {
        if (chunk?.queryChunks) pairs(chunk, out);
        else if (chunk?.name && chunk?.table) {
          const next = chunks[index + 2];
          out.push([chunk.name, next?.value ?? next]);
        }
      });
      return out;
    };
    const find = (name: string) => ({
      findFirst: async ({ where }: any) => {
        state.queried.push(name);
        const wanted = pairs(where);
        if (!wanted.length) throw new Error("unreadable condition");
        return state.tables[name]?.find(row =>
          wanted.every(([column, value]) => row[column] === value)
        );
      },
    });
    return {
      query: {
        funnelSessions: find("funnel_sessions"),
        users: find("users"),
        artistSettings: find("artist_settings"),
        conversations: find("conversations"),
        leads: find("leads"),
      },
      insert: (table: any) => ({
        values: async (value: any) => {
          const rows = (state.tables[getTableName(table)] ||= []);
          rows.push({ ...value, id: value.id ?? rows.length + 1 });
          return [{ insertId: rows.length }];
        },
      }),
      update: (table: any) => ({
        set: (value: any) => ({
          where: async () => {
            state.updated.push({ table: getTableName(table), value });
          },
        }),
      }),
    };
  },
}));
import { registerPublicFunnelRoutes } from "./publicFunnelRoutes";

const routes: Record<string, (req: any, res: any) => Promise<unknown>> = {};
vi.spyOn(console, "log").mockImplementation(() => {});
registerPublicFunnelRoutes({
  get: (path: string, handler: any) => (routes["GET " + path] = handler),
  post: (path: string, handler: any) => (routes["POST " + path] = handler),
} as any);

const body = () => ({
  artistId: "artist-1",
  sessionId: "session-1",
  acceptedTerms: true,
  intent: { projectType: "sleeve", projectDescription: "A botanical sleeve" },
  contact: {
    firstName: "Mallory",
    lastName: "Typed",
    email: "Owner@Example.com",
    phone: "0400111222",
    birthdate: "1990-04-05",
    city: "Brisbane",
    country: "Australia",
  },
  style: { referenceImages: ["https://cdn.example.com/private-photo.jpg"] },
});
async function submit(payload: any) {
  const res = {
    statusCode: 200,
    body: undefined as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(value: any) {
      this.body = value;
      return this;
    },
  };
  await routes["POST /api/public/funnel/submit"]({ body: payload }, res);
  return res;
}
const logged = () =>
  [...vi.mocked(console.log).mock.calls, ...vi.mocked(console.error).mock.calls]
    .flat()
    .map(String)
    .join("\n");

const artist = { id: "artist-1", role: "artist" };
const owner = {
  id: "user-owner",
  role: "client",
  email: "owner@example.com",
  name: "Real Owner",
};
const written = () =>
  Object.fromEntries(
    Object.entries(state.tables).filter(
      ([name]) => !["users", "artist_settings"].includes(name)
    )
  );

beforeEach(() => {
  state.tables = { users: [{ ...artist }] };
  state.updated = [];
  state.queried = [];
  vi.useRealTimers();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("public funnel submission", () => {
  it("never reads, changes or links an account that matches the typed email", async () => {
    state.tables.users.push({ ...owner });
    const res = await submit(body());
    expect(res.body).toEqual({ success: true, leadId: 1 });
    expect(state.updated.map(item => item.table)).not.toContain("users");
    expect(state.tables.users).toEqual([artist, owner]);
    expect(state.tables.leads[0]).toMatchObject({
      artistId: "artist-1",
      clientName: "Mallory Typed",
      clientEmail: "owner@example.com",
      clientPhone: "0400111222",
      clientBirthdate: "1990-04-05",
    });
    // An unlinked lead cannot be used to pass the artist/client relationship check.
    expect(state.tables.leads[0].clientId ?? null).toBeNull();
    expect(state.tables.conversations).toBeUndefined();
    expect(JSON.stringify(written())).not.toContain("user-owner");
  });
  it("does not create an account for a typed email", async () => {
    await submit(body());
    expect(state.tables.users).toEqual([artist]);
    expect(state.tables.leads).toHaveLength(1);
  });
  it("answers the same way whether or not the email already has an account", async () => {
    const fresh = await submit(body());
    state.tables = { users: [{ ...artist }, { ...owner }] };
    const existing = await submit(body());
    expect(existing.body).toEqual(fresh.body);
  });
  it("adds a new lead instead of replacing an earlier request from the same email", async () => {
    const earlier = {
      id: 1,
      artistId: "artist-1",
      clientEmail: "owner@example.com",
      clientPhone: "0499999999",
      funnelSessionId: "the-real-clients-session",
    };
    state.tables.leads = [{ ...earlier }];
    const res = await submit(body());
    expect(res.body).toEqual({ success: true, leadId: 2 });
    expect(state.tables.leads[0]).toEqual(earlier);
    expect(state.updated.filter(item => item.value.clientPhone)).toEqual([]);
  });
  it("updates its own lead when the same session is sent again", async () => {
    await submit(body());
    const again = await submit({
      ...body(),
      contact: { ...body().contact, phone: "0400333444" },
    });
    expect(again.body).toEqual({ success: true, leadId: 1 });
    expect(state.tables.leads).toHaveLength(1);
    expect(
      state.updated.find(item => item.table === "leads")?.value
    ).toMatchObject({ clientPhone: "0400333444" });
  });
  it("rejects an artistId that is not an artist before saving anything", async () => {
    state.tables.users.push({ ...owner });
    for (const artistId of ["user-owner", "nobody", "x".repeat(65)]) {
      const res = await submit({ ...body(), artistId });
      expect(res.statusCode).toBe(400);
    }
    expect(written()).toEqual({});
    expect(logged()).not.toContain("user-owner");
  });
  it("logs the artist and lead ids but none of the submitted details", async () => {
    await submit(body());
    const output = logged();
    expect(output).toContain("artistId=artist-1 leadId=1");
    for (const secret of [
      "owner@example.com",
      "Owner@Example.com",
      "Mallory",
      "0400111222",
      "1990-04-05",
      "private-photo",
      "Brisbane",
    ])
      expect(output).not.toContain(secret);
  });
  it("rejects anyone under 18 or without a real date of birth", async () => {
    const year = new Date().getFullYear();
    for (const birthdate of [
      `${year - 17}-01-01`,
      "2001-02-30",
      "",
      undefined,
    ]) {
      const res = await submit({
        ...body(),
        contact: { ...body().contact, birthdate },
      });
      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        error: "You must be 18 or over to request a tattoo booking.",
      });
    }
    expect(written()).toEqual({});
  });
  it("counts the 18th birthday from the start of the day in the artist's time zone", async () => {
    // 14:30 UTC on 13 Nov: already the 14th in Brisbane, still the 13th in New York.
    vi.useFakeTimers({ now: new Date("2026-11-13T14:30:00Z") });
    const turning18 = {
      ...body(),
      contact: { ...body().contact, birthdate: "2008-11-14" },
    };
    state.tables.artist_settings = [
      { userId: "artist-1", timeZone: "America/New_York" },
    ];
    expect((await submit(turning18)).statusCode).toBe(400);
    state.tables.artist_settings[0].timeZone = "Australia/Brisbane";
    expect((await submit(turning18)).body).toEqual({
      success: true,
      leadId: 1,
    });
  });
  it("rejects a submission that has not accepted the terms", async () => {
    for (const acceptedTerms of [false, undefined, "true"]) {
      const res = await submit({ ...body(), acceptedTerms });
      expect(res.statusCode).toBe(400);
    }
    expect(written()).toEqual({});
  });
});
