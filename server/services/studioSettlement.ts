/**
 * Studio Settlement Engine — "The Department of Tattoo Services"
 *
 * Core Business Logic:
 * 1. Studios never hold client deposits or money.
 * 2. When an artist's Stripe balance pays out (daily or weekly), the studio's cut is calculated.
 * 3. Funds are transferred from the artist's Stripe account to the studio's Stripe account.
 * 4. Dual transaction logs recorded (artist deduction / studio credit).
 * 5. Symmetrical SETTLEMENT RECEIVED message card posted to the artist/studio Dept Messages thread.
 * 6. OneSignal push notification dispatched.
 * 7. Recipient Created Tax Invoice (RCTI) record generated.
 */

import Stripe from "stripe";
import { getDb } from "./core";
import { eq, and, sql, desc, gte, lte, isNull } from "drizzle-orm";
import * as schema from "../../drizzle/schema";
import { stripe } from "./stripe";
import { sendPushNotification } from "../_core/pushNotification";

export interface SettlementResult {
  settled: boolean;
  settlementAmountCents: number;
  grossAmountCents: number;
  paymentModel: string;
  transferId?: string;
  rctiInvoiceNumber?: string;
  reason?: string;
}

/**
 * Main Webhook Handler for payout.paid / payout.created
 */
