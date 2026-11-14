// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import * as schema from "../../drizzle/schema";
const forms = vi.hoisted(() => vi.fn());
vi.mock("./appointmentService", () => ({ generateRequiredForms: forms }));
import {
  checkoutSittingKey,
  decideDepositConfirmation,
  depositLeadUpdate,
  depositLedgerMetadata,
  formatCheckoutSittingIds,
  paidDepositCents,
  parseCheckoutSittingIds,
  settleDepositPayment,
  type DepositDecisionInput,
  type DepositSitting,
} from "./proposalConfirmation";

const conversation = { id: 9, artistId: "artist", clientId: "client" };
const sitting = (
  id: number,
  over: Partial<DepositSitting> = {}
): DepositSitting => ({
  id,
  conversationId: 9,
  artistId: "artist",
  clientId: "client",
  status: "pending",
  depositAmount: 100,
  createdAtUnix: 1_000,
  ...over,
});
const proposal = (meta: Record<string, unknown>, over = {}) => ({
  id: 43,
  conversationId: 9,
  senderId: "artist",
  messageType: "appointment_request",
  metadata: JSON.stringify(meta),
  ...over,
});
const decide = (over: Partial<DepositDecisionInput>) =>
  decideDepositConfirmation({
    lead: { artistId: "artist" },
    conversation,
    messageId: 43,
    message: proposal({ status: "pending", appointmentIds: [1, 2] }),
    sittings: [sitting(1), sitting(2)],
    paidCents: 20000,
    checkoutSittingIds: null,
    checkoutCreatedAtUnix: 5_000,
    ...over,
  });

describe("decideDepositConfirmation — paid proposal", () => {
  it("confirms only the paid proposal's sittings, not other pending ones", () => {
    expect(
      decide({ sittings: [sitting(1), sitting(2), sitting(3), sitting(4)] })
    ).toEqual({
      action: "confirm",
      basis: "proposal",
      appointmentIds: [1, 2],
      confirmMessageId: 43,
      dueCents: 20000,
    });
  });

  it("ignores listed sittings of another artist, client or conversation", () => {
    const result = decide({
      message: proposal({ status: "pending", appointmentIds: [1, 5, 6, 7] }),
      sittings: [
        sitting(1),
        sitting(5, { artistId: "other" }),
        sitting(6, { clientId: "someone" }),
        sitting(7, { conversationId: 10 }),
      ],
    });
    expect(result).toMatchObject({ action: "confirm", appointmentIds: [1] });
  });

  it("accepts ids stored as strings and a single appointmentId", () => {
    expect(
      decide({
        message: proposal({ status: "accepted", appointmentIds: ["1", "2"] }),
      })
    ).toMatchObject({ action: "confirm", appointmentIds: [1, 2] });
    expect(
      decide({ message: proposal({ status: "pending", appointmentId: 2 }) })
    ).toMatchObject({
      action: "confirm",
      appointmentIds: [2],
      dueCents: 10000,
    });
  });

  it("holds a short payment for review", () => {
    expect(decide({ paidCents: 19999 })).toEqual({
      action: "review",
      reason: "amount_short",
      appointmentIds: [1, 2],
      dueCents: 20000,
    });
  });

  it("uses the artist's stated deposit when it is higher than the sittings' sum", () => {
    const message = proposal({
      status: "pending",
      appointmentIds: [1, 2],
      depositAmount: 250,
    });
    expect(decide({ message, paidCents: 20000 })).toMatchObject({
      action: "review",
      reason: "amount_short",
      dueCents: 25000,
    });
    expect(decide({ message, paidCents: 25000 })).toMatchObject({
      action: "confirm",
    });
  });

  it("rejects a message that is not the artist's proposal in this chat", () => {
    for (const message of [
      null,
      proposal({}, { conversationId: 10 }),
      proposal({}, { senderId: "client" }),
      proposal({}, { messageType: "text" }),
      proposal({}, { id: 44 }),
    ])
      expect(decide({ message })).toMatchObject({
        action: "review",
        reason: "message_not_in_booking",
        appointmentIds: [],
      });
  });

  it("does not revive a declined or revoked proposal", () => {
    for (const status of ["declined", "revoked", "cancelled", ""])
      expect(
        decide({ message: proposal({ status, appointmentIds: [1, 2] }) })
      ).toMatchObject({ action: "review", reason: "proposal_not_payable" });
  });

  it("reviews when none of the proposal's sittings is still pending", () => {
    expect(
      decide({
        sittings: [
          sitting(1, { status: "cancelled" }),
          sitting(2, { status: "confirmed" }),
          sitting(3),
        ],
      })
    ).toMatchObject({ action: "review", reason: "no_matching_sittings" });
    expect(decide({ sittings: [sitting(3)] })).toMatchObject({
      action: "review",
      reason: "no_matching_sittings",
    });
  });

  it("leaves cancelled sittings out of what is due and confirmed", () => {
    expect(
      decide({
        sittings: [sitting(1, { status: "cancelled" }), sitting(2)],
        paidCents: 10000,
      })
    ).toMatchObject({
      action: "confirm",
      appointmentIds: [2],
      dueCents: 10000,
    });
  });

  it("charges only the moved sitting of an already confirmed proposal", () => {
    expect(
      decide({
        message: proposal({
          status: "confirmed",
          appointmentIds: [1, 2],
          depositAmount: 200,
        }),
        sittings: [sitting(1, { status: "confirmed" }), sitting(2), sitting(3)],
        paidCents: 10000,
      })
    ).toEqual({
      action: "confirm",
      basis: "proposal",
      appointmentIds: [2],
      confirmMessageId: 43,
      dueCents: 10000,
    });
  });

  it("narrows to the sittings recorded on the payment", () => {
    expect(
      decide({
        message: proposal({ status: "confirmed", appointmentIds: [1, 2] }),
        checkoutSittingIds: [2],
        paidCents: 10000,
      })
    ).toMatchObject({ action: "confirm", appointmentIds: [2] });
  });

  it("falls back to the proposal's session plan", () => {
    expect(
      decide({
        message: proposal({ status: "pending", sessionPlanId: 8 }),
        sittings: [
          sitting(1, { sessionPlanId: 8 }),
          sitting(2, { sessionPlanId: 7 }),
        ],
        paidCents: 10000,
      })
    ).toMatchObject({ action: "confirm", appointmentIds: [1] });
  });

  it("rounds fractional dollar deposits like the checkout does", () => {
    expect(
      decide({
        sittings: [
          sitting(1, { depositAmount: "33.34" }),
          sitting(2, { depositAmount: 33.33 }),
        ],
        paidCents: 6667,
      })
    ).toMatchObject({ action: "confirm", dueCents: 6667 });
  });
});

