// @vitest-environment node
import { is, sql } from "drizzle-orm";
import {
  getTableConfig,
  MySqlDialect,
  MySqlTable,
} from "drizzle-orm/mysql-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  user: {} as any,
  settings: undefined as any,
  /** Answers to count(*) queries, per table, in the order the service asks. */
  counts: new Map<unknown, number[]>(),
  rows: new Map<unknown, any[]>(),
  /** where is the predicate as drizzle would send it: SQL text plus bound values. */
  writes: [] as {
    op: "delete" | "update";
    table: unknown;
    set?: any;
    where: { sql: string; params: unknown[] };
  }[],
  counted: [] as {
    table: unknown;
    where: { sql: string; params: unknown[] };
  }[],
  transactions: 0,
  billing: vi.fn(),
  balance: vi.fn(),
}));
vi.mock("./core", async () => {
  const { users } = await import("../../drizzle/schema");
  const { MySqlDialect } = await import("drizzle-orm/mysql-core");
  const dialect = new MySqlDialect();
  const render = (condition: any) => {
    const { sql, params } = dialect.sqlToQuery(condition);
    return { sql, params };
  };
  const db = {
    query: { artistSettings: { findFirst: async () => fixture.settings } },
    select: (columns?: Record<string, unknown>) => ({
      from: (table: unknown) => ({
        where: (condition: any) => {
          if (columns && "n" in columns)
            fixture.counted.push({ table, where: render(condition) });
          const result =
            columns && "n" in columns
              ? [{ n: fixture.counts.get(table)?.shift() ?? 0 }]
              : table === users
                ? [fixture.user].filter(Boolean)
                : (fixture.rows.get(table) ?? []);
          return Object.assign(Promise.resolve(result), {
            for: async () => result,
          });
        },
      }),
    }),
    delete: (table: unknown) => ({
      where: async (condition: any) =>
        fixture.writes.push({ op: "delete", table, where: render(condition) }),
    }),
    update: (table: unknown) => ({
      set: (set: any) => ({
        where: async (condition: any) => {
          fixture.writes.push({
            op: "update",
            table,
            set,
            where: render(condition),
          });
          if (table === users) Object.assign(fixture.user, set);
        },
      }),
    }),
  };
  return {
    getDb: async () => db,
    withDatabaseTransaction: async (work: any) => {
      fixture.transactions++;
      const before = fixture.writes.length;
      const user = { ...fixture.user };
      try {
        return await work(db);
      } catch (error) {
        // A real transaction rolls back; mirror that so a blocked deletion leaves no trace.
        fixture.writes.length = before;
        fixture.user = user;
        throw error;
      }
    },
  };
});
vi.mock("./accountBilling", () => ({
  assertAccountBillingClosed: fixture.billing,
}));
vi.mock("./stripe", () => ({
  stripe: { balance: { retrieve: fixture.balance } },
}));
vi.mock("../db", () => ({
  getUserById: async () => fixture.user,
  getUser: async () => fixture.user,
}));

import { TRPCError } from "@trpc/server";
import * as schema from "../../drizzle/schema";
import { generateToken } from "../_core/auth-new";
import { sdk } from "../_core/sdk";
import {
  DELETED_TABLES,
  KEPT_TABLES,
  SCRUBBED_TABLES,
  deleteAccount,
  deletionBlockers,
  type DeletionSummary,
} from "./accountDeletion";
import { accountEnabled } from "./masterDevAccess";

const clear: DeletionSummary = {
  role: "client",
  upcomingConfirmedSittings: 0,
  pendingBookingRequests: 0,
  unpaidBalances: 0,
  pendingPayouts: 0,
  activeSubscription: false,
  openSupplierOrders: 0,
  openStoreOrders: 0,
  studioMembersLeftBehind: 0,
};
const person = (role: string) => ({
  id: "u1",
  clerkId: "clerk_1",
  name: "Ada Ink",
  email: "ada@example.com",
  loginMethod: "google",
  role,
  phone: "0400000000",
  avatar: "/files/ada.jpg",
  bio: "Fine line",
  instagramId: "ig1",
  instagramUsername: "ada.ink",
  facebookId: "fb1",
  facebookName: "Ada",
  hasCompletedOnboarding: 1,
  password: "hash",
  birthday: "1990-01-01 00:00:00",
  address: "1 Needle St",
  city: "Brisbane",
  country: "AU",
  gender: "female",
  savedSignature: "data:image/png;base64,AAAA",
  googleSub: "google_1",
});
const controlled = {
  stripeConnectAccountId: "acct_1",
  stripeConnectAccountType: "express",
};
const dialect = new MySqlDialect();
const columnSql = (column: any) => dialect.sqlToQuery(sql`${column}`).sql;
/** Every write issued against a table, with the predicate as SQL. */
const writesTo = (table: unknown) =>
  fixture.writes.filter(w => w.table === table);
