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
   * getUpcomingProjects — Returns upcoming appointments enriched with
   * client info and linked lead project details (style, placement, refs).
   * Used by the Clients tab "Upcoming Projects" section.
   */
  getUpcomingProjects: protectedProcedure.query(async ({ ctx }) => {
    const { user } = ctx;
    if (user.role !== "artist" && user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const now = new Date().toISOString();

    // Fetch upcoming appointments (pending/confirmed, starting from now)
    const upcomingAppts = await db.query.appointments.findMany({
      where: and(
        eq(schema.appointments.artistId, user.id),
        gte(schema.appointments.startTime, now),
        inArray(schema.appointments.status, ["pending", "confirmed"])
      ),
      orderBy: asc(schema.appointments.startTime),
      with: {
        client: true,
      },
      limit: 20,
    });

    // Get clientIds to find linked leads
    const clientIds = [...new Set(upcomingAppts.map(a => a.clientId))];

    // Fetch leads linked to these appointments or clients
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
    const apptIds = upcomingAppts.map(a => a.id);
    if (apptIds.length > 0) {
      const apptLinkedLeads = await db.query.leads.findMany({
        where: and(
          eq(schema.leads.artistId, user.id),
          inArray(schema.leads.appointmentId, apptIds)
        ),
      });
      for (const lead of apptLinkedLeads) {
        // appointmentId-linked leads are more specific, prefer them
        const appt = upcomingAppts.find(a => a.id === lead.appointmentId);
        if (appt) {
          leadByClient.set(appt.clientId, lead);
        }
      }
    }

    // Merge appointments with lead data
    return upcomingAppts.map(appt => {
      const lead = leadByClient.get(appt.clientId);
      return {
        id: appt.id,
        title: appt.title,
        description: appt.description,
        serviceName: appt.serviceName,
        startTime: appt.startTime,
        endTime: appt.endTime,
        status: appt.status,
        price: appt.price,
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
          stylePreferences: lead.stylePreferences, // JSON string
          referenceImages: lead.referenceImages, // JSON string
          placement: lead.placement,
          estimatedSize: lead.estimatedSize,
          budgetLabel: lead.budgetLabel,
          status: lead.status,
        } : null,
      };
    });
  }),
});

