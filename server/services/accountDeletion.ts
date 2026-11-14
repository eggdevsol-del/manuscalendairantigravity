/**
 * Account deletion. The users row is never removed: almost every table cascades from it, so removing
 * it would erase the other party's bookings, signed consent forms and payment history. Instead the
 * row is stripped of everything personal and its role is prefixed "disabled_", which sign-in and
 * every authenticated request already reject (accountEnabled in masterDevAccess.ts).
 *
 * What happens to each table that points at a user ("own" = rows where the deleted person is the
 * userId/artistId/owner; "other side" = rows where they are the client of someone else, or vice versa):
 *
 * | Table                      | Decision                                                              |
 * | -------------------------- | --------------------------------------------------------------------- |
 * | users                      | SCRUB: name "Deleted user", placeholder email, all personal and        |
 * |                            | sign-in columns nulled, role "disabled_<role>"                         |
 * | appointments               | KEEP: the other party's booking history                                |
 * | appointmentLogs            | KEEP: audit trail of kept bookings                                     |
 * | consent_forms              | KEEP: health law record                                                |
 * | payment_ledger             | KEEP: tax record                                                       |
 * | payment_requests           | KEEP: payment record                                                   |
 * | sessionPlans (+ items)     | KEEP: the other party's project history                                |
 * | conversations, messages    | KEEP: the other party's conversation history                           |
 * | consultations              | KEEP: part of the conversation history                                 |
 * | design_briefs              | KEEP: part of the conversation history                                 |
 * | client_content             | KEEP: files shared between the two parties about kept bookings         |
 * | procedure_logs             | KEEP unchanged, including the client's name and date of birth: it is   |
 * |                            | the artist's statutory record of who was tattooed, a health record     |
 * | reschedule_requests        | KEEP: history of kept bookings                                         |
 * | orders, supplierOrders     | KEEP: payment and tax records (open ones block deletion)               |
 * | issued_vouchers / _promotions, voucher_templates, promotion_templates                             |
 * |                            | KEEP: value a client still holds; the templates are their parents      |
 * | client_offers, offer_balance_checkouts, offer_credit_restorations, offer_deliveries               |
 * |                            | KEEP: issued terms and payment state                                   |
 * | offer_campaigns            | SCRUB: archived so nothing new is issued                               |
 * | policies, aftercareTemplates | KEEP: terms and aftercare that kept bookings refer to                |
 * | products, seminars         | SCRUB: made inactive; kept because past orders refer to them           |
 * | merchants                  | SCRUB: contact details and integration tokens nulled, suspended;       |
 * |                            | business name and tax numbers stay with the order records              |
 * | studios (owned)            | SCRUB: booking link off, logo and description nulled; kept because     |
 * |                            | bookings refer to it (other members block deletion)                    |
 * | artistSettings             | SCRUB: address, email, bank, licence, calendar tokens, location,       |
 * |                            | templates and public slug nulled, booking link off; Stripe ids stay    |
 * |                            | so kept payments can still be refunded or disputed                     |
 * | leads                      | own (artist): DELETE with their activity log, they hold other people's |
 * |                            | contact details; other side (client): SCRUB the contact columns        |
 * | client_notes               | own (artist): DELETE; other side: KEEP, the artist's working record,   |
 * |                            | now attached to a de-identified person                                 |
 * | waitlist_entries           | as client: DELETE; as artist: KEEP, the client's request history       |
 * | active_tasks               | DELETE, own and other side: a regenerated to-do cache that copies the  |
 * |                            | client's name, phone and email into another artist's list              |
 * | task_completions           | own (artist): DELETE; other side: KEEP, timing statistics with no      |
 * |                            | personal details                                                       |
 * | lead_activity_log          | goes with the artist's own leads; on anyone else's lead the reference  |
 * |                            | to the person is nulled                                                |
 * | system_logs                | SCRUB: the reference to the person is nulled                           |
 * | artist_public_profile, portfolios (+ likes, classifications), portfolio_likes, favourite_artists, |
 * | moodboards (+ items), saved_days, push_subscriptions, notificationSettings,                       |
 * | notificationTemplates, quickActionButtons, socialMessageSync, message_tags, weekly_analytics,     |
 * | dashboard_settings, funnel_sessions, payment_method_settings, instagram_imports,                  |
 * | artist_practice_sessions, offer_preferences, offer_sms_challenges, studio_members                 |
 * |                            | DELETE: purely the person's own                                        |
 */