const tables = (op: "delete" | "update") =>
  new Set(fixture.writes.filter(w => w.op === op).map(w => w.table));

beforeEach(() => {
  vi.resetAllMocks();
  fixture.user = person("client");
  fixture.settings = undefined;
  fixture.counts = new Map();
  fixture.rows = new Map();
  fixture.writes = [];
  fixture.counted = [];
  fixture.transactions = 0;
});

describe("deletionBlockers", () => {
  it("lets a settled account go", () => {
    expect(deletionBlockers(clear)).toEqual([]);
  });
  it.each([
    ["upcomingConfirmedSittings", 2],
    ["pendingBookingRequests", 1],
    ["unpaidBalances", 1],
    ["pendingPayouts", 1],
    ["activeSubscription", true],
    ["openSupplierOrders", 1],
    ["openStoreOrders", 3],
    ["studioMembersLeftBehind", 1],
  ] as const)("blocks on %s with a readable reason", (code, value) => {
    const blockers = deletionBlockers({ ...clear, [code]: value });
    expect(blockers.map(b => b.code)).toEqual([code]);
    expect(blockers[0].reason).toMatch(/^You|^Your/);
    expect(blockers[0].reason.length).toBeGreaterThan(30);
  });
  it("reports every blocker at once", () => {
    expect(
      deletionBlockers({
        ...clear,
        role: "artist",
        upcomingConfirmedSittings: 1,
        pendingPayouts: 1,
        activeSubscription: true,
      })
    ).toHaveLength(3);
  });
});

