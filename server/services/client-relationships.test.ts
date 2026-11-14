// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/mysql-proxy";
import * as schema from "../../drizzle/schema";

const mocks = vi.hoisted(() => ({ db: vi.fn() }));
vi.mock("./core", () => ({ getDb: mocks.db }));
import {
  getArtists,
  getClientRelationships,
  hasClientRelationship,
  shareStudio,
} from "./userService";

/** A database whose selectDistinct returns the rows given for each table. */
function fakeDb(rows: Map<unknown, unknown[]>) {
  return {
    selectDistinct: () => ({
      from: (table: unknown) => ({
        where: async () => rows.get(table) ?? [],
      }),
    }),
  };
}

type Row = Record<string, any>;
type Store = Partial<
  Record<
    | "users"
    | "leads"
    | "consultations"
    | "sessionPlans"
    | "appointments"
    | "conversations"
    | "messages",
    Row[]
  >
>;

/**
 * Runs the real drizzle queries against rows held in memory. The filters are
 * read back out of the generated SQL, so a query that stops asking for
 * "client role", "accepted plan" or "paid by card" stops being filtered here
 * too and the tests below fail.
 */
function memoryDb(store: Store) {
  const statements: string[] = [];
  const database = drizzle(
    async (query, params) => {
      statements.push(query);
      const table = /from `(\w+)`/.exec(query)?.[1] as keyof Store;
      const has = (value: unknown) => params.includes(value);
      const rows = (store[table] ?? []).filter(row => {
        if (table === "users")
          return has(row.id) && (!/`role` = \?/.test(query) || has(row.role));
        if (table === "conversations") return has(row.clientId);
        if (table === "messages")
          return has(row.conversationId) && has(row.senderId);
        if (!has(row.artistId) || !has(row.clientId)) return false;
        if (/`status` in/.test(query) && !has(row.status)) return false;
        if (/`depositPaymentId` is not null/.test(query))
          return !!row.depositPaymentId || !!row.balancePaymentId;
        return true;
      });
      return {
        rows: rows.map(row => {
          if (table === "users")
            return [
              row.id,
              row.loginMethod ?? null,
              row.password || row.clerkId || row.googleSub ? 1 : 0,
            ];
          if (table === "conversations")
            return [row.id, row.artistId, row.clientId];
          if (table === "messages") return [row.conversationId, row.senderId];
          return [row.clientId];
        }),
      };
    },
    { schema, mode: "default" }
  );
  return { database, statements };
}

const signedUp = { id: "user_victim", role: "client", password: "hash" };
const thread = { id: 7, artistId: "artist", clientId: "user_victim" };
const related = async (store: Store, clientId = "user_victim") =>
  (
    await getClientRelationships(memoryDb(store).database, "artist", [clientId])
  ).related.has(clientId);

