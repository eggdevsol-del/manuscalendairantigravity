import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import * as schema from "../../drizzle/schema";
import { eq, and, desc, sql, count, asc, gte, lt } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";

export const dashboardRouter = router({
  getArtistOverview: protectedProcedure.query(async ({ ctx }) => {
    const { user } = ctx;
    if (user.role !== "artist" && user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    console.log(`[Dashboard] Fetching artist overview for ${user.id}`);
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
});
