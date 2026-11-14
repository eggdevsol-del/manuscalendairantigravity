/**
 * Deposit payments confirm only what was paid for.
 *
 * A paid deposit names a lead and (usually) the artist's proposal message. The
 * sittings to confirm are the ones that proposal created, never "everything
 * pending in the chat". `decideDepositConfirmation` is the pure decision;
 * `settleDepositPayment` loads the rows, applies it and reports the outcome so
 * the webhook can write the ledger entry.
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  appointments,
  conversations,
  leads,
  messages,
} from "../../drizzle/schema";
import type { getDb } from "./core";

type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;

// Mirrors funnel.ts: a proposal can be paid for until it is confirmed,
// declined or revoked.
const PAYABLE_PROPOSAL_STATUSES = [
  "pending",
  "accepted",
  "remittance_uploaded",
];

export type DepositReviewReason =
  /** The lead's conversation is missing or belongs to another artist. */
  | "booking_not_found"
  /** The message is not this artist's proposal in this conversation. */
  | "message_not_in_booking"
  /** The proposal was declined or revoked before the payment arrived. */
  | "proposal_not_payable"
  /** None of the paid-for sittings is still pending. */
  | "no_matching_sittings"
  /** A payment without a proposal, and the pending sittings changed since. */
  | "sittings_changed"
  /** The amount paid does not cover the deposit due. */
  | "amount_short";

/** What tied a confirmed payment to its sittings; kept on the ledger. */
export type DepositConfirmBasis =
  /** The sittings the paid proposal created. */
  | "proposal"
  /** The sitting ids recorded on the payment when it was created. */
  | "recorded_sittings"
  /** Legacy: every pending sitting already existed when the payment was created. */
  | "pending_at_checkout"
  /** Legacy: sittings were added since, and the amount matches them exactly. */
  | "exact_amount";

export type DepositDecision =
  | {
      action: "confirm";
      basis: DepositConfirmBasis;
      /** Pending sittings to confirm; may be empty for a lead-only deposit. */
      appointmentIds: number[];
      /** Proposal message to mark confirmed, when one was paid. */
      confirmMessageId: number | null;
      dueCents: number;
    }
  | {
      action: "review";
      reason: DepositReviewReason;
      /** What would have been confirmed; left untouched. */
      appointmentIds: number[];
      dueCents: number;
    };

export type DepositSitting = {
  id: number;
  conversationId: number | null;
  artistId: string;
  clientId: string;
  status: string;
  /** Whole/fractional DOLLARS, as appointmentService stores it. */
  depositAmount: number | string | null;
  sessionPlanId?: number | null;
  /** When the sitting was created (unix seconds, from the database clock). */
  createdAtUnix: number | null;
};

export type DepositDecisionInput = {
  lead: { artistId: string };
  /** The lead's conversation, or null when the lead has none. */
  conversation: {
    id: number;
    artistId: string;
    clientId: string | null;
  } | null;
  /** messageId from the payment metadata, if any. */
  messageId: number | null;
  /** The row for messageId, or null when it does not exist. */
  message: {
    id: number;
    conversationId: number;
    senderId: string;
    messageType: string;
    metadata: string | null;
  } | null;
  /** Every sitting in the conversation, whatever its status. */
  sittings: DepositSitting[];
  /** Deposit actually paid, in cents, before platform fees. */
  paidCents: number;
  /**
   * Sittings recorded on the payment when it was created: null when the
   * payment recorded nothing (legacy), [] when it recorded "no sittings".
   */
  checkoutSittingIds: number[] | null;
  /**
   * Stripe `created` of the payment (unix seconds), if known. Checkouts reuse
   * a payment through their idempotency key, so this is when the pay page was
   * FIRST opened, not when the booking was last checked against the amount.
   */
  checkoutCreatedAtUnix: number | null;
};

const sittingCents = (sitting: DepositSitting) =>
  Math.round(Number(sitting.depositAmount || 0) * 100);
const sumCents = (rows: DepositSitting[]) =>
  rows.reduce((sum, row) => sum + sittingCents(row), 0);

