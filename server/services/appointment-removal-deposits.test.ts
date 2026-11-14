// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";

const m = vi.hoisted(() => ({ db: null as any }));
vi.mock("./core", () => ({
  getDb: async () => m.db,
  withDatabaseTransaction: async (work: (db: any) => unknown) => work(m.db),
}));
vi.mock("./offerAvailability", () => ({ offersEnabled: () => false }));

import {
  artistWipeBlockers,
  deleteAllAppointmentsForArtist,
  deleteAllClientsForArtist,
  deleteAppointmentsForClient,
} from "./appointmentService";

const dialect = new MySqlDialect();
type Deleted = { table: string; sql: string; params: unknown[] };

/** A database that answers every select on a table with that table's rows and records deletes. */
function fakeDb(rows: Record<string, any[]>) {
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
        deleted.push({
          table: getTableName(table),
          ...dialect.sqlToQuery(condition),
        });
      },
    }),
    query: { clientOffers: { findFirst: async () => undefined } },
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
const plan = (over: Record<string, unknown> = {}) => ({
  clientId: "user_real",
  conversationId: 10,
  status: "pending",
  stripeSessionId: null,
  ...over,
});
const lead = (over: Record<string, unknown> = {}) => ({
  id: 7,
  clientId: "user_real",
  conversationId: 10,
  status: "contacted",
  stripeCheckoutSessionId: null,
  depositClaimedAt: null,
  depositVerifiedAt: null,
  depositProof: null,
  ...over,
});
const from = (deleted: Deleted[], table: string) =>
  deleted.filter(d => d.table === table);
const thread = [{ id: 10, clientId: "user_real" }];

describe("deleteAppointmentsForClient", () => {
  it.each([
    ["pending", { status: "pending", endTime: future }],
    ["confirmed", { status: "confirmed", endTime: future }],
  ])(
    "keeps an upcoming %s sitting and the client",
    async (_label, upcoming) => {
      const deleted = fakeDb({
        appointments: [appointment(1), appointment(2, upcoming)],
      });
      const result = await deleteAppointmentsForClient(
        "artist",
        "user_real",
        true
      );
      expect(result).toMatchObject({
        deletedAppointments: 1,
        keptAppointments: 1,
        upcomingSittings: 1,
        clientRemoved: false,
      });
      expect(deleted).toHaveLength(1);
      expect(deleted[0]).toMatchObject({ table: "appointments", params: [1] });
    }
  );

  it("still deletes an unpaid sitting that is over or cancelled", async () => {
    const deleted = fakeDb({
      appointments: [
        appointment(1, { status: "pending", endTime: past }),
        appointment(2, { status: "cancelled", endTime: future }),
      ],
    });
    const result = await deleteAppointmentsForClient("artist", "user_real");
    expect(result).toMatchObject({
      deletedAppointments: 2,
      upcomingSittings: 0,
    });
    expect(deleted[0].params).toEqual([1, 2]);
  });

  it.each([
    ["checkout has started on", plan({ stripeSessionId: "pi_1" })],
    ["the client paid for", plan({ status: "accepted" })],
    ["the artist refunded", plan({ status: "refunded" })],
  ])(
    "keeps the conversation of a session plan %s",
    async (_label, sessionPlan) => {
      const deleted = fakeDb({ sessionPlans: [sessionPlan] });
      const result = await deleteAppointmentsForClient(
        "artist",
        "user_real",
        true
      );
      expect(result).toMatchObject({
        clientRemoved: false,
        depositOnRecord: true,
      });
      expect(deleted).toHaveLength(0);
    }
  );

  it("removes a client whose only plan was never opened for payment", async () => {
    const deleted = fakeDb({ sessionPlans: [plan({ status: "declined" })] });
    const result = await deleteAppointmentsForClient(
      "artist",
      "user_real",
      true
    );
    expect(result).toMatchObject({
      clientRemoved: true,
      depositOnRecord: false,
    });
    expect(from(deleted, "conversations")).toHaveLength(1);
  });

  it.each([
    ["was asked for a deposit", { status: "deposit_requested" }],
    ["says they paid", { status: "deposit_pending" }],
    ["has a verified deposit", { status: "deposit_verified" }],
    ["has started checkout", { stripeCheckoutSessionId: "pi_2" }],
    ["claimed a deposit", { depositClaimedAt: past }],
    ["sent proof of a deposit", { depositProof: "https://x/proof.png" }],
  ])(
    "keeps the lead, the conversation and the pending sittings of a client who %s",
    async (_label, state) => {
      const deleted = fakeDb({
        appointments: [
          appointment(1, { status: "pending", endTime: past }),
          appointment(2),
        ],
        leads: [lead(state)],
      });
      const result = await deleteAppointmentsForClient(
        "artist",
        "user_real",
        true
      );
      expect(result).toMatchObject({
        deletedAppointments: 1,
        keptAppointments: 1,
        clientRemoved: false,
        depositOnRecord: true,
      });
      // The pending sitting is what the deposit confirms when it lands.
      expect(deleted).toHaveLength(1);
      expect(deleted[0]).toMatchObject({ table: "appointments", params: [2] });
    }
  );

  it("deletes a lead with no deposit history along with the client", async () => {
    const deleted = fakeDb({ leads: [lead()] });
    const result = await deleteAppointmentsForClient(
      "artist",
      "user_real",
      true
    );
    expect(result.clientRemoved).toBe(true);
    expect(from(deleted, "leads")).toHaveLength(1);
  });
});