describe("decideDepositConfirmation — payments without a proposal", () => {
  const legacy = (over: Partial<DepositDecisionInput>) =>
    decide({ messageId: null, message: null, ...over });

  it("confirms the sittings that were pending when the payment was created", () => {
    expect(legacy({})).toEqual({
      action: "confirm",
      basis: "pending_at_checkout",
      appointmentIds: [1, 2],
      confirmMessageId: null,
      dueCents: 20000,
    });
    // Created in the same second as the payment: not "after" it.
    expect(
      legacy({ sittings: [sitting(1), sitting(2, { createdAtUnix: 5_000 })] })
    ).toMatchObject({ action: "confirm", basis: "pending_at_checkout" });
  });

  it("reviews when a sitting was added after the payment and the amount has room to spare", () => {
    expect(
      legacy({
        sittings: [sitting(1), sitting(2, { createdAtUnix: 6_000 })],
        paidCents: 25000,
      })
    ).toEqual({
      action: "review",
      reason: "sittings_changed",
      appointmentIds: [1, 2],
      dueCents: 20000,
    });
  });

  it("reviews when a sitting with no deposit was added after the payment", () => {
    expect(
      legacy({
        sittings: [
          sitting(1),
          sitting(2),
          sitting(3, { createdAtUnix: 6_000, depositAmount: 0 }),
          sitting(4, { createdAtUnix: 6_000, depositAmount: null }),
        ],
      })
    ).toMatchObject({
      action: "review",
      reason: "sittings_changed",
      appointmentIds: [1, 2, 3, 4],
    });
  });

  it("confirms a corrected booking paid on a reused payment when the amount matches exactly", () => {
    // The pay page was opened (payment created), the artist withdrew the
    // proposal and sent new dates at the same deposit, the client paid.
    expect(
      legacy({
        sittings: [
          sitting(1, { status: "cancelled" }),
          sitting(2, { status: "cancelled" }),
          sitting(3, { createdAtUnix: 6_000 }),
          sitting(4, { createdAtUnix: 6_000 }),
        ],
      })
    ).toEqual({
      action: "confirm",
      basis: "exact_amount",
      appointmentIds: [3, 4],
      confirmMessageId: null,
      dueCents: 20000,
    });
  });

  it("holds an added sitting that the amount does not cover", () => {
    expect(
      legacy({
        sittings: [
          sitting(1),
          sitting(2),
          sitting(3, { createdAtUnix: 6_000 }),
        ],
      })
    ).toMatchObject({ action: "review", reason: "sittings_changed" });
  });

  it("does not guess when the payment's creation time is unknown", () => {
    expect(
      legacy({
        sittings: [sitting(1), sitting(2, { createdAtUnix: 6_000 })],
        checkoutCreatedAtUnix: null,
        paidCents: 25000,
      })
    ).toMatchObject({ action: "confirm", basis: "pending_at_checkout" });
  });

  it("reviews when the amount does not cover every pending sitting", () => {
    expect(legacy({ paidCents: 10000 })).toMatchObject({
      action: "review",
      reason: "amount_short",
    });
  });

  it("confirms exactly the sittings recorded on the payment", () => {
    expect(
      legacy({
        sittings: [
          sitting(1),
          sitting(2, { createdAtUnix: 6_000 }),
          sitting(3, { depositAmount: 0 }),
        ],
        checkoutSittingIds: [1, 3, 99],
      })
    ).toMatchObject({
      action: "confirm",
      basis: "recorded_sittings",
      appointmentIds: [1, 3],
      dueCents: 10000,
    });
    expect(legacy({ checkoutSittingIds: [99] })).toMatchObject({
      action: "review",
      reason: "no_matching_sittings",
    });
  });

  it("confirms nothing for a payment recorded as covering no sittings", () => {
    // Pending sittings exist that the checkout never priced: hold.
    expect(legacy({ checkoutSittingIds: [] })).toMatchObject({
      action: "review",
      reason: "no_matching_sittings",
      appointmentIds: [1, 2],
    });
    expect(legacy({ checkoutSittingIds: [], sittings: [] })).toMatchObject({
      action: "confirm",
      appointmentIds: [],
    });
  });

  it("keeps a lead-only deposit working", () => {
    expect(legacy({ conversation: null, sittings: [] })).toEqual({
      action: "confirm",
      basis: "pending_at_checkout",
      appointmentIds: [],
      confirmMessageId: null,
      dueCents: 0,
    });
    expect(legacy({ sittings: [] })).toMatchObject({
      action: "confirm",
      appointmentIds: [],
    });
  });

  it("reviews a proposal id on a lead with no conversation", () => {
    expect(decide({ conversation: null })).toMatchObject({
      action: "review",
      reason: "message_not_in_booking",
    });
  });

  it("reviews a conversation that belongs to another artist", () => {
    expect(legacy({ lead: { artistId: "other" } })).toMatchObject({
      action: "review",
      reason: "booking_not_found",
    });
  });

  it("never confirms another client's or artist's sittings", () => {
    expect(
      legacy({
        sittings: [sitting(1), sitting(2, { artistId: "other" })],
      })
    ).toMatchObject({ action: "confirm", appointmentIds: [1] });
  });

  it("applies the legacy rule to a proposal that lists no sittings", () => {
    const message = proposal({ status: "pending", depositAmount: 300 });
    expect(decide({ message, paidCents: 30000 })).toEqual({
      action: "confirm",
      basis: "pending_at_checkout",
      appointmentIds: [1, 2],
      confirmMessageId: 43,
      dueCents: 30000,
    });
    expect(decide({ message, paidCents: 20000 })).toMatchObject({
      action: "review",
      reason: "amount_short",
    });
    // An exact match on added sittings still owes the proposal's own figure.
    expect(
      decide({
        message,
        sittings: [sitting(1), sitting(2, { createdAtUnix: 6_000 })],
        paidCents: 20000,
      })
    ).toMatchObject({ action: "review", reason: "amount_short" });
  });
});