import { and, eq, gt, inArray, isNull, ne, or, sql } from "drizzle-orm";
import type { MySqlTable } from "drizzle-orm/mysql-core";
import type { MySql2Database } from "drizzle-orm/mysql2";
import type { SQL } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import * as schema from "../../drizzle/schema";
import { assertAccountBillingClosed } from "./accountBilling";
import { getDb, withDatabaseTransaction } from "./core";
import { stripe } from "./stripe";

type Database = MySql2Database<typeof schema>;

/** The table above in a form the tests can hold the schema and the code to. */
export const KEPT_TABLES: MySqlTable[] = [
  schema.appointments,
  schema.appointmentLogs,
  schema.consentForms,
  schema.paymentLedger,
  schema.paymentRequests,
  schema.sessionPlans,
  schema.conversations,
  schema.messages,
  schema.consultations,
  schema.designBriefs,
  schema.clientContent,
  schema.procedureLogs,
  schema.rescheduleRequests,
  schema.orders,
  schema.supplierOrders,
  schema.issuedVouchers,
  schema.issuedPromotions,
  schema.voucherTemplates,
  schema.promotionTemplates,
  schema.clientOffers,
  schema.offerBalanceCheckouts,
  schema.offerCreditRestorations,
  schema.offerDeliveries,
  schema.policies,
  schema.aftercareTemplates,
];
export const SCRUBBED_TABLES: MySqlTable[] = [
  schema.users,
  schema.offerCampaigns,
  schema.products,
  schema.seminars,
  schema.merchants,
  schema.studios,
  schema.artistSettings,
  schema.systemLogs,
];
/** Tables where some or all of the person's rows are deleted. */
export const DELETED_TABLES: MySqlTable[] = [
  schema.leads,
  schema.leadActivityLog,
  schema.clientNotes,
  schema.waitlistEntries,
  schema.activeTasks,
  schema.taskCompletions,
  schema.artistPublicProfile,
  schema.portfolios,
  schema.portfolioLikes,
  schema.favouriteArtists,
  schema.moodboards,
  schema.savedDays,
  schema.pushSubscriptions,
  schema.notificationSettings,
  schema.notificationTemplates,
  schema.quickActionButtons,
  schema.socialMessageSync,
  schema.messageTags,
  schema.weeklyAnalytics,
  schema.dashboardSettings,
  schema.funnelSessions,
  schema.paymentMethodSettings,
  schema.instagramImports,
  schema.artistPracticeSessions,
  schema.offerPreferences,
  schema.offerSmsChallenges,
  schema.studioMembers,
];

export const DELETED_USER_NAME = "Deleted user";
/** Unique per person and never deliverable (.invalid is reserved), so nobody can sign in or recover with it. */
export const deletedUserEmail = (userId: string) =>
  `deleted-${userId}@deleted.invalid`;

export type DeletionSummary = {
  /** The person's role before deletion. */
  role: string;
  upcomingConfirmedSittings: number;
  pendingBookingRequests: number;
  unpaidBalances: number;
  pendingPayouts: number;
  activeSubscription: boolean;
  openSupplierOrders: number;
  openStoreOrders: number;
  studioMembersLeftBehind: number;
};
export type DeletionBlocker = {
  code: Exclude<keyof DeletionSummary, "role">;
  reason: string;
};

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/**
 * Why this account cannot be deleted yet. An empty list means deletion may go ahead.
 *
 * Two of these the person cannot clear themselves, so under block-on-everything they wait on someone
 * else: openStoreOrders counts a buyer's "paid" order until the seller marks it fulfilled, and
 * unpaidBalances counts a client's pending payment request with no expiry until the artist cancels it.
 */