function parseProposal(metadata: string | null) {
  let meta: Record<string, any> = {};
  try {
    const parsed = JSON.parse(metadata || "{}");
    if (parsed && typeof parsed === "object") meta = parsed;
  } catch {
    /* unreadable metadata lists no sittings */
  }
  // Older messages hold a single id, or ids as strings.
  const single = meta.appointmentId;
  const raw: unknown[] = Array.isArray(meta.appointmentIds)
    ? meta.appointmentIds
    : single
      ? [single]
      : [];
  const ids = raw
    .map(id => Number(id))
    .filter(id => Number.isInteger(id) && id > 0);
  const planId = Number(meta.sessionPlanId);
  // metadata.depositAmount is stored in DOLLARS
  const stated = Number(meta.depositAmount);
  return {
    status: typeof meta.status === "string" ? meta.status : "",
    appointmentIds: ids,
    sessionPlanId: Number.isInteger(planId) && planId > 0 ? planId : null,
    statedCents:
      Number.isFinite(stated) && stated > 0 ? Math.round(stated * 100) : 0,
  };
}

const NO_SITTINGS = "none";

/**
 * Sitting ids stored on a payment as "12,13". Null when nothing was recorded
 * (a payment created before ids were stored); [] when the checkout recorded
 * that it covers no sittings.
 */
export function parseCheckoutSittingIds(
  value: string | null | undefined
): number[] | null {
  if (!value) return null;
  if (value.trim() === NO_SITTINGS) return [];
  const ids = value
    .split(",")
    .map(part => Number(part.trim()))
    .filter(id => Number.isInteger(id) && id > 0);
  return ids.length ? ids : null;
}

/**
 * Metadata value for the sittings a checkout covers: "12,13", "none" for an
 * empty list, "" when the caller recorded nothing (or the list is too long).
 */
export function formatCheckoutSittingIds(ids?: number[] | null): string {
  if (!ids) return "";
  if (!ids.length) return NO_SITTINGS;
  const value = [...ids].sort((a, b) => a - b).join(",");
  // Stripe metadata values are capped at 500 characters.
  return value.length <= 500 ? value : "";
}

/**
 * Idempotency-key part for the sittings a checkout covers, so a booking whose
 * sittings changed gets a fresh payment instead of replaying the old one.
 */
