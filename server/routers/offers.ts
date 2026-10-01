import {
  deliveryAvailability,
  queueOfferDelivery,
  requestSmsCode,
  verifySmsCode,
} from "../services/offerDelivery";
import { purchaseVoucher } from "../services/offerPurchase";
import {
  getBalanceOffers,
  startOfferBalance,
  cancelOfferBalance,
} from "../services/offerBalance";
import { getArtistSettings } from "../db";
import { canAccessFeature } from "../_core/tierPermissions";
import {
  offersEnabled,
  requireOffersEnabled,
} from "../services/offerAvailability";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, ne, or, desc, inArray } from "drizzle-orm";
import { router, protectedProcedure } from "../_core/trpc";
import { withDatabaseTransaction } from "../services/core";
import { requireArtist } from "../services/access";
import * as s from "../../drizzle/schema";
import {
  offerRulesSchema,
  audienceSchema,
  type OfferRules,
  OFFER_TERMS,
} from "../../shared/offerRules";
const now = () => new Date().toISOString().slice(0, 19).replace("T", " ");
const parse = (v: string) => offerRulesSchema.parse(JSON.parse(v));
function fail(message: string): never {
  throw new TRPCError({ code: "BAD_REQUEST", message });
}
async function audience(
  db: any,
  artistId: string,
  filters: z.infer<typeof audienceSchema>
) {
  const conversations = await db
    .select({ id: s.conversations.clientId })
    .from(s.conversations)
    .where(eq(s.conversations.artistId, artistId));
  const appointments = await db
    .select()
    .from(s.appointments)
    .where(
      and(
        eq(s.appointments.artistId, artistId),
        ne(s.appointments.status, "cancelled")
      )
    );
  const ledger = await db
    .select()
    .from(s.paymentLedger)
    .where(eq(s.paymentLedger.artistId, artistId));
  const clients = [...new Set<string>(conversations.map((c: any) => c.id))];
  return clients.filter(id => {
    const rows = appointments.filter((a: any) => a.clientId === id);
    const completed = rows.filter((a: any) => a.status === "completed");
    const spend = Math.max(
      0,
      ledger
        .filter(
          (entry: any) =>
            entry.clientId === id &&
            ["deposit", "balance", "voucher_sale", "refund"].includes(
              entry.transactionType
            )
        )
        .reduce((sum: number, entry: any) => sum + entry.amountCents, 0)
    );
    const last = Math.max(
      0,
      ...rows
        .map((a: any) => +new Date(a.startTime + "Z"))
        .filter((date: number) => date <= Date.now())
    );
    return (
      spend >= filters.minSpendCents &&
      completed.length >= filters.minBookings &&
      (!filters.inactiveDays ||
        last <= Date.now() - filters.inactiveDays * 86400000)
    );
  });
}
async function campaign(db: any, id: number, userId: string) {
  const [c] = await db
    .select()
    .from(s.offerCampaigns)
    .where(
      and(eq(s.offerCampaigns.id, id), eq(s.offerCampaigns.artistId, userId))
    )
    .for("update");
  if (!c) throw new TRPCError({ code: "NOT_FOUND" });
  return c;
}
async function requirePromotionArtist(user: { id: string; role: string }) {
  requireArtist(user);
  const settings = await getArtistSettings(user.id);
  if (!canAccessFeature(settings?.subscriptionTier as any, "canUsePromotions"))
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Your subscription does not include promotions.",
    });
}
const offerProcedure = protectedProcedure.use(({ next }) => {
  requireOffersEnabled();
  return next();
});
export const offersRouter = router({
  preferences: protectedProcedure.query(({ ctx }) =>
    withDatabaseTransaction(async db => {
      if (!offersEnabled())
        return {
          enabled: false,
          sms: false,
          push: false,
          verifiedPhone: null,
          ...deliveryAvailability(),
        };
      const p = await db.query.offerPreferences.findFirst({
        where: eq(s.offerPreferences.userId, ctx.user.id),
      });
      return {
        enabled: true,
        sms: !!p?.sms,
        push: !!p?.push,
        verifiedPhone: p?.verifiedPhone ?? null,
        ...deliveryAvailability(),
      };
    })
  ),
  setPreferences: offerProcedure
    .input(z.object({ sms: z.boolean(), push: z.boolean() }))
    .mutation(({ ctx, input }) =>
      withDatabaseTransaction(async db => {
        if (ctx.user.role !== "client")
          throw new TRPCError({ code: "FORBIDDEN" });
        const p = await db.query.offerPreferences.findFirst({
          where: eq(s.offerPreferences.userId, ctx.user.id),
        });
        if (input.sms && !p?.verifiedPhone)
          fail("Verify your mobile number first.");
        await db
          .insert(s.offerPreferences)
          .values({
            userId: ctx.user.id,
            sms: +input.sms,
            push: +input.push,
            updatedAt: now(),
          })
          .onDuplicateKeyUpdate({
            set: { sms: +input.sms, push: +input.push, updatedAt: now() },
          });
        return { success: true };
      })
    ),
  requestSmsCode: offerProcedure
    .input(z.object({ phone: z.string().regex(/^\+[1-9]\d{7,14}$/) }))
    .mutation(({ ctx, input }) => requestSmsCode(ctx.user.id, input.phone)),
  verifySmsCode: offerProcedure
    .input(z.object({ code: z.string().regex(/^\d{6}$/) }))
    .mutation(({ ctx, input }) => verifySmsCode(ctx.user.id, input.code)),
  deliveries: offerProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(({ ctx, input }) =>
      withDatabaseTransaction(async db => {
        requireArtist(ctx.user);
        await campaign(db, input.id, ctx.user.id);
        return db
          .select({
            id: s.offerDeliveries.id,
            channel: s.offerDeliveries.channel,
            status: s.offerDeliveries.status,
            error: s.offerDeliveries.error,
            attempts: s.offerDeliveries.attempts,
            updatedAt: s.offerDeliveries.updatedAt,
          })
          .from(s.offerDeliveries)
          .innerJoin(
            s.clientOffers,
            eq(s.clientOffers.id, s.offerDeliveries.offerId)
          )
          .where(eq(s.clientOffers.campaignId, input.id));
      })
    ),
  retryDelivery: offerProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ ctx, input }) =>
      withDatabaseTransaction(async db => {
        requireArtist(ctx.user);
        const [d] = await db
          .select()
          .from(s.offerDeliveries)
          .where(eq(s.offerDeliveries.id, input.id))
          .for("update");
        const o =
          d &&
          (await db.query.clientOffers.findFirst({
            where: eq(s.clientOffers.id, d.offerId),
          }));
        if (!d || !o || o.artistId !== ctx.user.id)
          throw new TRPCError({ code: "FORBIDDEN" });
        if (d.status !== "failed" || d.attempts >= 5)
          fail(
            "Only confirmed failed deliveries can be retried, up to five attempts."
          );
        const available = deliveryAvailability();
        if (!available[d.channel === "sms" ? "smsAvailable" : "pushAvailable"])
          fail("This delivery provider is not configured.");
        await db
          .update(s.offerDeliveries)
          .set({ status: "pending", error: null, updatedAt: now() })
          .where(eq(s.offerDeliveries.id, d.id));
        return { success: true };
      })
    ),

  purchase: offerProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ ctx, input }) =>
      withDatabaseTransaction(db => purchaseVoucher(db, input.id, ctx.user.id))
    ),
  balanceQuote: offerProcedure
    .input(
      z.object({
        bookingId: z.number().int().positive(),
        offerId: z.number().int().positive().nullable().default(null),
        requestId: z.number().int().positive().optional(),
      })
    )
    .query(({ ctx, input }) =>
      withDatabaseTransaction(db =>
        getBalanceOffers(
          db,
          input.bookingId,
          ctx.user.id,
          input.offerId,
          input.requestId
        )
      )
    ),
  balanceCheckout: offerProcedure
    .input(
      z.object({
        bookingId: z.number().int().positive(),
        offerId: z.number().int().positive().nullable(),
        requestId: z.number().int().positive().optional(),
      })
    )
    .mutation(({ ctx, input }) =>
      withDatabaseTransaction(db =>
        startOfferBalance(
          db,
          input.bookingId,
          ctx.user.id,
          input.offerId,
          input.requestId
        )
      )
    ),
  cancelBalanceCheckout: offerProcedure
    .input(z.object({ bookingId: z.number().int().positive() }))
    .mutation(({ ctx, input }) =>
      withDatabaseTransaction(async db => {
        await cancelOfferBalance(db, input.bookingId, ctx.user.id);
        return { success: true };
      })
    ),
  list: protectedProcedure.query(({ ctx }) =>
    withDatabaseTransaction(async db => {
      if (!offersEnabled())
        return {
          enabled: false,
          role:
            ctx.user.role === "artist"
              ? ("artist" as const)
              : ("client" as const),
          campaigns: [],
          offers: [],
          incoming: [],
          terms: OFFER_TERMS,
        };

      if (ctx.user.role === "artist" || ctx.user.role === "admin") {
        const rows = await db
          .select()
          .from(s.offerCampaigns)
          .where(
            and(
              eq(s.offerCampaigns.artistId, ctx.user.id),
              eq(s.offerCampaigns.archived, 0)
            )
          )
          .orderBy(desc(s.offerCampaigns.id));
        return {
          enabled: true,
          role: "artist" as const,
          campaigns: rows.map(r => ({ ...r, rules: parse(r.rulesJson) })),
          offers: [],
          incoming: [],
          terms: OFFER_TERMS,
        };
      }
      const rows = await db
        .select({ offer: s.clientOffers, artistName: s.users.name })
        .from(s.clientOffers)
        .innerJoin(s.users, eq(s.users.id, s.clientOffers.artistId))
        .where(
          or(
            eq(s.clientOffers.clientId, ctx.user.id),
            eq(s.clientOffers.transferTo, ctx.user.id)
          )
        );
      const mapped = rows.map(({ offer, artistName }) => ({
        ...offer,
        artistName,
        rules: parse(offer.rulesJson),
      }));
      return {
        enabled: true,
        role: "client" as const,
        campaigns: [],
        offers: mapped.filter(o => o.clientId === ctx.user.id),
        incoming: mapped.filter(o => o.transferTo === ctx.user.id),
        terms: OFFER_TERMS,
      };
    })
  ),
  save: offerProcedure
    .input(
      z.object({
        id: z.number().int().positive().optional(),
        rules: offerRulesSchema,
      })
    )
    .mutation(({ ctx, input }) =>
      withDatabaseTransaction(async db => {
        await requirePromotionArtist(ctx.user);
        const r = input.rules;
        if (r.funding === "sale" && r.value < 100)
          fail("Sold gift vouchers must be at least AUD $1.");
        if (r.currency !== "AUD")
          fail(
            "NZD checkout is not enabled yet. Create this test offer in AUD."
          );
        if (r.expiresAt && +new Date(r.expiresAt) <= Date.now())
          fail("Choose an expiry in the future.");
        // Conservative minimum for every voucher, including complimentary ones. Short-lived offers use discounts.
        const minimum = new Date();
        minimum.setUTCFullYear(minimum.getUTCFullYear() + 3);
        if (
          r.kind === "voucher" &&
          r.expiresAt &&
          +new Date(r.expiresAt) < +minimum
        )
          fail(
            "Gift vouchers must have at least three years’ validity, or no expiry."
          );
        if (input.id) {
          await campaign(db, input.id, ctx.user.id);
          await db
            .update(s.offerCampaigns)
            .set({ rulesJson: JSON.stringify(r) })
            .where(eq(s.offerCampaigns.id, input.id));
          return { id: input.id };
        }
        const [result] = await db.insert(s.offerCampaigns).values({
          artistId: ctx.user.id,
          rulesJson: JSON.stringify(r),
          createdAt: now(),
        });
        return { id: result.insertId };
      })
    ),
  archive: offerProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ ctx, input }) =>
      withDatabaseTransaction(async db => {
        requireArtist(ctx.user);
        await campaign(db, input.id, ctx.user.id);
        await db
          .update(s.offerCampaigns)
          .set({ archived: 1 })
          .where(eq(s.offerCampaigns.id, input.id));
        return { success: true };
      })
    ),
  audience: offerProcedure.input(audienceSchema).query(({ ctx, input }) =>
    withDatabaseTransaction(async db => {
      requireArtist(ctx.user);
      const recipients = await audience(db, ctx.user.id, input);
      const preferences = recipients.length
        ? await db
            .select()
            .from(s.offerPreferences)
            .where(inArray(s.offerPreferences.userId, recipients))
        : [];
      return {
        count: recipients.length,
        ...deliveryAvailability(),
        smsCount: preferences.filter(p => p.sms && p.verifiedPhone).length,
        pushCount: preferences.filter(p => p.push).length,
      };
    })
  ),
  issue: offerProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        filters: audienceSchema,
        expectedCount: z.number().int().nonnegative(),
        channels: z
          .object({ sms: z.boolean(), push: z.boolean() })
          .default({ sms: false, push: false }),
      })
    )
    .mutation(({ ctx, input }) =>
      withDatabaseTransaction(async db => {
        await requirePromotionArtist(ctx.user);
        const availability = deliveryAvailability();
        if (input.channels.sms && !availability.smsAvailable)
          fail("SMS provider is not configured.");
        if (input.channels.push && !availability.pushAvailable)
          fail("Push provider is not configured.");
        const c = await campaign(db, input.id, ctx.user.id);
        if (c.archived) fail("This promotion is archived.");
        const rules = parse(c.rulesJson);
        if (rules.expiresAt && +new Date(rules.expiresAt) <= Date.now())
          fail("This promotion has expired.");
        const recipients = await audience(db, ctx.user.id, input.filters);
        if (recipients.length !== input.expectedCount)
          fail("Your audience changed. Review the count and try again.");
        const existing = await db
          .select()
          .from(s.clientOffers)
          .where(eq(s.clientOffers.campaignId, c.id));
        const ids = recipients.filter(
          id => !existing.some(o => o.originalClientId === id)
        );
        for (const clientId of ids)
          await db.insert(s.clientOffers).values({
            campaignId: c.id,
            artistId: ctx.user.id,
            clientId,
            originalClientId: clientId,
            rulesJson: c.rulesJson,
            remainingValue: rules.funding === "sale" ? 0 : rules.value,
            purchaseRequired: rules.funding === "sale" ? 1 : 0,
            issuanceKey: `${c.id}:${clientId}`,
            issuedAt: now(),
          });
        const issuedOffers = await db
          .select()
          .from(s.clientOffers)
          .where(eq(s.clientOffers.campaignId, c.id));
        for (const o of issuedOffers)
          if (
            recipients.includes(o.clientId) &&
            o.originalClientId === o.clientId
          )
            await queueOfferDelivery(db, o.id, o.clientId, input.channels);
        return {
          issued: ids.length,
          skipped: recipients.length - ids.length,
          delivery:
            "In-app cards added; selected notifications queued for consenting clients.",
        };
      })
    ),
  use: offerProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ ctx, input }) =>
      withDatabaseTransaction(async db => {
        const [offer] = await db
          .select()
          .from(s.clientOffers)
          .where(
            and(
              eq(s.clientOffers.id, input.id),
              eq(s.clientOffers.clientId, ctx.user.id)
            )
          )
          .for("update");
        if (!offer || offer.transferTo || offer.remainingValue <= 0)
          fail("This offer is unavailable.");
        const r = parse(offer.rulesJson);
        if (r.expiresAt && +new Date(r.expiresAt) <= Date.now())
          fail("This offer has expired.");
        await db.select({id:s.users.id}).from(s.users).where(eq(s.users.id,ctx.user.id)).for("update");
        const conversation = await db.query.conversations.findFirst({
          where: and(
            eq(s.conversations.artistId, offer.artistId),
            eq(s.conversations.clientId, ctx.user.id)
          ),
        });
        let conversationId=conversation?.id;
        if(!conversationId){
          const [created]=await db.insert(s.conversations).values({artistId:offer.artistId,clientId:ctx.user.id,lastMessageAt:now()});
          conversationId=created.insertId;
        }
        if (!offer.interestAt) {
          await db.update(s.conversations).set({lastMessageAt:now()}).where(eq(s.conversations.id,conversationId));
          await db.insert(s.messages).values({
            conversationId,
            senderId: ctx.user.id,
            messageType: "system",
            content: `I’d like to use “${r.name}” on an eligible booking.`,
            metadata: JSON.stringify({
              type: "promotion_interest",
              offerId: offer.id,
            }),
          });
          await db.insert(s.notificationOutbox).values({
            eventType: "push_message",
            status: "pending",
            payloadJson: JSON.stringify({
              targetUserId: offer.artistId,
              title: "Promotion enquiry",
              body: `A client would like to use ${r.name}.`,
              url: `/chat/${conversationId}`,
            }),
          });
          await db
            .update(s.clientOffers)
            .set({ interestAt: now() })
            .where(eq(s.clientOffers.id, offer.id));
        }
        return { conversationId };
      })
    ),
  transfer: offerProcedure
    .input(
      z.object({ id: z.number().int().positive(), email: z.string().email() })
    )
    .mutation(({ ctx, input }) =>
      withDatabaseTransaction(async db => {
        const [o] = await db
          .select()
          .from(s.clientOffers)
          .where(
            and(
              eq(s.clientOffers.id, input.id),
              eq(s.clientOffers.clientId, ctx.user.id)
            )
          )
          .for("update");
        if (
          !o ||
          parse(o.rulesJson).kind !== "voucher" ||
          o.remainingValue <= 0 ||
          o.transferTo
        )
          fail("This voucher cannot be transferred.");
        const r = parse(o.rulesJson);
        if (r.expiresAt && +new Date(r.expiresAt) <= Date.now())
          fail("This voucher has expired.");
        const busy = await db.query.offerApplications.findFirst({
          where: and(
            eq(s.offerApplications.offerId, o.id),
            eq(s.offerApplications.status, "reserved")
          ),
        });
        if (
          o.reservedPlanId ||
          o.reservedBalanceId ||
          o.purchaseRequired ||
          busy
        )
          fail("Remove this voucher from checkout before transferring.");
        const user = await db.query.users.findFirst({
          where: eq(s.users.email, input.email.trim().toLowerCase()),
        });
        if (!user || user.role !== "client" || user.id === ctx.user.id)
          fail("Enter the email of another registered client.");
        await db
          .update(s.clientOffers)
          .set({ transferTo: user.id })
          .where(eq(s.clientOffers.id, o.id));
        await db.insert(s.notificationOutbox).values({
          eventType: "push_message",
          status: "pending",
          payloadJson: JSON.stringify({
            targetUserId: user.id,
            title: "A gift voucher is waiting",
            body: "Accept or decline your gift in My Tattoos.",
            url: "/bookings",
          }),
        });
        return { success: true };
      })
    ),
  resolveTransfer: offerProcedure
    .input(z.object({ id: z.number().int().positive(), accept: z.boolean() }))
    .mutation(({ ctx, input }) =>
      withDatabaseTransaction(async db => {
        const [o] = await db
          .select()
          .from(s.clientOffers)
          .where(eq(s.clientOffers.id, input.id))
          .for("update");
        if (
          !o ||
          !o.transferTo ||
          (input.accept
            ? o.transferTo !== ctx.user.id
            : o.clientId !== ctx.user.id && o.transferTo !== ctx.user.id)
        )
          throw new TRPCError({ code: "FORBIDDEN" });
        const terms = parse(o.rulesJson);
        if (
          input.accept &&
          terms.expiresAt &&
          +new Date(terms.expiresAt) <= Date.now()
        )
          fail("This gift expired before it was accepted.");
        await db.insert(s.notificationOutbox).values({
          eventType: "push_message",
          status: "pending",
          payloadJson: JSON.stringify({
            targetUserId: o.clientId,
            title: input.accept ? "Gift accepted" : "Gift transfer cancelled",
            body: terms.name,
            url: "/bookings",
          }),
        });
        await db
          .update(s.clientOffers)
          .set({
            clientId: input.accept ? o.transferTo : o.clientId,
            transferTo: null,
            interestAt: null,
          })
          .where(eq(s.clientOffers.id, o.id));
        return { success: true };
      })
    ),
});