export function deletionBlockers(summary: DeletionSummary): DeletionBlocker[] {
  // Every open commitment blocks deletion; nothing is cancelled on the person's behalf.
  const artist = summary.role === "artist";
  const blockers: DeletionBlocker[] = [];
  if (summary.upcomingConfirmedSittings > 0)
    blockers.push({
      code: "upcomingConfirmedSittings",
      reason: `You have ${plural(summary.upcomingConfirmedSittings, "confirmed sitting", "confirmed sittings")} coming up. Cancel or complete ${summary.upcomingConfirmedSittings === 1 ? "it" : "them"} first so ${artist ? "your clients are" : "your artist is"} not left waiting.`,
    });
  if (summary.pendingBookingRequests > 0)
    blockers.push({
      code: "pendingBookingRequests",
      reason: `You have ${plural(summary.pendingBookingRequests, "booking", "bookings")} still waiting to be confirmed. Confirm, decline or cancel ${summary.pendingBookingRequests === 1 ? "it" : "them"} first.`,
    });
  if (summary.unpaidBalances > 0)
    blockers.push({
      code: "unpaidBalances",
      reason: `You have ${plural(summary.unpaidBalances, "payment", "payments")} still outstanding. ${artist ? "Wait for payment or cancel the request" : "Pay or ask your artist to cancel"} before deleting your account.`,
    });
  if (summary.pendingPayouts > 0)
    blockers.push({
      code: "pendingPayouts",
      reason:
        "You have money that has not been paid out to you yet, or a payment on hold. Wait until your payouts have arrived and any dispute is settled.",
    });
  if (summary.activeSubscription)
    blockers.push({
      code: "activeSubscription",
      reason:
        "Your artist or studio subscription is still open. Cancel it in billing and wait until cancellation takes effect before deleting your account.",
    });
  if (summary.openSupplierOrders > 0)
    blockers.push({
      code: "openSupplierOrders",
      reason: `You have ${plural(summary.openSupplierOrders, "supplier order", "supplier orders")} still being paid for. Finish or abandon checkout first.`,
    });
  if (summary.openStoreOrders > 0)
    blockers.push({
      code: "openStoreOrders",
      reason: `You have ${plural(summary.openStoreOrders, "store order", "store orders")} not yet fulfilled. Wait until ${summary.openStoreOrders === 1 ? "it is" : "they are"} fulfilled or cancelled.`,
    });
  if (summary.studioMembersLeftBehind > 0)
    blockers.push({
      code: "studioMembersLeftBehind",
      reason: `Your studio still has ${plural(summary.studioMembersLeftBehind, "other member", "other members")}. Remove them from the studio first.`,
    });
  return blockers;
}

export function deletionBlockedMessage(blockers: DeletionBlocker[]) {
  return [
    "Your account cannot be deleted yet:",
    ...blockers.map(blocker => `• ${blocker.reason}`),
  ].join("\n");
}

const mysqlNow = () => new Date().toISOString().slice(0, 19).replace("T", " ");

async function count(db: Database, table: MySqlTable, where: SQL | undefined) {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(table)
    .where(where);
  return Number(row?.n ?? 0);
}

function stripeAccountGone(error: unknown) {
  const { type, code } = (error ?? {}) as { type?: string; code?: string };
  return (
    type === "StripePermissionError" ||
    code === "account_invalid" ||
    code === "resource_missing"
  );
}

const stripeUnreachable = (what: string) =>
  new TRPCError({
    code: "SERVICE_UNAVAILABLE",
    message: `We could not check your ${what} right now, so your account has not been deleted. Try again shortly.`,
  });

/**
 * Money Stripe still holds for the artist on an account Tattoi controls. A standard account is the
 * artist's own and outlives their Tattoi account, so its balance is not ours to wait for.
 */
async function stripeBalanceOutstanding(userId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const settings = await db.query.artistSettings.findFirst({
    where: eq(schema.artistSettings.userId, userId),
  });
  if (
    !settings?.stripeConnectAccountId ||
    (settings.stripeConnectAccountType ?? "standard") === "standard"
  )
    return false;
  let balance;
  try {
    balance = await stripe.balance.retrieve({
      stripeAccount: settings.stripeConnectAccountId,
    });
  } catch (error) {
    // A connected account that was deauthorised or removed is out of our hands: there is no
    // balance we could wait for, and waiting would block deletion for good.
    if (stripeAccountGone(error)) return false;
    throw stripeUnreachable("payouts");
  }
  return [...balance.pending, ...balance.available].some(
    entry => entry.amount > 0
  );
}