export async function handleArtistPayoutWebhook(
  event: Stripe.Event,
  payout: Stripe.Payout,
  connectAccountId?: string
): Promise<SettlementResult> {
  const db = await getDb();
  if (!db) {
    console.error("[StudioSettlement] Database connection failed");
    return { settled: false, settlementAmountCents: 0, grossAmountCents: 0, paymentModel: "none", reason: "no_db" };
  }

  // 1. Identify artist by Stripe Connect Account ID
  const artistAccount = connectAccountId || (event as any).account || payout.destination;
  if (!artistAccount) {
    console.log("[StudioSettlement] No connect account found on payout event");
    return { settled: false, settlementAmountCents: 0, grossAmountCents: 0, paymentModel: "none", reason: "no_connect_account" };
  }

  const artistSettingsRecord = await db.query.artistSettings.findFirst({
    where: eq(schema.artistSettings.stripeConnectAccountId, String(artistAccount)),
  });

  if (!artistSettingsRecord) {
    console.log(`[StudioSettlement] No artist found for Connect account ${artistAccount}`);
    return { settled: false, settlementAmountCents: 0, grossAmountCents: 0, paymentModel: "none", reason: "artist_not_found" };
  }

  const artistId = artistSettingsRecord.userId;

  // 2. Find active Studio Membership
  const memberRecord = await db.query.studioMembers.findFirst({
    where: and(
      eq(schema.studioMembers.userId, artistId),
      eq(schema.studioMembers.status, "active")
    ),
  });

  if (!memberRecord) {
    console.log(`[StudioSettlement] Artist ${artistId} is not an active member of any studio`);
    return { settled: false, settlementAmountCents: 0, grossAmountCents: 0, paymentModel: "none", reason: "no_active_studio" };
  }

  // 3. Find Studio Entity
  const studio = await db.query.studios.findFirst({
    where: eq(schema.studios.id, memberRecord.studioId),
  });

  if (!studio) {
    console.error(`[StudioSettlement] Studio ${memberRecord.studioId} not found`);
    return { settled: false, settlementAmountCents: 0, grossAmountCents: 0, paymentModel: "none", reason: "studio_not_found" };
  }

  const artistUser = await db.query.users.findFirst({
    where: eq(schema.users.id, artistId),
  });

  const artistName = artistUser?.name || "Resident Artist";
  const model = memberRecord.paymentModel || "commission";
  const payoutAmountCents = payout.amount || 0;

  // 4. Calculate Settlement Amount based on Payment Model
  let rawSettlementCents = 0;
  let grossCents = 0;

  if (model === "commission") {
    // Calculate gross completed payments in this payout cycle
    const commPct = memberRecord.commissionPct || 30;
    // Basis = completed appointment payments
    const [rev] = await db
      .select({ total: sql<number>`COALESCE(SUM(${schema.appointments.price} * 100), 0)` })
      .from(schema.appointments)
      .where(
        and(
          eq(schema.appointments.artistId, artistId),
          eq(schema.appointments.status, "completed")
        )
      );
    grossCents = Number(rev?.total || payoutAmountCents);
    rawSettlementCents = Math.round(grossCents * (commPct / 100));
  } else if (model === "rent") {
    // Fixed weekly chair rent (taken at weekly payout or proportional)
    const weeklyRent = memberRecord.weeklyChairRentCents || 35000;
    // Check joined date for proration if within 7 days
    if (memberRecord.joinedAt) {
      const daysActive = Math.max(1, Math.min(7, Math.ceil((Date.now() - new Date(memberRecord.joinedAt).getTime()) / (1000 * 60 * 60 * 24))));
      if (daysActive < 7) {
        rawSettlementCents = Math.round((weeklyRent / 7) * daysActive);
      } else {
        rawSettlementCents = weeklyRent;
      }
    } else {
      rawSettlementCents = weeklyRent;
    }
    grossCents = payoutAmountCents;
  } else if (model === "dynamic") {
    // Dynamic Commission: Monday–Sunday Brisbane weekly basis
    // $0–$2,500 -> start%, $2,500–$5,000 -> start-10, $5,000+ -> start-20, floor 5%
    const startPct = memberRecord.dynamicStartingPct || 35;
    grossCents = payoutAmountCents;
    let effectivePct = startPct;
    if (grossCents > 500000) {
      effectivePct = Math.max(5, startPct - 20);
    } else if (grossCents > 250000) {
      effectivePct = Math.max(5, startPct - 10);
    }
    rawSettlementCents = Math.round(grossCents * (effectivePct / 100));
  } else if (model === "none") {
    // Artist keeps 100%
    rawSettlementCents = 0;
    grossCents = payoutAmountCents;
  }

  // 5. Arrears processing (Check and recover prior shortfalls)
  const pendingArrears = await db.query.studioArrears.findMany({
    where: and(
      eq(schema.studioArrears.studioId, studio.id),
      eq(schema.studioArrears.artistId, artistId),
      eq(schema.studioArrears.status, "pending")
    ),
  });

  const totalArrears = pendingArrears.reduce((sum, a) => sum + a.amountCents, 0);
  let totalDueCents = rawSettlementCents + totalArrears;

  // Handle Insufficient Balance
  let actualSettlementCents = totalDueCents;
  let newShortfallCents = 0;

  if (payoutAmountCents > 0 && totalDueCents > payoutAmountCents) {
    actualSettlementCents = payoutAmountCents;
    newShortfallCents = totalDueCents - payoutAmountCents;

    // Log shortfall into studio_arrears
    await db.insert(schema.studioArrears).values({
      studioId: studio.id,
      artistId,
      amountCents: newShortfallCents,
      reason: `Shortfall from payout on ${new Date().toLocaleDateString("en-AU")}`,
      status: "pending",
    });
  }

  // If previous arrears were resolved, mark them resolved
  if (totalArrears > 0 && actualSettlementCents >= totalArrears) {
    for (const a of pendingArrears) {
      await db
        .update(schema.studioArrears)
        .set({
          status: "deducted",
          resolvedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
        })
        .where(eq(schema.studioArrears.id, a.id));
    }
  }

  if (actualSettlementCents <= 0) {
    console.log(`[StudioSettlement] Settlement calculated to $0 for ${artistName}`);
    return {
      settled: true,
      settlementAmountCents: 0,
      grossAmountCents: grossCents,
      paymentModel: model,
    };
  }

  // 6. Execute Stripe Transfer
  let stripeTransferId: string | undefined;
  if (studio.stripeConnectAccountId) {
    try {
      const transfer = await stripe.transfers.create({
        amount: actualSettlementCents,
        currency: "aud",
        destination: studio.stripeConnectAccountId,
        description: `Settlement · ${artistName} · ${model}`,
      });
      stripeTransferId = transfer.id;
      console.log(`[StudioSettlement] Transferred $${(actualSettlementCents / 100).toFixed(2)} to ${studio.name} (${transfer.id})`);
    } catch (stripeErr: any) {
      console.error("[StudioSettlement] Stripe transfer error:", stripeErr.message);
    }
  }

  // 7. Update Studio Balance & Log Studio Transaction
  await db
    .update(schema.studios)
    .set({
      balanceCents: (studio.balanceCents || 0) + actualSettlementCents,
      updatedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
    })
    .where(eq(schema.studios.id, studio.id));

  const [txResult] = await db.insert(schema.studioTransactions).values({
    studioId: studio.id,
    artistId,
    type: "artist_settlement_credit",
    amountCents: actualSettlementCents,
    grossAmountCents: grossCents,
    stripeFeeCents: 0,
    platformFeeCents: 0,
    netAmountCents: actualSettlementCents,
    paymentModel: model,
    payoutSchedule: "weekly",
    stripeTransferId: stripeTransferId || null,
    stripePayoutId: payout.id,
    description: `Settlement · ${artistName} · ${model === "rent" ? `$${Math.round((memberRecord.weeklyChairRentCents || 35000) / 100)} chair rent` : model === "dynamic" ? "Dynamic commission" : `${memberRecord.commissionPct || 30}% commission`}`,
  });

  // 8. Send SETTLEMENT RECEIVED Message Card in Dept Messages
  let conversation = await db.query.conversations.findFirst({
    where: and(
      eq(schema.conversations.artistId, artistId),
      eq(schema.conversations.clientId, studio.ownerId)
    ),
  });

  if (!conversation) {
    // Reverse check
    conversation = await db.query.conversations.findFirst({
      where: and(
        eq(schema.conversations.artistId, studio.ownerId),
        eq(schema.conversations.clientId, artistId)
      ),
    });
  }

  if (!conversation) {
    const [cRes] = await db.insert(schema.conversations).values({
      artistId,
      clientId: studio.ownerId,
      studioId: studio.id,
    });
    conversation = { id: cRes.insertId, artistId, clientId: studio.ownerId, studioId: studio.id } as any;
  }

  if (conversation) {
    const settlementMetadata = {
      type: "settlement_received",
      amountCents: actualSettlementCents,
      model,
      payoutDate: new Date().toISOString(),
      studioId: studio.id,
      artistId,
      status: "Transferred to studio Stripe balance",
    };

    await db.insert(schema.messages).values({
      conversationId: conversation.id,
      senderId: studio.ownerId,
      content: `Settlement received: $${(actualSettlementCents / 100).toFixed(2)} from ${artistName}'s payout.`,
      messageType: "settlement_received",
      metadata: JSON.stringify(settlementMetadata),
    });
  }

  // 9. Send OneSignal Push Notification
  try {
    await sendPushNotification({
      userIds: [studio.ownerId, artistId],
      title: "Settlement Processed",
      message: `$${(actualSettlementCents / 100).toFixed(2)} settlement transferred to ${studio.name}.`,
      url: `/studio`,
      data: {
        studioId: studio.id,
        amountCents: actualSettlementCents,
      },
    });
  } catch (pushErr) {
    console.error("[StudioSettlement] Push notification error:", pushErr);
  }

  // 10. Generate Recipient Created Tax Invoice (RCTI)
  const invoiceNumber = `RCTI-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;
  const nowStr = new Date().toISOString().slice(0, 19).replace("T", " ");
  const periodStart = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 19).replace("T", " ");

  await db.insert(schema.rctiInvoices).values({
    invoiceNumber,
    studioId: studio.id,
    artistId,
    periodStart,
    periodEnd: nowStr,
    grossAmountCents: grossCents,
    gstAmountCents: Math.round(actualSettlementCents / 11), // Australian 10% GST component
    settlementAmountCents: actualSettlementCents,
    paymentModel: model,
  });

  return {
    settled: true,
    settlementAmountCents: actualSettlementCents,
    grossAmountCents: grossCents,
    paymentModel: model,
    transferId: stripeTransferId,
    rctiInvoiceNumber: invoiceNumber,
  };
}