export function checkoutSittingKey(ids?: number[] | null): string {
  const sorted = [...(ids || [])].sort((a, b) => a - b);
  // FNV-1a: short, stable, and only has to tell sitting sets apart.
  let hash = 0x811c9dc5;
  for (const char of sorted.join(",")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `s${sorted.length}-${hash.toString(36)}`;
}

/**
 * The deposit (before platform fees) a payment really carried: the amount the
 * checkout was created for, capped by what Stripe says was collected.
 */
export function paidDepositCents(opts: {
  baseAmountCents: number;
  platformFeeCents: number;
  /** Total collected from the client, when Stripe reports it. */
  amountCollectedCents: number | null | undefined;
}): number {
  const base = Number.isFinite(opts.baseAmountCents) ? opts.baseAmountCents : 0;
  if (typeof opts.amountCollectedCents !== "number") return Math.max(0, base);
  const fee = Number.isFinite(opts.platformFeeCents)
    ? opts.platformFeeCents
    : 0;
  return Math.max(0, Math.min(base, opts.amountCollectedCents - fee));
}

/**
 * Decide what a deposit payment confirms. Pure: everything it needs is passed
 * in, nothing is read or written.
 */
export function decideDepositConfirmation(
  input: DepositDecisionInput
): DepositDecision {
  const { conversation, message, messageId, paidCents } = input;
  const review = (
    reason: DepositReviewReason,
    rows: DepositSitting[] = [],
    dueCents = 0
  ): DepositDecision => ({
    action: "review",
    reason,
    appointmentIds: rows.map(row => row.id),
    dueCents,
  });
  const confirm = (
    rows: DepositSitting[],
    dueCents: number,
    confirmMessageId: number | null,
    basis: DepositConfirmBasis
  ): DepositDecision =>
    paidCents < dueCents
      ? review("amount_short", rows, dueCents)
      : {
          action: "confirm",
          basis,
          appointmentIds: rows.map(row => row.id),
          confirmMessageId,
          dueCents,
        };

  if (!conversation) {
    // A lead with no chat has no sittings; a proposal cannot belong to it.
    return messageId
      ? review("message_not_in_booking")
      : confirm([], 0, null, "pending_at_checkout");
  }
  if (conversation.artistId !== input.lead.artistId)
    return review("booking_not_found");

  // Only this artist's sittings for this client in this conversation count.
  const owned = input.sittings.filter(
    sitting =>
      sitting.conversationId === conversation.id &&
      sitting.artistId === conversation.artistId &&
      sitting.clientId === (conversation.clientId || "")
  );
  const pending = owned.filter(sitting => sitting.status === "pending");
  const onCheckout = (sitting: DepositSitting) =>
    !input.checkoutSittingIds || input.checkoutSittingIds.includes(sitting.id);

  let proposal: ReturnType<typeof parseProposal> | null = null;
  if (messageId) {
    if (
      !message ||
      message.id !== messageId ||
      message.conversationId !== conversation.id ||
      message.senderId !== conversation.artistId ||
      message.messageType !== "appointment_request"
    )
      return review("message_not_in_booking");
    proposal = parseProposal(message.metadata);
    // An already confirmed proposal stays payable (a rescheduled sitting's
    // deposit); a declined or revoked one is not brought back by paying.
    const alreadyConfirmed = proposal.status === "confirmed";
    if (
      !alreadyConfirmed &&
      !PAYABLE_PROPOSAL_STATUSES.includes(proposal.status)
    )
      return review("proposal_not_payable");

    // The sittings the proposal created: its own list, else its session plan.
    const { appointmentIds, sessionPlanId } = proposal;
    const listed = appointmentIds.length
      ? owned.filter(sitting => appointmentIds.includes(sitting.id))
      : sessionPlanId
        ? owned.filter(sitting => sitting.sessionPlanId === sessionPlanId)
        : [];
    if (appointmentIds.length || listed.length) {
      const live = listed.filter(sitting => sitting.status !== "cancelled");
      const targets = live.filter(
        sitting => sitting.status === "pending" && onCheckout(sitting)
      );
      if (!targets.length) return review("no_matching_sittings");
      // A whole proposal is paid in full (the artist's figure can only raise
      // the sittings' sum); a confirmed one owes just the sittings moved.
      const dueCents = alreadyConfirmed
        ? sumCents(targets)
        : Math.max(sumCents(live), proposal.statedCents);
      return confirm(targets, dueCents, messageId, "proposal");
    }
  }
  // What the proposal itself asks for, when it lists no sittings.
  const statedCents =
    proposal && proposal.status !== "confirmed" ? proposal.statedCents : 0;
  const confirmMessageId = proposal ? messageId : null;

  // No sitting list on the proposal (or no proposal at all): a recorded
  // list on the payment, else the legacy rule below.
  if (input.checkoutSittingIds) {
    const targets = pending.filter(onCheckout);
    if (!targets.length && pending.length)
      return review("no_matching_sittings", pending);
    return confirm(
      targets,
      Math.max(sumCents(targets), statedCents),
      confirmMessageId,
      "recorded_sittings"
    );
  }

  // Legacy (nothing recorded on the payment): confirm the pending sittings
  // when they all existed before the payment was created.
  const pendingCents = sumCents(pending);
  const dueCents = Math.max(pendingCents, statedCents);
  const { checkoutCreatedAtUnix } = input;
  const added = pending.filter(
    sitting =>
      checkoutCreatedAtUnix !== null &&
      sitting.createdAtUnix !== null &&
      sitting.createdAtUnix > checkoutCreatedAtUnix
  );
  if (!added.length)
    return confirm(pending, dueCents, confirmMessageId, "pending_at_checkout");
  // Sittings were added after the payment was created. That is also what a
  // corrected booking looks like when the client reopens the pay page: the
  // checkout is checked again but the same payment is reused. Confirm only
  // when the amount accounts for exactly these sittings, each with a deposit
  // of its own, so nothing unpriced can ride along; otherwise hold it.
  const exact =
    pending.every(sitting => sittingCents(sitting) > 0) &&
    paidCents === pendingCents;
  if (!exact) return review("sittings_changed", pending, pendingCents);
  return confirm(pending, dueCents, confirmMessageId, "exact_amount");
}

/** UNIX_TIMESTAMP() result → whole seconds; null when the column is empty. */
function unixSeconds(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const seconds = Number(value);
  return Number.isFinite(seconds) ? seconds : null;
}

export type DepositSettlement = DepositDecision & {
  conversationId: number | null;
  messageId: number | null;
  paidCents: number;
};

/**
 * Apply a deposit payment: confirm the paid proposal's pending sittings and
 * mark the proposal confirmed, or change nothing and return a "review"
 * outcome. Never throws for a payment that merely fails to match.
 */
export async function settleDepositPayment(
  db: Database,
  opts: {
    lead: { id: number; artistId: string; conversationId: number | null };
    messageId?: number | null;
    paidCents: number;
    checkoutSittingIds?: number[] | null;
    /** Stripe `created` (unix seconds) of the session or payment intent. */
    checkoutCreatedAt?: number | null;
    logPrefix?: string;
  }
): Promise<DepositSettlement> {
  const tag = opts.logPrefix || "[Stripe]";
  const messageId =
    opts.messageId && Number.isInteger(opts.messageId) && opts.messageId > 0
      ? opts.messageId
      : null;
  const conversation = opts.lead.conversationId
    ? ((await db.query.conversations.findFirst({
        where: eq(conversations.id, opts.lead.conversationId),
      })) ?? null)
    : null;
  const message = messageId
    ? ((await db.query.messages.findFirst({
        where: eq(messages.id, messageId),
      })) ?? null)
    : null;
  // Locked so a concurrent reschedule or cancel cannot slip between the
  // decision and the update. createdAt is read as an instant by the database
  // itself: as a string it comes back in the session time zone.
  const rows = conversation
    ? await db
        .select({
          id: appointments.id,
          conversationId: appointments.conversationId,
          artistId: appointments.artistId,
          clientId: appointments.clientId,
          status: appointments.status,
          depositAmount: appointments.depositAmount,
          sessionPlanId: appointments.sessionPlanId,
          createdAtUnix: sql<
            number | string | null
          >`UNIX_TIMESTAMP(${appointments.createdAt})`,
        })
        .from(appointments)
        .where(eq(appointments.conversationId, conversation.id))
        .for("update")
    : [];

  const decision = decideDepositConfirmation({
    lead: opts.lead,
    conversation,
    messageId,
    message,
    sittings: rows.map(row => ({
      id: row.id,
      conversationId: row.conversationId,
      artistId: row.artistId,
      clientId: row.clientId,
      status: row.status,
      depositAmount: row.depositAmount,
      sessionPlanId: row.sessionPlanId,
      createdAtUnix: unixSeconds(row.createdAtUnix),
    })),
    paidCents: opts.paidCents,
    checkoutSittingIds: opts.checkoutSittingIds ?? null,
    checkoutCreatedAtUnix:
      typeof opts.checkoutCreatedAt === "number"
        ? opts.checkoutCreatedAt
        : null,
  });
  const settlement: DepositSettlement = {
    ...decision,
    conversationId: conversation?.id ?? null,
    messageId,
    paidCents: opts.paidCents,
  };

  if (decision.action === "review") {
    console.error(
      `${tag} DEPOSIT NEEDS REVIEW: lead ${opts.lead.id}, reason ${decision.reason}, ` +
        `paid ${opts.paidCents}c, due ${decision.dueCents}c, message ${messageId ?? "none"}, ` +
        `sittings [${decision.appointmentIds.join(",")}]. Nothing was confirmed.`
    );
    return settlement;
  }

  if (conversation && decision.appointmentIds.length) {
    // Same effect as appointmentService.confirmAppointments, limited to the
    // sittings that were paid for.
    await db
      .update(appointments)
      .set({
        status: "confirmed",
        depositPaid: 1,
        confirmationSent: 0, // Will be set to 1 after notification is sent
        updatedAt: sql`now()`,
        totalPaidAmountCents: sql`COALESCE(totalPaidAmountCents, 0) + (COALESCE(depositAmount, 0) * 100)`,
        remainingBalanceCents: sql`GREATEST(0, COALESCE(totalExpectedAmountCents, 0) - (COALESCE(totalPaidAmountCents, 0) + (COALESCE(depositAmount, 0) * 100)))`,
      } as any)
      .where(
        and(
          inArray(appointments.id, decision.appointmentIds),
          eq(appointments.conversationId, conversation.id),
          eq(appointments.artistId, conversation.artistId),
          eq(appointments.clientId, conversation.clientId || ""),
          eq(appointments.status, "pending")
        )
      );
    const { generateRequiredForms } = await import("./appointmentService");
    for (const id of decision.appointmentIds)
      await generateRequiredForms(id, db);
    console.log(
      `${tag} Confirmed sittings [${decision.appointmentIds.join(",")}] for conversation ${conversation.id}`
    );
  }

  if (decision.confirmMessageId && message) {
    let meta: Record<string, any> = {};
    try {
      const parsed = JSON.parse(message.metadata || "{}");
      if (parsed && typeof parsed === "object") meta = parsed;
    } catch {
      /* keep the proposal readable even if its metadata was not */
    }
    meta.status = "confirmed";
    await db
      .update(messages)
      .set({ metadata: JSON.stringify(meta) })
      .where(eq(messages.id, decision.confirmMessageId));
    console.log(
      `${tag} Proposal message ${decision.confirmMessageId} confirmed for Lead ${opts.lead.id}`
    );
  }
  return settlement;
}

/** Ledger `metadata` for a deposit: what it confirmed, or why it is on hold. */
export function depositLedgerMetadata(
  leadId: number,
  settlement: DepositSettlement
): string {
  return JSON.stringify({
    leadId,
    conversationId: settlement.conversationId,
    messageId: settlement.messageId,
    appointmentIds: settlement.appointmentIds,
    paidCents: settlement.paidCents,
    dueCents: settlement.dueCents,
    ...(settlement.action === "review"
      ? { needsReview: true, reviewReason: settlement.reason }
      : { basis: settlement.basis }),
  });
}

// A lead this far along is not pulled back by a payment that is on hold.
const SETTLED_LEAD_STATUSES = ["deposit_verified", "scheduled", "completed"];

/**
 * What a deposit payment writes to its lead. A confirmed payment verifies the
 * deposit. A held one is recorded as claimed but NOT verified, and the lead
 * moves to `deposit_pending` (as bank and cash claims do) so it no longer
 * looks unpaid. Null when a held payment must leave the lead as it is.
 */
export function depositLeadUpdate(opts: {
  lead: { status: string; depositVerifiedAt?: unknown };
  settlement: Pick<DepositSettlement, "action">;
  /** Stripe session or payment intent id. */
  paymentId: string;
  /** MySQL "YYYY-MM-DD HH:MM:SS". */
  now: string;
}): Partial<typeof leads.$inferInsert> | null {
  const { lead, now } = opts;
  const claimed = {
    depositMethod: "stripe" as const,
    depositClaimedAt: now,
    stripeCheckoutSessionId: opts.paymentId,
    updatedAt: now,
  };
  if (opts.settlement.action === "confirm")
    return { ...claimed, depositVerifiedAt: now, status: "deposit_verified" };
  // An already verified deposit keeps the payment that verified it.
  if (lead.depositVerifiedAt || SETTLED_LEAD_STATUSES.includes(lead.status))
    return null;
  return { ...claimed, status: "deposit_pending" };
}