describe("artistWipeBlockers", () => {
  it("names deposits in progress", () => {
    const [reason] = artistWipeBlockers({
      upcomingSittings: 0,
      paidBookings: 0,
      openPaymentRequests: 0,
      openDeposits: 2,
    });
    expect(reason).toContain("2 deposits");
  });
});

describe.each([
  ["deleteAllAppointmentsForArtist", deleteAllAppointmentsForArtist],
  ["deleteAllClientsForArtist", deleteAllClientsForArtist],
] as const)("%s", (_name, wipe) => {
  it.each([
    [
      "a pending session plan with checkout started",
      { sessionPlans: [plan({ stripeSessionId: "pi_1" })] },
    ],
    [
      "a lead that was asked for a deposit",
      { leads: [lead({ status: "deposit_requested" })] },
    ],
    [
      "a lead with an unsettled checkout",
      { leads: [lead({ stripeCheckoutSessionId: "pi_2" })] },
    ],
  ])("refuses and deletes nothing with %s", async (_label, rows) => {
    const deleted = fakeDb({
      appointments: [appointment(1)],
      conversations: thread,
      ...rows,
    });
    await expect(wipe("artist")).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("1 deposit "),
    });
    expect(deleted).toHaveLength(0);
  });

  it("keeps the pending sittings of a client with a settled deposit", async () => {
    const deleted = fakeDb({
      appointments: [
        appointment(1, { status: "pending" }),
        appointment(2, { conversationId: 20, clientId: "user_other" }),
      ],
      leads: [lead({ status: "deposit_verified", depositVerifiedAt: past })],
      conversations: thread,
    });
    const result = await wipe("artist");
    expect(result).toMatchObject({
      deletedAppointments: 1,
      keptAppointments: 1,
    });
    expect(from(deleted, "appointments")[0].params).toEqual([2]);
  });
});

describe("deleteAllClientsForArtist", () => {
  it.each([
    [
      "an accepted session plan",
      { sessionPlans: [plan({ status: "accepted" })] },
    ],
    [
      "a refunded session plan",
      { sessionPlans: [plan({ status: "refunded", stripeSessionId: "pi_1" })] },
    ],
    [
      "a deposit that settled for review",
      {
        leads: [
          lead({
            status: "scheduled",
            stripeCheckoutSessionId: "pi_2",
            depositClaimedAt: past,
            depositVerifiedAt: past,
          }),
        ],
      },
    ],
    [
      "a deposit lead that only names the conversation",
      {
        leads: [
          lead({
            clientId: null,
            status: "deposit_verified",
            depositVerifiedAt: past,
          }),
        ],
      },
    ],
  ])("keeps the client and conversation holding %s", async (_label, rows) => {
    const deleted = fakeDb({
      conversations: [...thread, { id: 20, clientId: "user_other" }],
      ...rows,
    });
    const result = await deleteAllClientsForArtist("artist");
    expect(result).toMatchObject({ removedClients: 1, keptClients: 1 });
    expect(from(deleted, "conversations")[0].params).toEqual([20]);
    expect(from(deleted, "leads")[0].params).toEqual(["artist", "user_other"]);
    expect(from(deleted, "client_notes")[0].params).toEqual([
      "artist",
      "user_other",
    ]);
  });

  it("keeps the notes and leads of a client who still has another conversation", async () => {
    const deleted = fakeDb({
      conversations: [...thread, { id: 11, clientId: "user_real" }],
      sessionPlans: [plan({ clientId: "someone_else", status: "accepted" })],
    });
    const result = await deleteAllClientsForArtist("artist");
    expect(result).toMatchObject({ removedClients: 1, keptClients: 1 });
    expect(from(deleted, "conversations")[0].params).toEqual([11]);
    expect(from(deleted, "leads")).toHaveLength(0);
    expect(from(deleted, "client_notes")).toHaveLength(0);
  });
});