describe("payment helpers", () => {
  it("caps the paid deposit by what Stripe collected", () => {
    const fees = { baseAmountCents: 20000, platformFeeCents: 400 };
    expect(paidDepositCents({ ...fees, amountCollectedCents: 20400 })).toBe(
      20000
    );
    expect(paidDepositCents({ ...fees, amountCollectedCents: 10400 })).toBe(
      10000
    );
    expect(paidDepositCents({ ...fees, amountCollectedCents: 0 })).toBe(0);
    expect(paidDepositCents({ ...fees, amountCollectedCents: null })).toBe(
      20000
    );
  });

  it("round-trips sitting ids through payment metadata", () => {
    expect(parseCheckoutSittingIds(formatCheckoutSittingIds([4, 5]))).toEqual([
      4, 5,
    ]);
    expect(formatCheckoutSittingIds([5, 4])).toBe("4,5");
    // "Recorded: none" is not the same as "nothing recorded".
    expect(formatCheckoutSittingIds([])).toBe("none");
    expect(parseCheckoutSittingIds("none")).toEqual([]);
    expect(formatCheckoutSittingIds(null)).toBe("");
    expect(parseCheckoutSittingIds("")).toBeNull();
    expect(parseCheckoutSittingIds(undefined)).toBeNull();
    expect(parseCheckoutSittingIds("x, 7 ,-1")).toEqual([7]);
    expect(formatCheckoutSittingIds()).toBe("");
    expect(
      formatCheckoutSittingIds(Array.from({ length: 200 }, (_, i) => i + 1000))
    ).toBe("");
  });

  it("keys a checkout by its sittings, whatever their order", () => {
    expect(checkoutSittingKey([4, 5])).toBe(checkoutSittingKey([5, 4]));
    expect(checkoutSittingKey([4, 5])).not.toBe(checkoutSittingKey([4, 6]));
    expect(checkoutSittingKey([4, 5])).not.toBe(checkoutSittingKey([45]));
    expect(checkoutSittingKey([])).toBe(checkoutSittingKey());
    expect(checkoutSittingKey([4, 5])).toMatch(/^s2-[a-z0-9]+$/);
  });
});