/** Stripe is the authority on subscriptions; only its "still open" answer becomes a blocker. */
async function billingBlocker(userId: string) {
  try {
    await assertAccountBillingClosed(userId);
    return null;
  } catch (error) {
    if (error instanceof TRPCError && error.code === "CONFLICT")
      return error.message;
    // Still fails closed, but as something the person can read.
    throw stripeUnreachable("subscription");
  }
}

async function summarise(
  db: Database,
  user: { id: string; role: string },
  external: { activeSubscription: boolean; stripeBalanceOutstanding: boolean }
): Promise<DeletionSummary> {
  const s = schema;
  const now = mysqlNow();
  const myBookings = or(
    eq(s.appointments.artistId, user.id),
    eq(s.appointments.clientId, user.id)
  );
  const ownedStudioIds = (
    await db
      .select({ id: s.studios.id })
      .from(s.studios)
      .where(eq(s.studios.ownerId, user.id))
  ).map(studio => studio.id);
  const [
    upcomingConfirmedSittings,
    pendingBookingRequests,
    paymentRequests,
    balanceCheckouts,
    ledgerInFlight,
    openSupplierOrders,
    openStoreOrders,
    studioMembersLeftBehind,
  ] = await Promise.all([
    count(
      db,
      s.appointments,
      and(
        myBookings,
        eq(s.appointments.status, "confirmed"),
        gt(s.appointments.endTime, now)
      )
    ),
    count(
      db,
      s.appointments,
      and(
        myBookings,
        eq(s.appointments.status, "pending"),
        gt(s.appointments.endTime, now)
      )
    ),
    count(
      db,
      s.paymentRequests,
      and(
        or(
          eq(s.paymentRequests.artistId, user.id),
          eq(s.paymentRequests.clientId, user.id)
        ),
        eq(s.paymentRequests.status, "pending"),
        or(
          isNull(s.paymentRequests.expiresAt),
          gt(s.paymentRequests.expiresAt, now)
        )
      )
    ),
    count(
      db,
      s.offerBalanceCheckouts,
      and(
        or(
          eq(s.offerBalanceCheckouts.artistId, user.id),
          eq(s.offerBalanceCheckouts.clientId, user.id)
        ),
        eq(s.offerBalanceCheckouts.status, "reserved")
      )
    ),
    // "pending" is the column default and is never advanced for ordinary payments, so only the
    // states that are set deliberately (a payout under way, or held by a dispute) count here.
    count(
      db,
      s.paymentLedger,
      and(
        eq(s.paymentLedger.artistId, user.id),
        inArray(s.paymentLedger.payoutStatus, [
          "scheduled",
          "processing",
          "held",
        ])
      )
    ),
    count(
      db,
      s.supplierOrders,
      and(
        eq(s.supplierOrders.artistId, user.id),
        eq(s.supplierOrders.status, "pending")
      )
    ),
    count(
      db,
      s.orders,
      and(
        or(eq(s.orders.artistId, user.id), eq(s.orders.clientId, user.id)),
        inArray(s.orders.status, ["pending", "paid"])
      )
    ),
    ownedStudioIds.length
      ? count(
          db,
          s.studioMembers,
          and(
            inArray(s.studioMembers.studioId, ownedStudioIds),
            ne(s.studioMembers.userId, user.id),
            inArray(s.studioMembers.status, ["active", "pending_invite"])
          )
        )
      : 0,
  ]);
  return {
    role: user.role,
    upcomingConfirmedSittings,
    pendingBookingRequests,
    unpaidBalances: paymentRequests + balanceCheckouts,
    pendingPayouts:
      ledgerInFlight + (external.stripeBalanceOutstanding ? 1 : 0),
    activeSubscription: external.activeSubscription,
    openSupplierOrders,
    openStoreOrders,
    studioMembersLeftBehind,
  };
}

