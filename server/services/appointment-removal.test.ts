// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";

const m = vi.hoisted(() => ({
  db: null as any,
  offers: false,
}));
vi.mock("./core", () => ({
  getDb: async () => m.db,
  withDatabaseTransaction: async (work: (db: any) => unknown) => work(m.db),
}));
vi.mock("./offerAvailability", () => ({ offersEnabled: () => m.offers }));

import {
  appointmentIsPaid,
  artistWipeBlockers,
  deleteAllAppointmentsForArtist,
  deleteAllClientsForArtist,
  deleteAppointmentsForClient,
} from "./appointmentService";

const dialect = new MySqlDialect();
type Deleted = { table: string; sql: string; params: unknown[] };

/** A database that answers every select on a table with that table's rows and records deletes. */
function fakeDb(rows: Record<string, any[]>, credit?: unknown) {
  const deleted: Deleted[] = [];
  const select = () => ({
    from: (table: any) => ({
      where: async () => rows[getTableName(table)] ?? [],
    }),
  });
  m.db = {
    select,
    selectDistinct: select,
    delete: (table: any) => ({
      where: async (condition: any) => {
        const query = dialect.sqlToQuery(condition);
        deleted.push({ table: getTableName(table), ...query });
      },
    }),
    query: { clientOffers: { findFirst: async () => credit } },
  };
  return deleted;
}

const past = "2020-01-01 10:00:00";
const future = "2999-01-01 10:00:00";
const appointment = (id: number, over: Record<string, unknown> = {}) => ({
  id,
  conversationId: 10,
  clientId: "user_real",
  status: "completed",
  endTime: past,
  depositPaymentId: null,
  balancePaymentId: null,
  depositPaid: 0,
  clientPaid: 0,
  amountPaid: null,
  totalPaidAmountCents: 0,
  paymentStatus: "pending_deposit",
  ...over,
});
const tables = (deleted: Deleted[]) => deleted.map(d => d.table);
const deletedFrom = (deleted: Deleted[], table: string) =>
  deleted.filter(d => d.table === table);

beforeEach(() => {
  m.offers = false;
});

describe("appointmentIsPaid", () => {
  it.each([
    [{ depositPaymentId: "pi_1" }],
    [{ balancePaymentId: "pi_2" }],
    [{ depositPaid: 1 }],
    [{ clientPaid: 1 }],
    [{ amountPaid: 50 }],
    [{ totalPaidAmountCents: 5000 }],
    [{ paymentStatus: "deposit_paid" }],
    [{ paymentStatus: "refunded" }],
  ])("treats %o as paid", over => {
    expect(appointmentIsPaid(appointment(1, over))).toBe(true);
  });

  it("treats a sitting with no payment as unpaid", () => {
    expect(appointmentIsPaid(appointment(1))).toBe(false);
  });
});