describe("depositLeadUpdate", () => {
  const now = "2026-01-01 00:00:00";
  const lead = { status: "deposit_requested", depositVerifiedAt: null };

  it("verifies the deposit when the payment confirmed the booking", () => {
    expect(
      depositLeadUpdate({
        lead,
        settlement: { action: "confirm" },
        paymentId: "pi_1",
        now,
      })
    ).toEqual({
      depositMethod: "stripe",
      depositClaimedAt: now,
      depositVerifiedAt: now,
      stripeCheckoutSessionId: "pi_1",
      status: "deposit_verified",
      updatedAt: now,
    });
  });

  it("records a held payment as claimed, not verified", () => {
    expect(
      depositLeadUpdate({
        lead,
        settlement: { action: "review" },
        paymentId: "pi_1",
        now,
      })
    ).toEqual({
      depositMethod: "stripe",
      depositClaimedAt: now,
      stripeCheckoutSessionId: "pi_1",
      status: "deposit_pending",
      updatedAt: now,
    });
  });

  it("leaves an already settled lead alone when a later payment is held", () => {
    for (const settled of [
      { status: "deposit_requested", depositVerifiedAt: now },
      { status: "deposit_verified", depositVerifiedAt: null },
      { status: "scheduled", depositVerifiedAt: null },
      { status: "completed", depositVerifiedAt: null },
    ])
      expect(
        depositLeadUpdate({
          lead: settled,
          settlement: { action: "review" },
          paymentId: "pi_2",
          now,
        })
      ).toBeNull();
  });
});