async function erase(db: Database, user: { id: string; role: string }) {
  const s = schema;
  const id = user.id;

  // ── Purely the person's own, whichever role they hold ──
  await db
    .delete(s.pushSubscriptions)
    .where(eq(s.pushSubscriptions.userId, id));
  await db
    .delete(s.notificationSettings)
    .where(eq(s.notificationSettings.userId, id));
  await db
    .delete(s.notificationTemplates)
    .where(eq(s.notificationTemplates.userId, id));
  await db
    .delete(s.quickActionButtons)
    .where(eq(s.quickActionButtons.userId, id));
  await db.delete(s.offerPreferences).where(eq(s.offerPreferences.userId, id));
  await db
    .delete(s.offerSmsChallenges)
    .where(eq(s.offerSmsChallenges.userId, id));
  await db.delete(s.portfolioLikes).where(eq(s.portfolioLikes.userId, id));
  await db
    .delete(s.favouriteArtists)
    .where(
      or(
        eq(s.favouriteArtists.clientId, id),
        eq(s.favouriteArtists.artistId, id)
      )
    );
  await db.delete(s.studioMembers).where(eq(s.studioMembers.userId, id));

  // ── As a client ──
  const boards = await db
    .select({ id: s.moodboards.id })
    .from(s.moodboards)
    .where(eq(s.moodboards.clientId, id));
  if (boards.length)
    await db.delete(s.moodboardItems).where(
      inArray(
        s.moodboardItems.moodboardId,
        boards.map(board => board.id)
      )
    );
  await db.delete(s.moodboards).where(eq(s.moodboards.clientId, id));
  await db.delete(s.waitlistEntries).where(eq(s.waitlistEntries.clientId, id));
  await db
    .delete(s.savedDays)
    .where(
      or(
        eq(s.savedDays.artistId, id),
        eq(s.savedDays.clientKey, `client:${id}`)
      )
    );
  // Another artist's lead about this person stays theirs, without the contact details.
  await db
    .update(s.leads)
    .set({
      clientName: DELETED_USER_NAME,
      clientFirstName: null,
      clientLastName: null,
      clientBirthdate: null,
      clientEmail: deletedUserEmail(id),
      clientPhone: null,
      clientGender: null,
    })
    .where(and(eq(s.leads.clientId, id), ne(s.leads.artistId, id)));

  // ── As an artist: off discovery, booking link dead, private working data gone ──
  await db
    .delete(s.artistPublicProfile)
    .where(eq(s.artistPublicProfile.artistId, id));
  const works = await db
    .select({ id: s.portfolios.id })
    .from(s.portfolios)
    .where(eq(s.portfolios.artistId, id));
  if (works.length) {
    const workIds = works.map(work => work.id);
    await db
      .delete(s.portfolioLikes)
      .where(inArray(s.portfolioLikes.portfolioId, workIds));
    await db
      .delete(s.portfolioClassifications)
      .where(inArray(s.portfolioClassifications.portfolioItemId, workIds));
  }
  await db.delete(s.portfolios).where(eq(s.portfolios.artistId, id));
  await db.delete(s.funnelSessions).where(eq(s.funnelSessions.artistId, id));
  const ownLeads = await db
    .select({ id: s.leads.id })
    .from(s.leads)
    .where(eq(s.leads.artistId, id));
  if (ownLeads.length)
    await db.delete(s.leadActivityLog).where(
      inArray(
        s.leadActivityLog.leadId,
        ownLeads.map(lead => lead.id)
      )
    );
  await db.delete(s.leads).where(eq(s.leads.artistId, id));
  await db
    .update(s.leadActivityLog)
    .set({ performedBy: null })
    .where(eq(s.leadActivityLog.performedBy, id));
  await db.delete(s.clientNotes).where(eq(s.clientNotes.artistId, id));
  await db.delete(s.messageTags).where(eq(s.messageTags.artistId, id));
  await db
    .delete(s.activeTasks)
    .where(or(eq(s.activeTasks.artistId, id), eq(s.activeTasks.clientId, id)));
  await db.delete(s.taskCompletions).where(eq(s.taskCompletions.artistId, id));
  await db.delete(s.weeklyAnalytics).where(eq(s.weeklyAnalytics.artistId, id));
  await db
    .delete(s.dashboardSettings)
    .where(eq(s.dashboardSettings.artistId, id));
  await db
    .delete(s.socialMessageSync)
    .where(eq(s.socialMessageSync.artistId, id));
  await db
    .delete(s.instagramImports)
    .where(eq(s.instagramImports.artistId, id));
  await db
    .delete(s.paymentMethodSettings)
    .where(eq(s.paymentMethodSettings.artistId, id));
  await db
    .delete(s.artistPracticeSessions)
    .where(eq(s.artistPracticeSessions.artistId, id));
  await db
    .update(s.artistSettings)
    .set({
      businessName: null,
      displayName: null,
      businessAddress: null,
      businessEmail: null,
      bsb: null,
      accountNumber: null,
      publicSlug: null,
      funnelEnabled: 0,
      funnelWelcomeMessage: null,
      funnelBannerUrl: null,
      licenceNumber: null,
      consentTemplate: null,
      medicalTemplate: null,
      form9Template: null,
      googleCalendarToken: null,
      appleCalendarUrl: null,
      travelDates: null,
      lat: null,
      lng: null,
      websiteUrl: null,
      googlePlaceId: null,
      autoSendDepositInfo: 0,
      sendAutomatedReminders: 0,
    })
    .where(eq(s.artistSettings.userId, id));
  await db
    .update(s.studios)
    .set({
      publicSlug: null,
      funnelEnabled: 0,
      logoUrl: null,
      description: null,
    })
    .where(eq(s.studios.ownerId, id));
  await db
    .update(s.offerCampaigns)
    .set({ archived: 1 })
    .where(eq(s.offerCampaigns.artistId, id));
  await db
    .update(s.products)
    .set({ isActive: 0 })
    .where(eq(s.products.artistId, id));
  await db
    .update(s.seminars)
    .set({ isActive: 0 })
    .where(eq(s.seminars.artistId, id));
  await db
    .update(s.merchants)
    .set({
      contactName: null,
      phone: null,
      address: null,
      shopifyDomain: null,
      shopifyToken: null,
      shopifyShopId: null,
      xeroTenantId: null,
      xeroAccessToken: null,
      xeroRefreshToken: null,
      xeroTokenExpiry: null,
      myobAccessToken: null,
      shippitApiKey: null,
      status: "suspended",
    })
    .where(eq(s.merchants.userId, id));

  await db
    .update(s.systemLogs)
    .set({ userId: null })
    .where(eq(s.systemLogs.userId, id));

  // Last: the person themselves. The "disabled_" role is what rejects sign-in and live sessions.
  await db
    .update(s.users)
    .set({
      name: DELETED_USER_NAME,
      email: deletedUserEmail(id),
      role: `disabled_${user.role}`,
      clerkId: null,
      googleSub: null,
      loginMethod: null,
      password: null,
      phone: null,
      avatar: null,
      bio: null,
      instagramId: null,
      instagramUsername: null,
      facebookId: null,
      facebookName: null,
      birthday: null,
      address: null,
      city: null,
      country: null,
      gender: null,
      savedSignature: null,
    })
    .where(eq(s.users.id, id));
}

/**
 * Delete the account, or refuse with every reason it cannot be deleted yet. The checks and the
 * erasure share one transaction, with the users row locked, so a booking or payment cannot slip in
 * between them through this person's own session.
 */
export async function deleteAccount(userId: string) {
  // Stripe is asked before the transaction opens so no row lock is held across the network.
  const billing = await billingBlocker(userId);
  const balanceOutstanding = await stripeBalanceOutstanding(userId);
  await withDatabaseTransaction(async db => {
    const [user] = await db
      .select({ id: schema.users.id, role: schema.users.role })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .for("update");
    if (!user || user.role.startsWith("disabled_"))
      throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
    const summary = await summarise(db, user, {
      activeSubscription: !!billing,
      stripeBalanceOutstanding: balanceOutstanding,
    });
    const blockers = deletionBlockers(summary).map(blocker =>
      // Stripe's answer says which of subscription or studio checkout is in the way.
      blocker.code === "activeSubscription" && billing
        ? { ...blocker, reason: billing }
        : blocker
    );
    if (blockers.length)
      throw new TRPCError({
        code: "CONFLICT",
        message: deletionBlockedMessage(blockers),
      });
    await erase(db, user);
  });
}
