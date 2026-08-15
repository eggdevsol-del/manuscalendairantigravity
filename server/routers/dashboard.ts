import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import * as schema from "../../drizzle/schema";
import { eq, and, desc, sql, count, asc, gte, lt, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";

export const dashboardRouter = router({
  getArtistOverview: protectedProcedure.query(async ({ ctx }) => {
    const { user } = ctx;
    if (user.role !== "artist" && user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    const db = await getDb();
    if (!db) {
      console.error("[Dashboard] Database connection failed");
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Database connection failed",
      });
    }

    // 1. Stats Counters
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const startOfDayIso = startOfDay.toISOString();
    const endOfDayIso = endOfDay.toISOString();

    const [appointmentsToday] = await db
      .select({ count: count() })
      .from(schema.appointments)
      .where(
        and(
          eq(schema.appointments.artistId, user.id),
          gte(schema.appointments.startTime, startOfDayIso),
          lt(schema.appointments.startTime, endOfDayIso)
        )
      );

    const [pendingRequests] = await db
      .select({ count: count() })
      .from(schema.consultations)
      .where(
        and(
          eq(schema.consultations.artistId, user.id),
          eq(schema.consultations.status, "pending"),
          eq(schema.consultations.viewed, 0)
        )
      );

    // Revenue (completed appointments)
    const [totalRevenue] = await db
      .select({ value: sql<number>`SUM(${schema.appointments.price})` })
      .from(schema.appointments)
      .where(
        and(
          eq(schema.appointments.artistId, user.id),
          eq(schema.appointments.status, "completed")
        )
      );

    // 2. Next Appointment (The very next one from now)
    const nextAppointment = await db.query.appointments.findFirst({
      where: and(
        eq(schema.appointments.artistId, user.id),
        gte(schema.appointments.startTime, new Date().toISOString()),
        eq(schema.appointments.status, "confirmed")
      ),
      orderBy: asc(schema.appointments.startTime),
      with: {
        client: true,
      },
    });

    // 3. Today's Timeline
    const todayTimeline = await db.query.appointments.findMany({
      where: and(
        eq(schema.appointments.artistId, user.id),
        gte(schema.appointments.startTime, startOfDayIso),
        lt(schema.appointments.startTime, endOfDayIso)
      ),
      orderBy: asc(schema.appointments.startTime),
      with: {
        client: true,
      },
    });

    return {
      stats: {
        appointmentsToday: appointmentsToday.count,
        pendingRequests: pendingRequests.count,
        totalRevenue: totalRevenue.value || 0,
      },
      nextAppointment,
      todayTimeline,
    };
  }),

  getClientOverview: protectedProcedure.query(async ({ ctx }) => {
    const { user } = ctx;
    const db = await getDb();
    if (!db)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Database connection failed",
      });

    // 1. Upcoming Appointment
    const nextAppointment = await db.query.appointments.findFirst({
      where: and(
        eq(schema.appointments.clientId, user.id),
        gte(schema.appointments.startTime, new Date().toISOString()),
        eq(schema.appointments.status, "confirmed")
      ),
      orderBy: asc(schema.appointments.startTime),
      with: {
        artist: true,
      },
    });

    // 2. Active Vouchers
    const activeVouchers = await db.query.issuedVouchers.findMany({
      where: and(
        eq(schema.issuedVouchers.clientId, user.id),
        eq(schema.issuedVouchers.status, "active")
      ),
      with: {
        template: true,
        artist: true,
      },
      limit: 5,
    });

    // 3. Recent Likes (for inspiration feed)
    const recentLikes = await db.query.portfolioLikes.findMany({
      where: eq(schema.portfolioLikes.userId, user.id),
      with: {
        portfolio: {
          with: {
            artist: true,
          },
        },
      },
      limit: 3,
      orderBy: desc(schema.portfolioLikes.createdAt),
    });

    return {
      nextAppointment,
      activeVouchers,
      recentLikes,
    };
  }),

  /**
   * getClientSessions — Returns ALL sessions (upcoming + completed) for a client,
   * enriched with payment cents fields and lead project details.
   * Used by the redesigned Clients tab project cards.
   */
  getClientSessions: protectedProcedure.query(async ({ ctx }) => {
    const { user } = ctx;
    if (user.role !== "artist" && user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    // Fetch ALL appointments (upcoming + completed) — not just future ones
    const allAppts = await db.query.appointments.findMany({
      where: eq(schema.appointments.artistId, user.id),
      orderBy: asc(schema.appointments.startTime),
      with: {
        client: true,
      },
      limit: 100,
    });

    // Only include appointments that have a client and are active
    const activeAppts = allAppts.filter(a =>
      a.clientId && !["cancelled"].includes(a.status)
    );

    // Get clientIds to find linked leads
    const clientIds = [...new Set(activeAppts.map(a => a.clientId))];

    // Fetch leads linked to these clients
    let linkedLeads: any[] = [];
    if (clientIds.length > 0) {
      linkedLeads = await db.query.leads.findMany({
        where: and(
          eq(schema.leads.artistId, user.id),
          inArray(schema.leads.clientId, clientIds)
        ),
        orderBy: desc(schema.leads.createdAt),
      });
    }

    // Build a map: clientId -> most relevant lead
    const leadByClient = new Map<string, any>();
    for (const lead of linkedLeads) {
      if (lead.clientId && !leadByClient.has(lead.clientId)) {
        leadByClient.set(lead.clientId, lead);
      }
    }

    // Also check leads linked by appointmentId
    const apptIds = activeAppts.map(a => a.id);
    if (apptIds.length > 0) {
      const apptLinkedLeads = await db.query.leads.findMany({
        where: and(
          eq(schema.leads.artistId, user.id),
          inArray(schema.leads.appointmentId, apptIds)
        ),
      });
      for (const lead of apptLinkedLeads) {
        const appt = activeAppts.find(a => a.id === lead.appointmentId);
        if (appt) {
          leadByClient.set(appt.clientId, lead);
        }
      }
    }

    // Merge appointments with lead data + payment fields
    return activeAppts.map(appt => {
      const lead = leadByClient.get(appt.clientId);

      // Derive cents fields — self-heal from legacy dollar amounts if needed
      const priceCents = appt.totalExpectedAmountCents || (appt.price ? appt.price * 100 : 0);
      const paidCents = appt.totalPaidAmountCents || (appt.depositPaid && appt.depositAmount ? appt.depositAmount * 100 : 0);
      const remainingCents = appt.remainingBalanceCents ?? Math.max(0, priceCents - paidCents);

      return {
        id: appt.id,
        title: appt.title,
        description: appt.description,
        serviceName: appt.serviceName,
        startTime: appt.startTime,
        endTime: appt.endTime,
        timeZone: appt.timeZone,
        status: appt.status,
        price: appt.price,
        priceCents,
        paidCents,
        remainingCents,
        depositAmount: appt.depositAmount,
        depositPaid: appt.depositPaid,
        paymentStatus: appt.paymentStatus,
        client: appt.client ? {
          id: appt.client.id,
          name: appt.client.name,
          email: appt.client.email,
          phone: appt.client.phone,
          avatar: appt.client.avatar,
          city: appt.client.city,
        } : null,
        // Lead/project details (if linked)
        project: lead ? {
          projectType: lead.projectType,
          projectDescription: lead.projectDescription,
          stylePreferences: lead.stylePreferences,
          referenceImages: lead.referenceImages,
          placement: lead.placement,
          estimatedSize: lead.estimatedSize,
          budgetLabel: lead.budgetLabel,
          status: lead.status,
        } : null,
      };
    });
  }),

  /**
   * recordManualPayment — Records a cash/bank/manual payment against a session.
   * Updates appointment balance fields + writes to payment ledger.
   */
  recordManualPayment: protectedProcedure
    .input(z.object({
      appointmentId: z.number(),
      amountCents: z.number().min(1),
      paymentMethod: z.enum(["cash", "bank"]),
    }))
    .mutation(async ({ input, ctx }) => {
      const { user } = ctx;
      if (user.role !== "artist" && user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const appointment = await db.query.appointments.findFirst({
        where: eq(schema.appointments.id, input.appointmentId),
      });
      if (!appointment) throw new TRPCError({ code: "NOT_FOUND", message: "Appointment not found" });
      if (appointment.artistId !== user.id) throw new TRPCError({ code: "FORBIDDEN" });

      // Derive current balance
      const expected = appointment.totalExpectedAmountCents || (appointment.price ? appointment.price * 100 : 0);
      const currentPaid = appointment.totalPaidAmountCents || 0;
      const newPaid = currentPaid + input.amountCents;
      const remaining = Math.max(0, expected - newPaid);
      const isFullyPaid = remaining <= 0;

      const now = new Date().toISOString().slice(0, 19).replace("T", " ");

      // Update appointment
      await db.update(schema.appointments).set({
        totalPaidAmountCents: newPaid,
        remainingBalanceCents: remaining,
        totalExpectedAmountCents: expected || undefined,
        paymentStatus: isFullyPaid ? "fully_paid" as any : "deposit_paid" as any,
        clientPaid: isFullyPaid ? 1 : 0,
        amountPaid: Math.round(newPaid / 100),
        paymentMethod: input.paymentMethod as any,
        updatedAt: now,
      }).where(eq(schema.appointments.id, input.appointmentId));

      // Write to payment ledger
      await db.insert(schema.paymentLedger).values({
        bookingId: input.appointmentId,
        artistId: user.id,
        clientId: appointment.clientId,
        transactionType: "balance",
        amountCents: input.amountCents,
        platformFeeCents: 0,
        artistFeeCents: 0,
        stripePaymentId: `manual_${Date.now()}`,
        stripeConnectAccountId: null,
        tier: "free",
        paymentMethod: input.paymentMethod,
      });

      return {
        success: true,
        newPaidCents: newPaid,
        remainingCents: remaining,
        isFullyPaid,
      };
    }),
});