describe("settleDepositPayment", () => {
  const dialect = new MySqlDialect();
  const render = (condition: any) => dialect.sqlToQuery(condition);
  function database(rows: any[], message: any) {
    const writes: { table: unknown; values: any; where: any }[] = [];
    const reads: { fields: any; where: any; lock: string }[] = [];
    const db = {
      query: {
        conversations: { findFirst: async () => conversation },
        messages: { findFirst: async () => message },
      },
      select: (fields: any) => ({
        from: () => ({
          where: (where: any) => ({
            for: async (lock: string) => {
              reads.push({ fields, where: render(where), lock });
              return rows;
            },
          }),
        }),
      }),
      update: (table: unknown) => ({
        set: (values: any) => ({
          where: async (where: any) =>
            void writes.push({ table, values, where: render(where) }),
        }),
      }),
    };
    return { db: db as any, writes, reads };
  }
  const row = (id: number, over = {}) => ({
    id,
    conversationId: 9,
    artistId: "artist",
    clientId: "client",
    status: "pending",
    depositAmount: 100,
    sessionPlanId: null,
    createdAtUnix: 1_767_225_600, // 2026-01-01T00:00:00Z
    ...over,
  });
  const lead = { id: 5, artistId: "artist", conversationId: 9 };
  beforeEach(() => {
    forms.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("confirms the paid sittings, creates their forms and marks the proposal", async () => {
    const message = proposal({ status: "pending", appointmentIds: [1] });
    const { db, writes, reads } = database([row(1), row(2)], message);
    const result = await settleDepositPayment(db, {
      lead,
      messageId: 43,
      paidCents: 10000,
    });
    // The conversation's sittings are read under a row lock.
    expect(reads).toHaveLength(1);
    expect(reads[0].lock).toBe("update");
    expect(reads[0].where.sql).toBe("`appointments`.`conversationId` = ?");
    expect(reads[0].where.params).toEqual([9]);
    // The update itself is limited to the paid sittings, still pending, of
    // this conversation, artist and client.
    expect(writes[0].where.sql).toBe(
      "(`appointments`.`id` in (?) and `appointments`.`conversationId` = ? and " +
        "`appointments`.`artistId` = ? and `appointments`.`clientId` = ? and " +
        "`appointments`.`status` = ?)"
    );
    expect(writes[0].where.params).toEqual([
      1,
      9,
      "artist",
      "client",
      "pending",
    ]);
    expect(writes[1].where.sql).toBe("`messages`.`id` = ?");
    expect(writes[1].where.params).toEqual([43]);
    expect(result).toMatchObject({
      action: "confirm",
      appointmentIds: [1],
      conversationId: 9,
      messageId: 43,
    });
    expect(writes.map(write => write.table)).toEqual([
      schema.appointments,
      schema.messages,
    ]);
    expect(writes[0].values).toMatchObject({
      status: "confirmed",
      depositPaid: 1,
    });
    expect(JSON.parse(writes[1].values.metadata)).toMatchObject({
      status: "confirmed",
      appointmentIds: [1],
    });
    expect(forms.mock.calls.map(call => call[0])).toEqual([1]);
    expect(JSON.parse(depositLedgerMetadata(5, result))).toEqual({
      leadId: 5,
      conversationId: 9,
      messageId: 43,
      appointmentIds: [1],
      paidCents: 10000,
      dueCents: 10000,
      basis: "proposal",
    });
  });

  it("writes nothing and flags the ledger when the payment is short", async () => {
    const message = proposal({ status: "pending", appointmentIds: [1, 2] });
    const { db, writes } = database([row(1), row(2)], message);
    const result = await settleDepositPayment(db, {
      lead,
      messageId: 43,
      paidCents: 10000,
    });
    expect(result).toMatchObject({ action: "review", reason: "amount_short" });
    expect(writes).toEqual([]);
    expect(forms).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledOnce();
    expect(JSON.parse(depositLedgerMetadata(5, result))).toMatchObject({
      needsReview: true,
      reviewReason: "amount_short",
      dueCents: 20000,
      paidCents: 10000,
    });
  });

  it("holds a legacy payment when a sitting was created after it", async () => {
    const created = Date.parse("2026-01-01T12:00:00Z") / 1000;
    // mysql2 returns UNIX_TIMESTAMP() of a fractional column as a string.
    const { db, writes } = database(
      [row(1), row(2, { createdAtUnix: `${created + 1}.000` })],
      null
    );
    const result = await settleDepositPayment(db, {
      lead,
      paidCents: 25000,
      checkoutCreatedAt: created,
    });
    expect(result).toMatchObject({
      action: "review",
      reason: "sittings_changed",
    });
    expect(writes).toEqual([]);
  });

  it("compares creation times as instants read by the database, not as local strings", async () => {
    const created = Date.parse("2026-01-01T12:00:00Z") / 1000;
    // Both sittings were created before the payment. Read as strings from a
    // UTC+10 session they would look ten hours later than they are.
    const { db, reads } = database(
      [row(1), row(2, { createdAtUnix: created - 3600 })],
      null
    );
    const result = await settleDepositPayment(db, {
      lead,
      paidCents: 25000,
      checkoutCreatedAt: created,
    });
    expect(result).toMatchObject({
      action: "confirm",
      basis: "pending_at_checkout",
      appointmentIds: [1, 2],
    });
    expect(render(reads[0].fields.createdAtUnix).sql).toBe(
      "UNIX_TIMESTAMP(`appointments`.`createdAt`)"
    );
  });

  it("confirms only the sittings recorded on the payment", async () => {
    const { db, writes } = database([row(1), row(2), row(3)], null);
    const result = await settleDepositPayment(db, {
      lead,
      paidCents: 20000,
      checkoutSittingIds: [1, 3],
    });
    expect(result).toMatchObject({
      action: "confirm",
      basis: "recorded_sittings",
      appointmentIds: [1, 3],
    });
    expect(writes).toHaveLength(1);
    expect(writes[0].where.params).toEqual([
      1,
      3,
      9,
      "artist",
      "client",
      "pending",
    ]);
    expect(forms.mock.calls.map(call => call[0])).toEqual([1, 3]);
  });
});