describe("artist and client relationship", () => {
  it("asks the database for client-made evidence only", async () => {
    const { database, statements } = memoryDb({
      users: [signedUp],
      conversations: [thread],
    });
    await getClientRelationships(database, "artist", ["user_victim"]);
    const sqlFor = (table: string) =>
      statements.find(s => s.includes(`from \`${table}\``)) || "";
    expect(sqlFor("users")).toContain("`role` = ?");
    expect(sqlFor("users")).toContain("`password` is not null");
    expect(sqlFor("appointments")).toContain("`depositPaymentId` is not null");
    expect(sqlFor("appointments")).toContain("`balancePaymentId` is not null");
    expect(sqlFor("sessionPlans")).toContain("`status` in (?, ?)");
    expect(sqlFor("messages")).toContain("`senderId` in (?)");
  });

  it("does not count a bare conversation with a signed-up person", async () => {
    expect(await related({ users: [signedUp], conversations: [thread] })).toBe(
      false
    );
  });

  it("does not count an appointment the artist booked or a plan still waiting on the client", async () => {
    const store: Store = {
      users: [signedUp],
      conversations: [thread],
      appointments: [
        {
          artistId: "artist",
          clientId: "user_victim",
          conversationId: 7,
          status: "confirmed",
          depositPaid: 1,
        },
      ],
      sessionPlans: [
        { artistId: "artist", clientId: "user_victim", status: "pending" },
        { artistId: "artist", clientId: "user_victim", status: "withdrawn" },
      ],
      messages: [{ conversationId: 7, senderId: "artist" }],
    };
    expect(await related(store)).toBe(false);
    expect(
      await hasClientRelationship(
        memoryDb(store).database,
        "artist",
        "user_victim"
      )
    ).toBe(false);
  });

  it.each<[string, Store]>([
    [
      "a request from the client's account",
      { leads: [{ artistId: "artist", clientId: "user_victim" }] },
    ],
    [
      "a consultation from the client's account",
      { consultations: [{ artistId: "artist", clientId: "user_victim" }] },
    ],
    [
      "a session plan the client accepted",
      {
        sessionPlans: [
          { artistId: "artist", clientId: "user_victim", status: "accepted" },
        ],
      },
    ],
    [
      "an appointment the client paid for by card",
      {
        appointments: [
          {
            artistId: "artist",
            clientId: "user_victim",
            depositPaymentId: "pi_1",
          },
        ],
      },
    ],
    [
      "a conversation the client has written in",
      {
        conversations: [thread],
        messages: [{ conversationId: 7, senderId: "user_victim" }],
      },
    ],
  ])("counts %s", async (_label, store) => {
    expect(await related({ users: [signedUp], ...store })).toBe(true);
  });

  it("ignores evidence that belongs to another artist", async () => {
    expect(
      await related({
        users: [signedUp],
        conversations: [
          thread,
          { id: 8, artistId: "other", clientId: "user_victim" },
        ],
        leads: [{ artistId: "other", clientId: "user_victim" }],
        messages: [{ conversationId: 8, senderId: "user_victim" }],
      })
    ).toBe(false);
  });

  it("never treats someone who is not a client as a client", async () => {
    // A studio colleague in the client seat who has replied.
    expect(
      await related(
        {
          users: [{ id: "colleague", role: "artist", password: "hash" }],
          conversations: [{ id: 7, artistId: "artist", clientId: "colleague" }],
          messages: [{ conversationId: 7, senderId: "colleague" }],
          appointments: [
            {
              artistId: "artist",
              clientId: "colleague",
              depositPaymentId: "pi",
            },
          ],
        },
        "colleague"
      )
    ).toBe(false);
  });

  it("counts a client record the artist added that nobody has signed in to", async () => {
    for (const record of [
      { id: "client_1", role: "client", loginMethod: null },
      { id: "usr_imp_1", role: "client", loginMethod: "imported" },
    ]) {
      const result = await getClientRelationships(
        memoryDb({
          users: [record],
          conversations: [{ id: 7, artistId: "artist", clientId: record.id }],
        }).database,
        "artist",
        [record.id]
      );
      expect(result.related.has(record.id)).toBe(true);
      expect(result.unclaimed.has(record.id)).toBe(true);
    }
  });

  it("does not hand another artist's client record to an artist who attaches to it later", async () => {
    const result = await getClientRelationships(
      memoryDb({
        users: [{ id: "client_1", role: "client", loginMethod: null }],
        conversations: [
          { id: 3, artistId: "other", clientId: "client_1" },
          { id: 7, artistId: "artist", clientId: "client_1" },
        ],
        appointments: [{ artistId: "artist", clientId: "client_1" }],
      }).database,
      "artist",
      ["client_1"]
    );
    expect(result.related.size).toBe(0);
    expect(result.unclaimed.size).toBe(0);
  });

  it.each([
    // Request-claim sign-up with Google: no password and no Google id stored.
    { id: "user_abc", role: "client", loginMethod: "google" },
    // Old sign-in accounts have none of the three sign-in columns.
    { id: "oauth-open-id", role: "client", loginMethod: null },
  ])(
    "does not mistake a real account without a password for an unclaimed record",
    async account => {
      const result = await getClientRelationships(
        memoryDb({
          users: [account],
          conversations: [{ id: 7, artistId: "artist", clientId: account.id }],
        }).database,
        "artist",
        [account.id]
      );
      expect(result.related.size).toBe(0);
      expect(result.unclaimed.size).toBe(0);
    }
  );

  it("keeps a record the artist made as their client after it is claimed, but no longer editable", async () => {
    const result = await getClientRelationships(
      memoryDb({
        users: [
          {
            id: "client_1",
            role: "client",
            loginMethod: "google",
            googleSub: "g",
          },
        ],
        conversations: [{ id: 7, artistId: "artist", clientId: "client_1" }],
      }).database,
      "artist",
      ["client_1"]
    );
    expect(result.related.has("client_1")).toBe(true);
    expect(result.unclaimed.has("client_1")).toBe(false);
  });

  it("needs both people in the same studio", async () => {
    const rows = (list: unknown[]) =>
      fakeDb(new Map([[schema.studioMembers, list]]));
    expect(
      await shareStudio(
        rows([
          { studioId: "s1", userId: "a" },
          { studioId: "s1", userId: "b" },
        ]),
        "a",
        "b"
      )
    ).toBe(true);
    expect(
      await shareStudio(
        rows([
          { studioId: "s1", userId: "a" },
          { studioId: "s2", userId: "b" },
        ]),
        "a",
        "b"
      )
    ).toBe(false);
  });

  it("does not count a studio invite that has not been accepted", async () => {
    const statements: { sql: string; params: unknown[] }[] = [];
    const database = drizzle(
      async (query, params) => {
        statements.push({ sql: query, params });
        return { rows: [] };
      },
      { schema, mode: "default" }
    );
    await shareStudio(database, "a", "b");
    expect(statements[0].sql).toContain("`status` = ?");
    expect(statements[0].params).toContain("active");
    expect(statements[0].params).not.toContain("pending_invite");
  });
});

describe("artist list", () => {
  beforeEach(() => vi.clearAllMocks());
  it("selects no contact or sign-in columns", async () => {
    let selected: Record<string, unknown> = {};
    mocks.db.mockResolvedValue({
      select: (columns: Record<string, unknown>) => {
        selected = columns;
        return {
          from: () => ({ leftJoin: () => ({ where: async () => [] }) }),
        };
      },
    });
    await getArtists();
    const names = Object.keys(selected);
    expect(names).toContain("name");
    for (const secret of ["email", "phone", "password", "clerkId", "address"])
      expect(names).not.toContain(secret);
    expect(Object.values(selected)).not.toContain(schema.users.email);
  });
});