describe("deleteAppointmentsForClient", () => {
  it("never deletes a users row for a real account", async () => {
    const deleted = fakeDb({ appointments: [appointment(1)] });
    const result = await deleteAppointmentsForClient(
      "artist",
      "user_real",
      true
    );
    expect(result).toMatchObject({
      deletedAppointments: 1,
      keptAppointments: 0,
      clientRemoved: true,
    });
    expect(tables(deleted)).toEqual([
      "appointments",
      "conversations",
      "client_notes",
      "leads",
    ]);
    // Every delete is limited to this artist's side of the relationship.
    for (const d of deleted.slice(1))
      expect(d.params).toEqual(["artist", "user_real"]);
  });

  it("keeps paid bookings, open payment requests and signed forms, and the conversation holding them", async () => {
    const deleted = fakeDb({
      appointments: [
        appointment(1),
        appointment(2, { depositPaymentId: "pi_1" }),
        appointment(3),
        appointment(4),
        appointment(5),
        appointment(6),
      ],
      payment_ledger: [{ id: 3 }],
      payment_requests: [
        { id: 4, status: "pending", expiresAt: null },
        { id: 1, status: "pending", expiresAt: past },
      ],
      consent_forms: [{ id: 5 }],
      procedure_logs: [{ id: 6 }],
    });
    const result = await deleteAppointmentsForClient(
      "artist",
      "user_real",
      true
    );
    expect(result).toMatchObject({
      deletedAppointments: 1,
      keptAppointments: 5,
      clientRemoved: false,
    });
    // Only the unpaid sitting whose payment request has expired goes.
    expect(deleted).toHaveLength(1);
    expect(deleted[0].table).toBe("appointments");
    expect(deleted[0].params).toEqual([1]);
  });

  it("deletes only unpaid bookings when the client is not being removed", async () => {
    const deleted = fakeDb({
      appointments: [appointment(1), appointment(2, { clientPaid: 1 })],
    });
    const result = await deleteAppointmentsForClient("artist", "user_real");
    expect(result).toMatchObject({
      deletedAppointments: 1,
      keptAppointments: 1,
      clientRemoved: false,
    });
    expect(tables(deleted)).toEqual(["appointments"]);
    expect(deleted[0].params).toEqual([1]);
  });

  it("removes a record the artist made once nobody holds anything for it", async () => {
    const deleted = fakeDb({ users: [{ id: "client_123_abc" }] });
    const result = await deleteAppointmentsForClient(
      "artist",
      "client_123_abc",
      true
    );
    expect(result.clientRemoved).toBe(true);
    const [users] = deletedFrom(deleted, "users");
    expect(users.params).toEqual(["client_123_abc", "client"]);
    // Still guarded in the delete itself against an account someone has signed in to.
    expect(users.sql).toMatch(/`password` is null/);
    expect(users.sql).toMatch(/`clerkId` is null/);
  });

  it.each(["consent_forms", "payment_ledger", "conversations", "leads"])(
    "keeps a record the artist made while %s still has rows for it",
    async table => {
      const deleted = fakeDb({
        users: [{ id: "usr_imp_1" }],
        [table]: [{ clientId: "usr_imp_1" }],
      });
      await deleteAppointmentsForClient("artist", "usr_imp_1", true);
      expect(deletedFrom(deleted, "users")).toHaveLength(0);
    }
  );

  it("keeps a record the artist made once someone has signed in to it", async () => {
    // The users lookup only returns never-signed-in client rows; a claimed one is not returned.
    const deleted = fakeDb({ users: [] });
    await deleteAppointmentsForClient("artist", "client_123_abc", true);
    expect(deletedFrom(deleted, "users")).toHaveLength(0);
  });

  it("deletes nothing for a client with voucher or promotion history", async () => {
    m.offers = true;
    const deleted = fakeDb({ appointments: [appointment(1)] }, { id: 1 });
    await expect(
      deleteAppointmentsForClient("artist", "user_real", true)
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(deleted).toHaveLength(0);
  });
});

describe("artistWipeBlockers", () => {
  it("has nothing to say when nothing is in the way", () => {
    expect(
      artistWipeBlockers({
        upcomingSittings: 0,
        paidBookings: 0,
        openPaymentRequests: 0,
      })
    ).toEqual([]);
  });

  it("names each thing in the way in plain words", () => {
    const reasons = artistWipeBlockers({
      upcomingSittings: 2,
      paidBookings: 1,
      openPaymentRequests: 1,
    });
    expect(reasons).toHaveLength(3);
    expect(reasons[0]).toContain("2 upcoming sittings");
    expect(reasons[1]).toContain("1 payment request ");
    expect(reasons[2]).toContain("1 paid booking.");
  });
});

describe.each([
  ["deleteAllAppointmentsForArtist", deleteAllAppointmentsForArtist],
  ["deleteAllClientsForArtist", deleteAllClientsForArtist],
] as const)("%s", (_name, wipe) => {
  it.each([
    [
      "an upcoming pending sitting",
      {
        appointments: [appointment(1, { status: "pending", endTime: future })],
      },
      "upcoming sitting",
    ],
    [
      "an upcoming confirmed sitting",
      {
        appointments: [
          appointment(1, { status: "confirmed", endTime: future }),
        ],
      },
      "upcoming sitting",
    ],
    [
      "a paid booking",
      { appointments: [appointment(1, { balancePaymentId: "pi_9" })] },
      "paid booking",
    ],
    [
      "a booking with payment ledger rows",
      { appointments: [appointment(1)], payment_ledger: [{ id: 1 }] },
      "paid booking",
    ],
    [
      "an open payment request",
      {
        appointments: [appointment(1)],
        payment_requests: [{ id: 1, status: "pending", expiresAt: future }],
      },
      "payment request",
    ],
  ])("refuses and deletes nothing with %s", async (_label, rows, reason) => {
    const deleted = fakeDb(rows);
    await expect(wipe("artist")).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining(reason),
    });
    expect(deleted).toHaveLength(0);
  });

  it("keeps sittings with signed forms and never deletes real accounts", async () => {
    const deleted = fakeDb({
      appointments: [
        appointment(1),
        appointment(2, { conversationId: 20, clientId: "user_signed" }),
        appointment(3, { status: "cancelled", endTime: future }),
      ],
      consent_forms: [{ id: 2 }],
      conversations: [
        { id: 10, clientId: "user_real" },
        { id: 20, clientId: "user_signed" },
      ],
    });
    const result = await wipe("artist");
    expect(result).toMatchObject({
      deletedAppointments: 2,
      keptAppointments: 1,
    });
    expect(deletedFrom(deleted, "appointments")[0].params).toEqual([1, 3]);
    expect(deletedFrom(deleted, "users")).toHaveLength(0);
    expect(deletedFrom(deleted, "payment_requests")).toHaveLength(0);
    expect(deletedFrom(deleted, "consent_forms")).toHaveLength(0);
  });
});

describe("deleteAllClientsForArtist", () => {
  it("keeps the conversation of a client whose sitting has a signed form", async () => {
    const deleted = fakeDb({
      appointments: [
        appointment(1),
        appointment(2, { conversationId: 20, clientId: "user_signed" }),
      ],
      consent_forms: [{ id: 2 }],
      conversations: [
        { id: 10, clientId: "user_real" },
        { id: 20, clientId: "user_signed" },
      ],
    });
    const result = await deleteAllClientsForArtist("artist");
    expect(result).toMatchObject({ removedClients: 1, keptClients: 1 });
    expect(deletedFrom(deleted, "conversations")[0].params).toEqual([10]);
    expect(deletedFrom(deleted, "client_notes")[0].params).toEqual([
      "artist",
      "user_real",
    ]);
  });

  it("keeps clients with voucher or promotion history", async () => {
    m.offers = true;
    const deleted = fakeDb({
      conversations: [{ id: 10, clientId: "user_real" }],
      client_offers: [{ clientId: "user_real" }],
    });
    const result = await deleteAllClientsForArtist("artist");
    expect(result).toMatchObject({ removedClients: 0, keptClients: 1 });
    expect(deletedFrom(deleted, "conversations")).toHaveLength(0);
  });
});

describe("deleteAllAppointmentsForArtist", () => {
  it("leaves conversations alone", async () => {
    const deleted = fakeDb({
      appointments: [appointment(1)],
      conversations: [{ id: 10, clientId: "user_real" }],
    });
    await deleteAllAppointmentsForArtist("artist");
    expect(tables(deleted)).toEqual(["appointments"]);
  });
});
