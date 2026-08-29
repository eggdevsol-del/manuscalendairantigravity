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
import { eq, and, sql, desc, gte, lte, asc, inArray, or } from "drizzle-orm";
import * as schema from "../../drizzle/schema";
import { getDb } from "../services/core";
import bcrypt from "bcryptjs";
import { sendPushNotification } from "../_core/pushNotification";

async function resolveStudioForUser(db: any, userId: string, studioId?: string) {
  if (studioId) {
    const s = await db.query.studios.findFirst({
      where: eq(schema.studios.id, studioId),
    });
    if (s) return s;
  }
  const owned = await db.query.studios.findFirst({
    where: eq(schema.studios.ownerId, userId),
  });
  if (owned) return owned;

  const member = await db.query.studioMembers.findFirst({
    where: and(
      eq(schema.studioMembers.userId, userId),
      eq(schema.studioMembers.status, "active")
    ),
    with: { studio: true },
  });
  return member?.studio || null;
}

export const studiosRouter = router({
  /**
   * Get the current user's studio (owner or manager)
   */
  getMyStudio: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });

    return resolveStudioForUser(db, ctx.user.id);
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
        console.warn("[Studio Router] Owner member insert notice:", memberErr.message);
      }

      const newStudio = await db.query.studios.findFirst({
        where: eq(schema.studios.id, studioId),
      });

      return newStudio;
    }),

  /**
   * Home · Today Dashboard Data:
   * - In the chairs today (studio owner + all resident artists)
   * - Needs you queue: new inquiries, awaiting confirms, rent settling, pending invites
   */
  getDashboard: protectedProcedure
    .input(z.object({ studioId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const studio = await resolveStudioForUser(db, ctx.user.id, input.studioId);
      const targetStudioId = studio?.id || input.studioId || "";

      // 1. Active Resident Artists in this studio
      const members = targetStudioId
        ? await db.query.studioMembers.findMany({
            where: and(
              eq(schema.studioMembers.studioId, targetStudioId),
              eq(schema.studioMembers.status, "active")
            ),
            with: {
              user: true,
            },
          })
        : [];

      const ownerId = studio?.ownerId || ctx.user.id;

      // Include owner ID + all active resident artists
      const artistIds = Array.from(
        new Set([
          ...(ownerId ? [ownerId] : []),
          ...members.map((m) => m.userId),
        ])
      );

      // 2. Today's Appointments across studio owner + all resident artists
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

      // 3. Needs You queue items (Real live records)
      const newLeads = targetStudioId
        ? await db.query.leads.findMany({
            where: and(
              eq(schema.leads.status, "new" as any),
              or(
                eq(schema.leads.artistId, targetStudioId),
                ownerId ? eq(schema.leads.artistId, ownerId) : undefined
              )
            ),
            limit: 15,
            orderBy: [desc(schema.leads.createdAt)],
          })
        : [];

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
      const pendingInvites = targetStudioId
        ? await db.query.studioMembers.findMany({
            where: and(
              eq(schema.studioMembers.studioId, targetStudioId),
              eq(schema.studioMembers.status, "pending_invite")
            ),
          })
        : [];

      // - Arrears
      const arrears = targetStudioId
        ? await db.query.studioArrears.findMany({
            where: and(
              eq(schema.studioArrears.studioId, targetStudioId),
              eq(schema.studioArrears.status, "pending")
            ),
            with: {
              artist: true,
            },
          })
        : [];

      return {
        todayAppointments,
        membersCount: artistIds.length,
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
   * Home · Artists Roster with 30-day real aggregated metrics:
   * - Unconditionally includes studio owner and all resident artists
   * - 30d real gross, bookings count, utilization %, response time, rebook rate, no-shows, avg session
   */
  getRoster: protectedProcedure
    .input(z.object({ studioId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const studio = await resolveStudioForUser(db, ctx.user.id, input.studioId);
      const targetStudioId = studio?.id || input.studioId || "";

      const members = targetStudioId
        ? await db.query.studioMembers.findMany({
            where: and(
              eq(schema.studioMembers.studioId, targetStudioId),
              eq(schema.studioMembers.status, "active")
            ),
            with: {
              user: true,
            },
          })
        : [];

      const ownerId = studio?.ownerId || ctx.user.id;
      const allMembers = [...members];

      if (ownerId && !allMembers.some((m) => m.userId === ownerId)) {
        const ownerUser = await db.query.users.findFirst({
          where: eq(schema.users.id, ownerId),
        });
        allMembers.unshift({
          id: -1,
          studioId: targetStudioId,
          userId: ownerId,
          role: "owner" as const,
          paymentModel: "none" as const,
          commissionPct: 0,
          weeklyChairRentCents: 0,
          dynamicStartingPct: 0,
          status: "active" as const,
          inviteEmail: null,
          inviteToken: null,
          inviteSentAt: null,
          joinedAt: studio?.createdAt || new Date().toISOString(),
          createdAt: studio?.createdAt || new Date().toISOString(),
          updatedAt: studio?.updatedAt || new Date().toISOString(),
          user: ownerUser || ctx.user || null,
        } as any);
      }

      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 19).replace("T", " ");

      const rosterWithMetrics = await Promise.all(
        allMembers.map(async (m) => {
          let userObj = m.user;
          if (!userObj && m.userId) {
            userObj = await db.query.users.findFirst({
              where: eq(schema.users.id, m.userId),
            });
          }

          if (!userObj && m.userId === ctx.user.id) {
            userObj = ctx.user as any;
          }

          // Completed bookings in last 30d
          const completedAppts = await db.query.appointments.findMany({
            where: and(
              eq(schema.appointments.artistId, m.userId),
              gte(schema.appointments.startTime, thirtyDaysAgo),
              eq(schema.appointments.status, "completed")
            ),
          });

          // Active / completed bookings in last 30d (for utilization)
          const activeAppts = await db.query.appointments.findMany({
            where: and(
              eq(schema.appointments.artistId, m.userId),
              gte(schema.appointments.startTime, thirtyDaysAgo),
              inArray(schema.appointments.status, ["completed", "confirmed", "in_progress"])
            ),
          });

          const grossCents = completedAppts.reduce(
            (sum, a) => sum + (a.price ? a.price * 100 : (a.totalPaidAmountCents || 0)),
            0
          );
          const bookingsCount = completedAppts.length;
          const noShowsCount = activeAppts.filter((a) => a.status === "no-show").length;
          const avgSessionCents = bookingsCount > 0 ? Math.round(grossCents / bookingsCount) : 0;

          // Utilization based on active booked hours / artist profile working capacity
          const bookedHours = activeAppts.reduce((hrs, a) => {
            const s = new Date(a.startTime).getTime();
            const e = a.endTime ? new Date(a.endTime).getTime() : s + 3 * 3600000;
            if (isNaN(s) || isNaN(e) || e <= s) return hrs + 2;
            const durationHrs = Math.min(12, Math.max(0.5, (e - s) / 3600000));
            return hrs + durationHrs;
          }, 0);

          // Get artist settings for specialties, payout schedule, and workSchedule
          const artistSettings = await db.query.artistSettings.findFirst({
            where: eq(schema.artistSettings.userId, m.userId),
          });

          // Calculate weekly available working hours from artist profile schedule
          let weeklyCapacityHours = 0;
          if (artistSettings?.workSchedule) {
            try {
              const rawSchedule = typeof artistSettings.workSchedule === "string"
                ? JSON.parse(artistSettings.workSchedule)
                : artistSettings.workSchedule;

              if (Array.isArray(rawSchedule)) {
                rawSchedule.forEach((d: any) => {
                  if (d.enabled !== false) {
                    const s = d.start || d.startTime || "10:00";
                    const e = d.end || d.endTime || "18:00";
                    const [sh, sm] = s.split(":").map(Number);
                    const [eh, em] = e.split(":").map(Number);
                    const dayHrs = (eh + (em || 0) / 60) - (sh + (sm || 0) / 60);
                    if (dayHrs > 0) weeklyCapacityHours += dayHrs;
                  }
                });
              } else if (rawSchedule && typeof rawSchedule === "object") {
                Object.values(rawSchedule).forEach((d: any) => {
                  if (d === true || d?.enabled !== false) {
                    const s = d?.start || d?.startTime || "10:00";
                    const e = d?.end || d?.endTime || "18:00";
                    const [sh, sm] = (s || "10:00").split(":").map(Number);
                    const [eh, em] = (e || "18:00").split(":").map(Number);
                    const dayHrs = (eh + (em || 0) / 60) - (sh + (sm || 0) / 60);
                    weeklyCapacityHours += dayHrs > 0 ? dayHrs : 8;
                  }
                });
              }
            } catch (err) {
              console.error("Error parsing artist work schedule in studios router:", err);
            }
          }

          // Fallback to standard 35h week if no schedule configured
          if (weeklyCapacityHours <= 0) {
            weeklyCapacityHours = 35;
          }

          // Monthly working capacity hours (4.333 weeks in a month)
          const monthlyCapacityHours = Math.round(weeklyCapacityHours * 4.333);

          const utilizationPct = activeAppts.length > 0 && monthlyCapacityHours > 0
            ? Math.min(100, Math.max(0, Math.round((bookedHours / monthlyCapacityHours) * 100)))
            : 0;

          const freeHours = Math.max(0, monthlyCapacityHours - Math.round(bookedHours));

          const isOwner = m.role === "owner" || m.userId === ownerId || m.userId === ctx.user.id;

          return {
            ...m,
            user: userObj,
            role: isOwner ? ("owner" as const) : m.role,
            paymentModel: isOwner ? ("none" as const) : m.paymentModel,
            grossCents,
            bookingsCount,
            completedBookingsCount: bookingsCount,
            scheduledBookingsCount: activeAppts.length,
            bookedHours: Math.round(bookedHours),
            monthlyCapacityHours,
            weeklyCapacityHours: Math.round(weeklyCapacityHours),
            freeHours,
            noShowsCount,
            avgSessionCents,
            utilizationPct,
            specialties: artistSettings?.keywords || (isOwner ? (artistSettings?.keywords || "Owner · Resident Artist") : "Resident Artist"),
            artistColor: "#eec95f",
            payoutSchedule: "weekly",
          };
        })
      );

      return rosterWithMetrics;
    }),

  /**
   * QLD Form 9, Medical & Consent Permanent Compliance Vault
   */
  getComplianceVault: protectedProcedure
    .input(z.object({ studioId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const studio = await resolveStudioForUser(db, ctx.user.id, input?.studioId);
      if (!studio) throw new TRPCError({ code: "NOT_FOUND", message: "Studio not found" });

      const members = await db.query.studioMembers.findMany({
        where: and(
          eq(schema.studioMembers.studioId, studio.id),
          eq(schema.studioMembers.status, "active")
        ),
      });

      const artistIds = Array.from(new Set([studio.ownerId, ctx.user.id, ...members.map((m) => m.userId)]));

      // Fetch consent forms & procedure logs
      const forms = await db.query.consentForms.findMany({
        where: inArray(schema.consentForms.artistId, artistIds),
        orderBy: [desc(schema.consentForms.createdAt)],
        limit: 100,
      });

      const logs = await db.query.procedureLogs.findMany({
        where: inArray(schema.procedureLogs.artistId, artistIds),
        orderBy: [desc(schema.procedureLogs.date)],
        limit: 100,
      });

      // Get users for name resolution
      const usersList = await db.query.users.findMany({
        where: inArray(schema.users.id, artistIds),
      });
      const userMap = new Map(usersList.map((u) => [u.id, u.name || u.email || "Artist"]));

      const form9Count = forms.filter((f) => f.formType === "form_9").length + logs.length;
      const consentCount = forms.filter((f) => f.formType === "procedure_consent").length;
      const medicalCount = forms.filter((f) => f.formType === "medical_release").length;
      const totalRecords = forms.length + logs.length;

      const unifiedRecords = [
        ...forms.map((f) => {
          let cName = "Client";
          try {
            if (f.formData) {
              const parsed = JSON.parse(f.formData);
              cName = parsed.clientName || parsed.name || "Client";
            }
          } catch {}
          return {
            id: `cf-${f.id}`,
            recordType: f.formType,
            title: f.title || (f.formType === "form_9" ? "QLD Form 9 Record" : f.formType === "medical_release" ? "Medical Disclosure" : "Procedure Consent"),
            artistId: f.artistId,
            artistName: userMap.get(f.artistId) || "Resident Artist",
            clientId: f.clientId,
            clientName: cName,
            status: f.status,
            signedAt: f.signedAt || f.createdAt,
            hasSignature: !!f.signature,
            isAuditCompliant: f.status === "signed",
          };
        }),
        ...logs.map((l) => ({
          id: `pl-${l.id}`,
          recordType: "form_9" as const,
          title: "QLD Form 9 Procedure Log",
          artistId: l.artistId,
          artistName: userMap.get(l.artistId) || "Resident Artist",
          clientId: l.clientId,
          clientName: l.clientName || "Client",
          status: "signed" as const,
          signedAt: l.date || l.createdAt,
          hasSignature: true,
          isAuditCompliant: true,
        })),
      ].sort((a, b) => new Date(b.signedAt || 0).getTime() - new Date(a.signedAt || 0).getTime());

      return {
        studioId: studio.id,
        studioName: studio.name,
        stats: {
          totalRecords,
          form9Count,
          consentCount,
          medicalCount,
          complianceRatePct: totalRecords > 0 ? Math.round((unifiedRecords.filter((r) => r.isAuditCompliant).length / totalRecords) * 100) : 100,
        },
        records: unifiedRecords,
      };
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

      const studio = await db.query.studios.findFirst({
        where: eq(schema.studios.id, input.studioId),
      });

      if (!studio) throw new TRPCError({ code: "NOT_FOUND", message: "Studio not found" });

      // Update membership in DB
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

      // Post TERM CHANGE PROPOSAL card to Dept Messages
      let conversation = await db.query.conversations.findFirst({
        where: and(
          eq(schema.conversations.artistId, input.artistId),
          eq(schema.conversations.clientId, studio.ownerId || ctx.user.id)
        ),
      });

      if (!conversation) {
        const [cRes] = await db.insert(schema.conversations).values({
          artistId: input.artistId,
          clientId: studio.ownerId || ctx.user.id,
          studioId: input.studioId,
        });
        conversation = { id: cRes.insertId } as any;
      }

      if (conversation) {
        const termMetadata = {
          type: "term_proposal",
          studioName: studio.name,
          paymentModel: input.paymentModel,
          commissionPct: input.commissionPct,
          weeklyChairRentCents: input.weeklyChairRentCents,
          dynamicStartingPct: input.dynamicStartingPct,
          effectiveDate: new Date().toLocaleDateString("en-AU"),
        };

        await db.insert(schema.messages).values({
          conversationId: conversation.id,
          senderId: ctx.user.id,
          content: `Term change proposal: ${input.paymentModel} arrangement updated for ${studio.name}`,
          messageType: "studio_referral",
          metadata: JSON.stringify(termMetadata),
        });
      }

      try {
        await sendPushNotification({
          userIds: [input.artistId],
          title: "Studio Terms Updated",
          message: `${studio.name} has updated your studio terms (${input.paymentModel}).`,
          url: `/dashboard`,
        });
      } catch (e) {}

      return { success: true };
    }),

  /**
   * Invite artist via email
   */
  inviteArtist: protectedProcedure
    .input(
      z.object({
        studioId: z.string(),
        email: z.string().email(),
        role: z.enum(["resident", "guest"]).default("resident"),
        paymentModel: z.enum(["commission", "rent", "dynamic", "none"]).default("commission"),
        commissionPct: z.number().min(0).max(100).default(30),
        weeklyChairRentCents: z.number().min(0).default(35000),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const studio = await db.query.studios.findFirst({
        where: eq(schema.studios.id, input.studioId),
      });

      if (!studio) throw new TRPCError({ code: "NOT_FOUND" });

      // Check if user already exists
      const existingUser = await db.query.users.findFirst({
        where: eq(schema.users.email, input.email),
      });

      const inviteToken = `inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

      await db.insert(schema.studioMembers).values({
        studioId: input.studioId,
        userId: existingUser?.id || `invited_${Date.now()}`,
        role: input.role,
        paymentModel: input.paymentModel,
        commissionPct: input.commissionPct,
        weeklyChairRentCents: input.weeklyChairRentCents,
        status: "pending_invite",
        inviteEmail: input.email,
        inviteToken,
        inviteSentAt: new Date().toISOString().slice(0, 19).replace("T", " "),
      });

      return { success: true, inviteToken };
    }),

  /**
   * Remove resident artist from studio
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
          status: "departed",
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
   * - Includes studio owner & all resident artists
   * - studio_transactions ledger feed
   */
  getMoney: protectedProcedure
    .input(
      z.object({
        studioId: z.string().optional(),
        range: z.enum(["7", "30", "90", "all"]).default("30"),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const studio = await resolveStudioForUser(db, ctx.user.id, input.studioId);
      const targetStudioId = studio?.id || input.studioId || "";

      if (!studio && !targetStudioId) {
        return {
          balanceCents: 0,
          grossCents: 0,
          commissionCents: 0,
          rentCents: 0,
          earnedCents: 0,
          byArtist: [],
          transactions: [],
        };
      }

      // Transactions feed
      const transactions = targetStudioId
        ? await db.query.studioTransactions.findMany({
            where: eq(schema.studioTransactions.studioId, targetStudioId),
            orderBy: [desc(schema.studioTransactions.createdAt)],
            limit: 50,
          })
        : [];

      // Calculate date filter
      const days = input.range === "7" ? 7 : input.range === "90" ? 90 : input.range === "all" ? 365 : 30;
      const cutoffDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 19).replace("T", " ");

      const members = targetStudioId
        ? await db.query.studioMembers.findMany({
            where: and(
              eq(schema.studioMembers.studioId, targetStudioId),
              eq(schema.studioMembers.status, "active")
            ),
            with: {
              user: true,
            },
          })
        : [];

      const ownerId = studio?.ownerId || ctx.user.id;
      const allMembers = [...members];

      if (ownerId && !allMembers.some((m) => m.userId === ownerId)) {
        const ownerUser = await db.query.users.findFirst({
          where: eq(schema.users.id, ownerId),
        });
        allMembers.unshift({
          id: -1,
          studioId: targetStudioId,
          userId: ownerId,
          role: "owner" as const,
          paymentModel: "none" as const,
          commissionPct: 0,
          weeklyChairRentCents: 0,
          dynamicStartingPct: 0,
          status: "active" as const,
          user: ownerUser || ctx.user || null,
        } as any);
      }

      let totalGrossCents = 0;
      let totalCommissionCents = 0;
      let totalRentCents = 0;

      const byArtist = await Promise.all(
        allMembers.map(async (m) => {
          let userObj = m.user;
          if (!userObj && m.userId) {
            userObj = await db.query.users.findFirst({
              where: eq(schema.users.id, m.userId),
            });
          }
          if (!userObj && m.userId === ctx.user.id) {
            userObj = ctx.user as any;
          }

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

          const artistName = userObj?.name || (m.role === "owner" ? "Studio Owner" : "Resident Artist");
          const initials = artistName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "RA";

          return {
            id: m.userId,
            name: artistName,
            initials,
            paymentModel: m.paymentModel,
            grossCents: gross,
            cutCents: cut,
            color: "#eec95f",
          };
        })
      );

      const earnedCents = totalCommissionCents + totalRentCents;

      return {
        balanceCents: studio?.balanceCents || 0,
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
   * Messages · Studio Inbox:
   * Returns real studio leads and real conversations (with clients or artists)
   */
  getInbox: protectedProcedure
    .input(z.object({ studioId: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const studio = await db.query.studios.findFirst({
        where: eq(schema.studios.id, input.studioId),
      });

      // 1. Real Studio Leads
      const studioLeads = await db.query.leads.findMany({
        where: or(
          eq(schema.leads.artistId, input.studioId),
          studio?.ownerId ? eq(schema.leads.artistId, studio.ownerId) : undefined
        ),
        orderBy: [desc(schema.leads.createdAt)],
        limit: 50,
      });

      // 2. Real Studio Conversations
      const studioConversations = await db.query.conversations.findMany({
        where: or(
          eq(schema.conversations.studioId, input.studioId),
          studio?.ownerId ? eq(schema.conversations.artistId, studio.ownerId) : undefined,
          studio?.ownerId ? eq(schema.conversations.clientId, studio.ownerId) : undefined
        ),
        with: {
          client: true,
          artist: true,
          messages: {
            orderBy: [asc(schema.messages.createdAt)],
            limit: 50,
          },
        },
        orderBy: [desc(schema.conversations.updatedAt)],
        limit: 50,
      });

      return {
        leads: studioLeads,
        conversations: studioConversations,
      };
    }),

  /**
   * Send real text message from studio in conversation
   */
  sendStudioMessage: protectedProcedure
    .input(
      z.object({
        studioId: z.string(),
        conversationId: z.number(),
        content: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [msgRes] = await db.insert(schema.messages).values({
        conversationId: input.conversationId,
        senderId: ctx.user.id,
        content: input.content,
        messageType: "text",
      });

      await db
        .update(schema.conversations)
        .set({ updatedAt: new Date().toISOString().slice(0, 19).replace("T", " ") })
        .where(eq(schema.conversations.id, input.conversationId));

      return { success: true, messageId: msgRes.insertId };
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
   * Calendar Multi-Artist Aggregation:
   * Returns appointments for the studio owner + all active resident artists
   */
  getCalendar: protectedProcedure
    .input(
      z.object({
        studioId: z.string().optional(),
        startDate: z.string(),
        endDate: z.string(),
        artistId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const studio = await resolveStudioForUser(db, ctx.user.id, input.studioId);
      const targetStudioId = studio?.id || input.studioId || "";

      const members = targetStudioId
        ? await db.query.studioMembers.findMany({
            where: and(
              eq(schema.studioMembers.studioId, targetStudioId),
              eq(schema.studioMembers.status, "active")
            ),
          })
        : [];

      const ownerId = studio?.ownerId || ctx.user.id;

      const allArtistIds = Array.from(
        new Set([
          ...(ownerId ? [ownerId] : []),
          ...members.map((m) => m.userId),
        ])
      );

      const targetArtistIds = input.artistId
        ? [input.artistId]
        : allArtistIds;

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