describe("every table that points at a user has a decision", () => {
  it("covers each foreign key to users and each known loose reference", () => {
    const decided = new Set<unknown>([
      ...KEPT_TABLES,
      ...SCRUBBED_TABLES,
      ...DELETED_TABLES,
    ]);
    // Tables holding a user id without a foreign key; the schema cannot find these for us.
    const loose: unknown[] = [
      schema.procedureLogs,
      schema.waitlistEntries,
      schema.offerCampaigns,
      schema.clientOffers,
      schema.offerBalanceCheckouts,
      schema.offerCreditRestorations,
      schema.offerPreferences,
      schema.offerDeliveries,
      schema.offerSmsChallenges,
      schema.rescheduleRequests,
    ];
    const undecided = Object.entries(schema)
      .filter(([, table]) => is(table, MySqlTable))
      .filter(
        ([, table]) =>
          loose.includes(table) ||
          getTableConfig(table as MySqlTable).foreignKeys.some(
            key => key.reference().foreignTable === schema.users
          )
      )
      .filter(([, table]) => !decided.has(table))
      .map(([name]) => name);
    expect(undecided).toEqual([]);
  });
  it("puts no table in two lists", () => {
    const all = [...KEPT_TABLES, ...SCRUBBED_TABLES, ...DELETED_TABLES];
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("deleteAccount", () => {
  it("keeps the other party's records and never deletes the users row", async () => {
    fixture.user = person("artist");
    fixture.rows.set(schema.portfolios, [{ id: 5 }]);
    fixture.rows.set(schema.leads, [{ id: 9 }]);
    await deleteAccount("u1");

    expect(fixture.transactions).toBe(1);
    const deleted = tables("delete");
    const updated = tables("update");
    for (const table of [
      schema.users,
      schema.appointments,
      schema.consentForms,
      schema.paymentLedger,
      schema.paymentRequests,
      schema.sessionPlans,
      schema.sessionPlanItems,
      schema.conversations,
      schema.messages,
    ])
      expect(deleted.has(table), getTableConfig(table).name).toBe(false);
    for (const table of KEPT_TABLES) {
      expect(deleted.has(table), getTableConfig(table).name).toBe(false);
      expect(updated.has(table), getTableConfig(table).name).toBe(false);
    }
    for (const table of SCRUBBED_TABLES)
      expect(deleted.has(table), getTableConfig(table).name).toBe(false);
    // Nothing outside the declared lists is touched.
    for (const table of deleted)
      expect(
        [
          ...DELETED_TABLES,
          schema.moodboardItems,
          schema.portfolioClassifications,
        ].includes(table as MySqlTable)
      ).toBe(true);
  });

  it("removes what is the person's own and takes an artist off discovery", async () => {
    fixture.user = person("artist");
    await deleteAccount("u1");
    const deleted = tables("delete");
    for (const table of [
      schema.pushSubscriptions,
      schema.favouriteArtists,
      schema.notificationSettings,
      schema.savedDays,
      schema.artistPublicProfile,
      schema.portfolios,
    ])
      expect(deleted.has(table), getTableConfig(table).name).toBe(true);
    const settings = fixture.writes.find(
      w => w.table === schema.artistSettings
    )!.set;
    expect(settings).toMatchObject({
      publicSlug: null,
      funnelEnabled: 0,
      bsb: null,
      accountNumber: null,
      businessAddress: null,
      businessEmail: null,
      googleCalendarToken: null,
    });
    // Needed to refund or answer a dispute on a kept payment.
    expect(settings).not.toHaveProperty("stripeConnectAccountId");
  });

  it("strips every personal and sign-in field from the users row", async () => {
    const before = person("client");
    await deleteAccount("u1");
    expect(fixture.user).toMatchObject({
      id: "u1",
      name: "Deleted user",
      email: "deleted-u1@deleted.invalid",
      role: "disabled_client",
    });
    const untouched = ["id", "name", "email", "role", "hasCompletedOnboarding"];
    for (const column of Object.keys(before))
      if (!untouched.includes(column))
        expect(fixture.user[column], column).toBeNull();
    // A column added to users later must be decided here too.
    const known = [...Object.keys(before), "createdAt", "lastSignedIn"];
    expect(
      Object.keys(schema.users).filter(column => !known.includes(column))
    ).toEqual([]);
  });

  it("rejects sign-in and existing sessions afterwards", async () => {
    const token = generateToken({ id: "u1", email: "ada@example.com" });
    const request = { headers: { authorization: `Bearer ${token}` } } as any;
    expect(await sdk.authenticateRequest(request)).toMatchObject({ id: "u1" });

    await deleteAccount("u1");

    expect(await sdk.authenticateRequest(request)).toBeNull();
    expect(accountEnabled(fixture.user)).toBe(false);
    expect(fixture.user.password).toBeNull();
    expect(fixture.user.email).not.toBe("ada@example.com");
  });

  it("refuses with every reason and changes nothing when something is open", async () => {
    fixture.user = person("artist");
    fixture.counts.set(schema.appointments, [2, 0]);
    fixture.counts.set(schema.paymentRequests, [1]);
    await expect(deleteAccount("u1")).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringMatching(
        /cannot be deleted yet:\n• You have 2 confirmed sittings.*\n• You have 1 payment still outstanding/
      ),
    });
    expect(fixture.writes).toEqual([]);
    expect(fixture.user).toEqual(person("artist"));
  });

  it("keeps the billing guard and passes its own message on", async () => {
    fixture.billing.mockRejectedValue(
      new TRPCError({
        code: "CONFLICT",
        message: "Your studio checkout needs to finish.",
      })
    );
    await expect(deleteAccount("u1")).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("Your studio checkout needs to finish."),
    });
    expect(fixture.writes).toEqual([]);
  });

  it("fails closed, readably, when Stripe cannot be reached", async () => {
    fixture.billing.mockRejectedValue(new Error("socket hang up"));
    await expect(deleteAccount("u1")).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      message: expect.stringMatching(
        /could not check your subscription.*Try again/
      ),
    });
    expect(fixture.transactions).toBe(0);
  });

  it("fails closed, readably, when the payout balance cannot be read", async () => {
    fixture.user = person("artist");
    fixture.settings = controlled;
    fixture.balance.mockRejectedValue(
      Object.assign(new Error("socket hang up"), {
        type: "StripeConnectionError",
      })
    );
    await expect(deleteAccount("u1")).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      message: expect.stringMatching(/could not check your payouts.*Try again/),
    });
    expect(fixture.transactions).toBe(0);
    expect(fixture.user).toEqual(person("artist"));
  });

  it.each([
    { type: "StripePermissionError", code: "account_invalid" },
    { type: "StripeInvalidRequestError", code: "resource_missing" },
  ])(
    "is not blocked for good by a Stripe account that is gone ($code)",
    async stripeError => {
      fixture.user = person("artist");
      fixture.settings = controlled;
      fixture.balance.mockRejectedValue(
        Object.assign(new Error("No such account"), stripeError)
      );
      await deleteAccount("u1");
      expect(fixture.user.role).toBe("disabled_artist");
    }
  );

  it("waits for money Stripe still holds on an account Tattoi controls", async () => {
    fixture.user = person("artist");
    fixture.settings = controlled;
    fixture.balance.mockResolvedValue({
      pending: [{ amount: 5000 }],
      available: [{ amount: 0 }],
    });
    await expect(deleteAccount("u1")).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("not been paid out"),
    });
  });

  // The fake database does not filter rows, so the predicates themselves are held to account:
  // each is rendered to the SQL drizzle would send and checked for the column and value it binds.
  describe("predicates", () => {
    const u = "u1";
    const col = columnSql;

    it("every write is limited to the person being deleted", async () => {
      fixture.user = person("artist");
      fixture.rows.set(schema.portfolios, [{ id: 5 }]);
      fixture.rows.set(schema.leads, [{ id: 9 }]);
      fixture.rows.set(schema.moodboards, [{ id: 7 }]);
      await deleteAccount(u);
      expect(fixture.writes.length).toBeGreaterThan(30);
      // Child rows reached through a parent the person owns are bound to that parent's id instead.
      const byParent = new Map<unknown, number>([
        [schema.moodboardItems, 7],
        [schema.portfolioClassifications, 5],
      ]);
      for (const write of fixture.writes) {
        const name = getTableConfig(write.table as MySqlTable).name;
        expect(write.where.sql, name).not.toBe("");
        const { params } = write.where;
        if (byParent.has(write.table))
          expect(params, name).toEqual([byParent.get(write.table)]);
        else if (params.includes(u) || params.includes(`client:${u}`))
          expect(
            params.every(p => p === u || p === `client:${u}`),
            name
          ).toBe(true);
        else expect([[5], [9]], name).toContainEqual(params);
      }
    });

    it("scrubs only this person's users row", async () => {
      await deleteAccount(u);
      expect(writesTo(schema.users).map(w => w.where)).toEqual([
        { sql: `${col(schema.users.id)} = ?`, params: [u] },
      ]);
    });

    it("scrubs only this artist's settings row", async () => {
      fixture.user = person("artist");
      await deleteAccount(u);
      expect(writesTo(schema.artistSettings).map(w => w.where)).toEqual([
        { sql: `${col(schema.artistSettings.userId)} = ?`, params: [u] },
      ]);
    });

    it("scrubs leads about the person held by others and deletes only the person's own", async () => {
      fixture.user = person("artist");
      fixture.rows.set(schema.leads, [{ id: 9 }]);
      await deleteAccount(u);
      const [scrub, remove] = writesTo(schema.leads);
      expect(scrub).toMatchObject({
        op: "update",
        set: { clientName: "Deleted user", clientPhone: null },
        where: {
          sql: `(${col(schema.leads.clientId)} = ? and ${col(schema.leads.artistId)} <> ?)`,
          params: [u, u],
        },
      });
      expect(remove).toMatchObject({
        op: "delete",
        where: { sql: `${col(schema.leads.artistId)} = ?`, params: [u] },
      });
      expect(writesTo(schema.leads)).toHaveLength(2);
      // Activity on the person's own leads goes with them; elsewhere only the reference is nulled.
      expect(writesTo(schema.leadActivityLog)).toMatchObject([
        { op: "delete", where: { params: [9] } },
        {
          op: "update",
          set: { performedBy: null },
          where: {
            sql: `${col(schema.leadActivityLog.performedBy)} = ?`,
            params: [u],
          },
        },
      ]);
    });

    it("removes cached tasks that copy the person's name into another artist's list", async () => {
      await deleteAccount(u);
      expect(writesTo(schema.activeTasks)).toMatchObject([
        {
          op: "delete",
          where: {
            sql: `(${col(schema.activeTasks.artistId)} = ? or ${col(schema.activeTasks.clientId)} = ?)`,
            params: [u, u],
          },
        },
      ]);
    });

    it("leaves the artist's procedure log as it is", async () => {
      await deleteAccount(u);
      expect(writesTo(schema.procedureLogs)).toEqual([]);
      expect(KEPT_TABLES).toContain(schema.procedureLogs);
    });

    it("counts blockers on both sides of a booking and only for this person", async () => {
      await deleteAccount(u);
      const sittings = fixture.counted.filter(
        c => c.table === schema.appointments
      );
      expect(sittings.map(c => c.where.params.slice(0, 3))).toEqual([
        [u, u, "confirmed"],
        [u, u, "pending"],
      ]);
      for (const { where } of sittings) {
        expect(where.sql).toContain(
          `(${col(schema.appointments.artistId)} = ? or ${col(schema.appointments.clientId)} = ?)`
        );
        expect(where.sql).toContain(`${col(schema.appointments.endTime)} > ?`);
      }
      for (const { table, where } of fixture.counted)
        expect(
          where.params,
          getTableConfig(table as MySqlTable).name
        ).toContain(u);
    });
  });

  it("will not run twice on the same account", async () => {
    await deleteAccount("u1");
    await expect(deleteAccount("u1")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
