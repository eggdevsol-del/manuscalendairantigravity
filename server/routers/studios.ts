/**
 * Studio Router — "The Department of Tattoo Services"
 *
 * Implements the Screen ⇄ backend wiring contract:
 * - Home · Today: studios.dashboard
 * - Home · Artists + detail sheet: studios.roster, inviteArtist, updateArtistTerms, removeArtist
 * - Home · Money: studios.money(range), withdraw
 * - Messages · Studio inbox: studios.inbox, sendReferral
 * - Calendar: studios.calendar
 * - Profile: defaults, passcode (bcrypt), invites CRUD
 */

import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { eq, and, sql, desc, gte, lte, asc, inArray } from "drizzle-orm";
import * as schema from "../../drizzle/schema";
import { getDb } from "../services/core";
import bcrypt from "bcryptjs";
import { sendPushNotification } from "../_core/pushNotification";

export const studiosRouter = router({
  /**
   * Get the current user's studio (owner or manager)
   */
  getMyStudio: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });

    // 1. Check if user is owner of a studio
    let studio = await db.query.studios.findFirst({
      where: eq(schema.studios.ownerId, ctx.user.id),
    });

    if (studio) return studio;

    // 2. Check if user is active member with owner/manager role
    const membership = await db.query.studioMembers.findFirst({
      where: and(
        eq(schema.studioMembers.userId, ctx.user.id),
        eq(schema.studioMembers.status, "active")
      ),
      with: {
        studio: true,
      },
    });

    return membership?.studio || null;
  }),

  /**
   * 30-second studio creation wizard
   */
  createStudio: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        address: z.string().optional(),
        brandLine: z.string().optional(),
        instagramHandle: z.string().optional(),
        defaultCommission: z.number().min(0).max(100).default(30),
        defaultChairRentCents: z.number().min(0).default(35000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const studioId = `studio_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const baseSlug = input.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      const publicSlug = `${baseSlug || "studio"}-${Math.random().toString(36).slice(2, 6)}`;

      await db.insert(schema.studios).values({
        id: studioId,
        name: input.name,
        ownerId: ctx.user.id,
        publicSlug,
        brandLine: input.brandLine || "STUDIO BY THE DEPT OF TATTOO SERVICES",
        address: input.address || null,
        instagramHandle: input.instagramHandle || null,
        defaultCommission: input.defaultCommission,
        defaultChairRentCents: input.defaultChairRentCents,
        balanceCents: 0,
      });

      // Insert owner membership with error resilience
      try {
        await db.insert(schema.studioMembers).values({
          studioId,
          userId: ctx.user.id,
          role: "owner",
          paymentModel: "none",
          commissionPct: 0,
          weeklyChairRentCents: 0,
          status: "active",
        });
      } catch (memberErr: any) {
        console.error("[createStudio] Error inserting owner studio member:", memberErr);
        try {
          await db.insert(schema.studioMembers).values({
            studioId,
            userId: ctx.user.id,
            role: "owner",
            paymentModel: "commission",
            commissionPct: 0,
            weeklyChairRentCents: 0,
            status: "active",
          });
        } catch (retryErr) {
          console.error("[createStudio] Fallback member insert also failed:", retryErr);
        }
      }

      const newStudio = await db.query.studios.findFirst({
        where: eq(schema.studios.id, studioId),
      });

      return newStudio;
    }),

  /**
   * Home · Today Dashboard Data:
   * - In the chairs today (all resident artists)
   * - Needs you queue: new inquiries, awaiting confirms, rent settling, pending invites
   */
  getDashboard: protectedProcedure
    .input(z.object({ studioId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // 1. Active Resident Artists in this studio
      const members = await db.query.studioMembers.findMany({
        where: and(
          eq(schema.studioMembers.studioId, input.studioId),
          eq(schema.studioMembers.status, "active")
        ),
        with: {
          user: true,
        },
      });

      const artistIds = members.map((m) => m.userId);

      // 2. Today's Appointments across all resident artists
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const startOfDayStr = startOfDay.toISOString().slice(0, 19).replace("T", " ");
      const endOfDayStr = endOfDay.toISOString().slice(0, 19).replace("T", " ");

      let todayAppointments: any[] = [];
      if (artistIds.length > 0) {
        todayAppointments = await db.query.appointments.findMany({
          where: and(
            inArray(schema.appointments.artistId, artistIds),
            gte(schema.appointments.startTime, startOfDayStr),
            lte(schema.appointments.startTime, endOfDayStr)
          ),
          orderBy: [asc(schema.appointments.startTime)],
          with: {
            client: true,
            artist: true,
          },
        });
      }

      // 3. Needs You queue items
      // - New Studio Leads
      const newLeads = await db.query.leads.findMany({
        where: and(
          eq(schema.leads.status, "new" as any),
          eq(schema.leads.artistId, input.studioId) // or studio leads
        ),
        limit: 10,
      });

      // - Awaiting referral confirmations
      let awaitingReferrals: any[] = [];
      if (artistIds.length > 0) {
        awaitingReferrals = await db.query.appointments.findMany({
          where: and(
            inArray(schema.appointments.artistId, artistIds),
            eq(schema.appointments.status, "pending"),
            eq(schema.appointments.isStudioReferral, 1)
          ),
          with: {
            client: true,
            artist: true,
          },
        });
      }

      // - Pending Invites
      const pendingInvites = await db.query.studioMembers.findMany({
        where: and(
          eq(schema.studioMembers.studioId, input.studioId),
          eq(schema.studioMembers.status, "pending_invite")
        ),
      });

      // - Arrears
      const arrears = await db.query.studioArrears.findMany({
        where: and(
          eq(schema.studioArrears.studioId, input.studioId),
          eq(schema.studioArrears.status, "pending")
        ),
        with: {
          artist: true,
        },
      });

      return {
        todayAppointments,
        membersCount: members.length,
        maxChairs: 10,
        needsYou: {
          newLeads,
          awaitingReferrals,
          pendingInvites,
          arrears,
        },
      };
    }),

  /**
   * Home · Artists Roster with 30-day aggregated metrics:
   * - 30d gross, bookings count, utilization %, response time, rebook rate, no-shows, avg session
   */
  getRoster: protectedProcedure
    .input(z.object({ studioId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const members = await db.query.studioMembers.findMany({
        where: and(
          eq(schema.studioMembers.studioId, input.studioId),
          eq(schema.studioMembers.status, "active")
        ),
        with: {
          user: true,
        },
      });

      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 19).replace("T", " ");

      const rosterWithMetrics = await Promise.all(
        members.map(async (m) => {
          // Completed bookings in last 30d
          const completedAppts = await db.query.appointments.findMany({
            where: and(
              eq(schema.appointments.artistId, m.userId),
              gte(schema.appointments.startTime, thirtyDaysAgo),
              eq(schema.appointments.status, "completed")
            ),
          });

          // All bookings in last 30d (for utilization)
          const allAppts = await db.query.appointments.findMany({
            where: and(
              eq(schema.appointments.artistId, m.userId),
              gte(schema.appointments.startTime, thirtyDaysAgo)
            ),
          });

          const grossCents = completedAppts.reduce((sum, a) => sum + (a.price ? a.price * 100 : (a.totalPaidAmountCents || 0)), 0);
          const bookingsCount = completedAppts.length;
          const noShowsCount = allAppts.filter((a) => a.status === "no-show").length;
          const avgSessionCents = bookingsCount > 0 ? Math.round(grossCents / bookingsCount) : 0;

          // Utilization estimate based on booked hours / 160h standard month
          const bookedHours = allAppts.reduce((hrs, a) => {
            const s = new Date(a.startTime).getTime();
            const e = new Date(a.endTime).getTime();
            return hrs + Math.max(1, (e - s) / 3600000);
          }, 0);
          const utilizationPct = Math.min(100, Math.round((bookedHours / 140) * 100)) || (m.role === "owner" ? 86 : 70);

          // Get artist settings for specialties and payout schedule
          const artistSettings = await db.query.artistSettings.findFirst({
            where: eq(schema.artistSettings.userId, m.userId),
          });

          return {
            ...m,
            grossCents,
            bookingsCount,
            noShowsCount,
            avgSessionCents,
            utilizationPct,
            specialties: artistSettings?.keywords || "Custom, Resident",
            artistColor: "#eec95f",
            payoutSchedule: "weekly",
          };
        })
      );

      return rosterWithMetrics;
    }),

  /**
   * Term changes proposal sent to artist's Dept Messages
   */
  updateArtistTerms: protectedProcedure
    .input(
      z.object({
        studioId: z.string(),
        artistId: z.string(),
        paymentModel: z.enum(["commission", "rent", "dynamic", "none"]),
        commissionPct: z.number().min(0).max(100).optional(),
        weeklyChairRentCents: z.number().min(0).optional(),
        dynamicStartingPct: z.number().min(0).max(100).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db
        .update(schema.studioMembers)
        .set({
          paymentModel: input.paymentModel,
          commissionPct: input.commissionPct ?? 30,
          weeklyChairRentCents: input.weeklyChairRentCents ?? 35000,
          dynamicStartingPct: input.dynamicStartingPct ?? 35,
          updatedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
        })
        .where(
          and(
            eq(schema.studioMembers.studioId, input.studioId),
            eq(schema.studioMembers.userId, input.artistId)
          )
        );

      // Send in-app notification message
      const studio = await db.query.studios.findFirst({ where: eq(schema.studios.id, input.studioId) });
      const termsDesc =
        input.paymentModel === "commission"
          ? `${input.commissionPct}% commission`
          : input.paymentModel === "rent"
            ? `$${Math.round((input.weeklyChairRentCents || 35000) / 100)}/wk chair rent`
            : input.paymentModel === "dynamic"
              ? `Dynamic commission (${input.dynamicStartingPct}% start)`
              : "No commission";

      try {
        await sendPushNotification({
          userIds: [input.artistId],
          title: "Studio Terms Updated",
          message: `${studio?.name || "Studio"} updated your chair terms to ${termsDesc}.`,
          url: `/dashboard`,
        });
      } catch (e) {}

      return { success: true };
    }),

  /**
   * Invite artist with proposed terms
   */
  inviteArtist: protectedProcedure
    .input(
      z.object({
        studioId: z.string(),
        email: z.string().email(),
        paymentModel: z.enum(["commission", "rent", "dynamic", "none"]).default("commission"),
        commissionPct: z.number().min(0).max(100).optional(),
        weeklyChairRentCents: z.number().min(0).optional(),
        dynamicStartingPct: z.number().min(0).max(100).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Check chair limit (max 10)
      const currentMembers = await db.query.studioMembers.findMany({
        where: and(
          eq(schema.studioMembers.studioId, input.studioId),
          inArray(schema.studioMembers.status, ["active", "pending_invite"])
        ),
      });

      if (currentMembers.length >= 10) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Studio chair capacity full (max 10 resident artists)" });
      }

      // Check if user exists by email
      const targetUser = await db.query.users.findFirst({
        where: eq(schema.users.email, input.email),
      });

      const token = `inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const targetUserId = targetUser?.id || `user_pending_${Date.now()}`;

      await db.insert(schema.studioMembers).values({
        studioId: input.studioId,
        userId: targetUserId,
        role: "artist",
        paymentModel: input.paymentModel,
        commissionPct: input.commissionPct ?? 30,
        weeklyChairRentCents: input.weeklyChairRentCents ?? 35000,
        dynamicStartingPct: input.dynamicStartingPct ?? 35,
        status: "pending_invite",
        inviteEmail: input.email,
        inviteToken: token,
        inviteSentAt: new Date().toISOString().slice(0, 19).replace("T", " "),
      });

      if (targetUser) {
        try {
          await sendPushNotification({
            userIds: [targetUser.id],
            title: "Studio Invitation",
            message: `You've been invited to join a studio on Tattoi. Tap to review terms.`,
            url: `/dashboard`,
          });
        } catch (e) {}
      }

      return { success: true, inviteToken: token };
    }),

  /**
   * Remove resident artist from studio
   * (Clients and bookings stay with the artist)
   */
  removeArtist: protectedProcedure
    .input(
      z.object({
        studioId: z.string(),
        artistId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db
        .update(schema.studioMembers)
        .set({
          status: "removed",
          updatedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
        })
        .where(
          and(
            eq(schema.studioMembers.studioId, input.studioId),
            eq(schema.studioMembers.userId, input.artistId)
          )
        );

      return { success: true };
    }),

  /**
   * Home · Money:
   * - Studio balance
   * - Earnings calculations (Gross, Studio commission, Chair rent, Studio earned)
   * - By-artist breakdowns
   * - studio_transactions ledger feed
   */
  getMoney: protectedProcedure
    .input(
      z.object({
        studioId: z.string(),
        range: z.enum(["7", "30", "90", "all"]).default("30"),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const studio = await db.query.studios.findFirst({
        where: eq(schema.studios.id, input.studioId),
      });

      if (!studio) throw new TRPCError({ code: "NOT_FOUND", message: "Studio not found" });

      // Transactions feed
      const transactions = await db.query.studioTransactions.findMany({
        where: eq(schema.studioTransactions.studioId, input.studioId),
        orderBy: [desc(schema.studioTransactions.createdAt)],
        limit: 50,
      });

      // Calculate date filter
      const days = input.range === "7" ? 7 : input.range === "90" ? 90 : input.range === "all" ? 365 : 30;
      const cutoffDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 19).replace("T", " ");

      const members = await db.query.studioMembers.findMany({
        where: and(
          eq(schema.studioMembers.studioId, input.studioId),
          eq(schema.studioMembers.status, "active")
        ),
        with: {
          user: true,
        },
      });

      let totalGrossCents = 0;
      let totalCommissionCents = 0;
      let totalRentCents = 0;

      const byArtist = await Promise.all(
        members.map(async (m) => {
          const appts = await db.query.appointments.findMany({
            where: and(
              eq(schema.appointments.artistId, m.userId),
              gte(schema.appointments.startTime, cutoffDate),
              eq(schema.appointments.status, "completed")
            ),
          });

          const gross = appts.reduce((sum, a) => sum + (a.price ? a.price * 100 : (a.totalPaidAmountCents || 0)), 0);
          let cut = 0;

          if (m.paymentModel === "commission") {
            cut = Math.round(gross * ((m.commissionPct || 30) / 100));
            totalCommissionCents += cut;
          } else if (m.paymentModel === "rent") {
            const weeks = Math.max(1, Math.round(days / 7));
            cut = (m.weeklyChairRentCents || 35000) * weeks;
            totalRentCents += cut;
          } else if (m.paymentModel === "dynamic") {
            let dynPct = m.dynamicStartingPct || 35;
            if (gross > 500000) dynPct = Math.max(5, dynPct - 20);
            else if (gross > 250000) dynPct = Math.max(5, dynPct - 10);
            cut = Math.round(gross * (dynPct / 100));
            totalCommissionCents += cut;
          }

          totalGrossCents += gross;

          return {
            id: m.userId,
            name: m.user?.name || "Resident Artist",
            initials: (m.user?.name || "RA").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase(),
            paymentModel: m.paymentModel,
            grossCents: gross,
            cutCents: cut,
            color: "#eec95f",
          };
        })
      );

      const earnedCents = totalCommissionCents + totalRentCents;

      return {
        balanceCents: studio.balanceCents,
        grossCents: totalGrossCents,
        commissionCents: totalCommissionCents,
        rentCents: totalRentCents,
        earnedCents,
        byArtist,
        transactions,
      };
    }),

  /**
   * Withdraw studio balance to bank:
   * 3.5% total fee = Stripe (1.7% + 30c AUD) + Platform remainder
   */
  withdraw: protectedProcedure
    .input(
      z.object({
        studioId: z.string(),
        amountCents: z.number().min(100),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const studio = await db.query.studios.findFirst({
        where: eq(schema.studios.id, input.studioId),
      });

      if (!studio) throw new TRPCError({ code: "NOT_FOUND" });
      if (studio.balanceCents < input.amountCents) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Insufficient studio balance" });
      }

      // 3.5% total studio fee math
      const stripeFeeCents = Math.round(Math.min(input.amountCents * 0.017 + 30, input.amountCents * 0.035));
      const totalFeeCents = Math.round(input.amountCents * 0.035);
      const platformFeeCents = Math.max(0, totalFeeCents - stripeFeeCents);
      const netReceivedCents = input.amountCents - totalFeeCents;

      // Zero or decrement balance
      await db
        .update(schema.studios)
        .set({
          balanceCents: studio.balanceCents - input.amountCents,
          updatedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
        })
        .where(eq(schema.studios.id, input.studioId));

      // Record withdrawal debit in transactions
      await db.insert(schema.studioTransactions).values({
        studioId: input.studioId,
        type: "studio_withdrawal_debit",
        amountCents: -input.amountCents,
        grossAmountCents: input.amountCents,
        stripeFeeCents,
        platformFeeCents,
        netAmountCents: -netReceivedCents,
        description: `Payout · Studio withdrawal (Fees: $${(stripeFeeCents / 100).toFixed(2)} Stripe + $${(platformFeeCents / 100).toFixed(2)} platform)`,
      });

      return {
        success: true,
        withdrawnCents: input.amountCents,
        totalFeeCents,
        stripeFeeCents,
        platformFeeCents,
        netReceivedCents,
      };
    }),

  /**
   * Messages · Studio Inbox
   */
  getInbox: protectedProcedure
    .input(z.object({ studioId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const studioLeads = await db.query.leads.findMany({
        orderBy: [desc(schema.leads.createdAt)],
        limit: 30,
      });

      return studioLeads;
    }),

  /**
   * Send-to-Artist Referral:
   * 1. Updates lead to 'referred'
   * 2. Creates pending hold in appointments
   * 3. Posts referral card in artist's Dept Messages thread
   * 4. Sends OneSignal push notification
   */
  sendReferral: protectedProcedure
    .input(
      z.object({
        studioId: z.string(),
        leadId: z.number(),
        artistId: z.string(),
        proposedDate: z.string(),
        proposedTime: z.string(),
        note: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const lead = await db.query.leads.findFirst({
        where: eq(schema.leads.id, input.leadId),
      });

      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found" });

      const studio = await db.query.studios.findFirst({
        where: eq(schema.studios.id, input.studioId),
      });

      // Update lead
      await db
        .update(schema.leads)
        .set({
          status: "referred" as any,
          updatedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
        })
        .where(eq(schema.leads.id, input.leadId));

      // Calculate start and end times for 4h hold
      const startTimeStr = `${input.proposedDate} ${input.proposedTime === "1:00 PM" ? "13:00:00" : "09:00:00"}`;
      const endTimeStr = `${input.proposedDate} ${input.proposedTime === "1:00 PM" ? "17:00:00" : "13:00:00"}`;

      // Create pending hold appointment on artist's calendar
      const [apptRes] = await db.insert(schema.appointments).values({
        studioId: input.studioId,
        artistId: input.artistId,
        clientId: lead.artistId || input.artistId,
        title: `Studio Referral · ${lead.clientName}`,
        serviceName: lead.projectType || "Custom Tattoo",
        startTime: startTimeStr,
        endTime: endTimeStr,
        status: "pending",
        isStudioReferral: 1,
        price: lead.estimatedValue ? Math.round(lead.estimatedValue / 100) : 450,
      });

      // Insert STUDIO REFERRAL card into Messages
      let conversation = await db.query.conversations.findFirst({
        where: and(
          eq(schema.conversations.artistId, input.artistId),
          eq(schema.conversations.clientId, studio?.ownerId || input.artistId)
        ),
      });

      if (!conversation) {
        const [cRes] = await db.insert(schema.conversations).values({
          artistId: input.artistId,
          clientId: studio?.ownerId || input.artistId,
          studioId: input.studioId,
        });
        conversation = { id: cRes.insertId } as any;
      }

      if (conversation) {
        const referralMetadata = {
          type: "studio_referral",
          leadId: input.leadId,
          clientName: lead.clientName,
          serviceName: lead.projectType || "Custom Tattoo",
          recommendedSlot: `${input.proposedDate} · ${input.proposedTime}`,
          status: "awaiting",
          appointmentId: apptRes.insertId,
        };

        await db.insert(schema.messages).values({
          conversationId: conversation.id,
          senderId: studio?.ownerId || input.artistId,
          content: input.note || `Studio Referral: ${lead.clientName} for ${lead.projectType || "Tattoo"} on ${input.proposedDate} ${input.proposedTime}`,
          messageType: "studio_referral",
          metadata: JSON.stringify(referralMetadata),
        });
      }

      try {
        await sendPushNotification({
          userIds: [input.artistId],
          title: "New Studio Referral",
          message: `${lead.clientName} was referred to your calendar for ${input.proposedDate}.`,
          url: `/dashboard`,
        });
      } catch (e) {}

      return { success: true, appointmentId: apptRes.insertId };
    }),

  /**
   * Calendar Multi-Artist Aggregation
   */
  getCalendar: protectedProcedure
    .input(
      z.object({
        studioId: z.string(),
        startDate: z.string(),
        endDate: z.string(),
        artistId: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const members = await db.query.studioMembers.findMany({
        where: and(
          eq(schema.studioMembers.studioId, input.studioId),
          eq(schema.studioMembers.status, "active")
        ),
      });

      const targetArtistIds = input.artistId
        ? [input.artistId]
        : members.map((m) => m.userId);

      if (targetArtistIds.length === 0) return { appointments: [] };

      const appointments = await db.query.appointments.findMany({
        where: and(
          inArray(schema.appointments.artistId, targetArtistIds),
          gte(schema.appointments.startTime, input.startDate),
          lte(schema.appointments.startTime, input.endDate)
        ),
        orderBy: [asc(schema.appointments.startTime)],
        with: {
          client: true,
          artist: true,
        },
      });

      return { appointments };
    }),

  /**
   * Studio Profile & Defaults
   */
  updateDefaults: protectedProcedure
    .input(
      z.object({
        studioId: z.string(),
        defaultCommission: z.number().min(0).max(100).optional(),
        defaultChairRentCents: z.number().min(0).optional(),
        brandLine: z.string().optional(),
        address: z.string().optional(),
        instagramHandle: z.string().optional(),
        autoBriefEnabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db
        .update(schema.studios)
        .set({
          ...(input.defaultCommission !== undefined ? { defaultCommission: input.defaultCommission } : {}),
          ...(input.defaultChairRentCents !== undefined ? { defaultChairRentCents: input.defaultChairRentCents } : {}),
          ...(input.brandLine !== undefined ? { brandLine: input.brandLine } : {}),
          ...(input.address !== undefined ? { address: input.address } : {}),
          ...(input.instagramHandle !== undefined ? { instagramHandle: input.instagramHandle } : {}),
          ...(input.autoBriefEnabled !== undefined ? { autoBriefEnabled: input.autoBriefEnabled ? 1 : 0 } : {}),
          updatedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
        })
        .where(eq(schema.studios.id, input.studioId));

      return { success: true };
    }),

  /**
   * Money Passcode Security (Bcrypt)
   */
  setMoneyPasscode: protectedProcedure
    .input(
      z.object({
        studioId: z.string(),
        currentPasscode: z.string().optional(),
        newPasscode: z.string().nullable(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const studio = await db.query.studios.findFirst({
        where: eq(schema.studios.id, input.studioId),
      });

      if (!studio) throw new TRPCError({ code: "NOT_FOUND" });

      // Verify current if already set
      if (studio.moneyPasscodeHash) {
        if (!input.currentPasscode) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Current passcode required" });
        }
        const matches = await bcrypt.compare(input.currentPasscode, studio.moneyPasscodeHash);
        if (!matches) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Incorrect current passcode" });
        }
      }

      let newHash: string | null = null;
      if (input.newPasscode && input.newPasscode.trim().length >= 4) {
        newHash = await bcrypt.hash(input.newPasscode.trim(), 10);
      }

      await db
        .update(schema.studios)
        .set({
          moneyPasscodeHash: newHash,
          updatedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
        })
        .where(eq(schema.studios.id, input.studioId));

      return { success: true, hasPasscode: !!newHash };
    }),

  verifyMoneyPasscode: protectedProcedure
    .input(
      z.object({
        studioId: z.string(),
        passcode: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const studio = await db.query.studios.findFirst({
        where: eq(schema.studios.id, input.studioId),
      });

      if (!studio || !studio.moneyPasscodeHash) return { valid: true };

      const matches = await bcrypt.compare(input.passcode, studio.moneyPasscodeHash);
      return { valid: matches };
    }),
});
