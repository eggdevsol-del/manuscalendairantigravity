/**
 * Dashboard Tasks Router
 * 
 * Handles task generation, completion tracking, and analytics
 * for the Revenue Protection Algorithm.
 */

import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import * as schema from "../../drizzle/schema";
import { eq, and, desc, sql, gte, lte, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { generateBusinessTasks, BENCHMARKS, type BusinessTask } from "../services/businessTaskGenerator";

export const dashboardTasksRouter = router({
  /**
   * Get active business tasks for the dashboard
   */
  getBusinessTasks: protectedProcedure
    .query(async ({ ctx }) => {
      const { user } = ctx;
      if (user.role !== 'artist' && user.role !== 'admin') {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });
      }

      // Get artist's dashboard settings
      let settings = await db.query.dashboardSettings.findFirst({
        where: eq(schema.dashboardSettings.artistId, user.id)
      });

      // Create default settings if not exists
      if (!settings) {
        await db.insert(schema.dashboardSettings).values({
          artistId: user.id,
          maxVisibleTasks: 10,
          goalAdvancedBookingMonths: 3,
          preferredEmailClient: 'default',
          showWeeklySnapshot: 1
        });
        settings = {
          id: 0,
          artistId: user.id,
          maxVisibleTasks: 10,
          goalAdvancedBookingMonths: 3,
          preferredEmailClient: 'default',
          showWeeklySnapshot: 1,
          lastSnapshotShownAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      }

      // Generate tasks using the algorithm
      const tasks = await generateBusinessTasks(db, user.id, settings.maxVisibleTasks || 10);

      return {
        tasks,
        settings: {
          maxVisibleTasks: settings.maxVisibleTasks,
          preferredEmailClient: settings.preferredEmailClient
        }
      };
    }),

  /**
   * Start a task (record start time)
   */
  startTask: protectedProcedure
    .input(z.object({
      taskType: z.string(),
      taskTier: z.enum(['tier1', 'tier2', 'tier3', 'tier4']),
      relatedEntityType: z.string().nullable(),
      relatedEntityId: z.string().nullable(),
      clientId: z.string().nullable(),
      priorityScore: z.number()
    }))
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      if (user.role !== 'artist' && user.role !== 'admin') {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });
      }

      // Store in active_tasks with startedAt timestamp
      const [result] = await db.insert(schema.activeTasks).values({
        artistId: user.id,
        taskDomain: 'business',
        taskType: input.taskType,
        taskTier: input.taskTier,
        title: '', // Will be updated
        priorityScore: input.priorityScore,
        priorityLevel: input.priorityScore >= 800 ? 'critical' : input.priorityScore >= 500 ? 'high' : input.priorityScore >= 300 ? 'medium' : 'low',
        relatedEntityType: input.relatedEntityType,
        relatedEntityId: input.relatedEntityId,
        clientId: input.clientId,
        startedAt: new Date().toISOString()
      });

      return { 
        taskId: result.insertId,
        startedAt: new Date().toISOString()
      };
    }),

  /**
   * Complete a task (record completion and calculate time)
   */
  completeTask: protectedProcedure
    .input(z.object({
      taskType: z.string(),
      taskTier: z.enum(['tier1', 'tier2', 'tier3', 'tier4']),
      relatedEntityType: z.string().nullable(),
      relatedEntityId: z.string().nullable(),
      clientId: z.string().nullable(),
      priorityScore: z.number(),
      startedAt: z.string(), // ISO timestamp from when task was started
      actionTaken: z.enum(['in_app', 'sms', 'email', 'manual']).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      if (user.role !== 'artist' && user.role !== 'admin') {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });
      }

      const completedAt = new Date();
      const startedAt = new Date(input.startedAt);
      const timeToCompleteSeconds = Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000);

      // Format as MySQL DATETIME: YYYY-MM-DD HH:MM:SS
      const formatMySQLDateTime = (date: Date): string => {
        return date.toISOString().slice(0, 19).replace('T', ' ');
      };

      // Record in task_completions
      await db.insert(schema.taskCompletions).values({
        artistId: user.id,
        taskType: input.taskType,
        taskTier: input.taskTier,
        taskDomain: 'business',
        relatedEntityType: input.relatedEntityType,
        relatedEntityId: input.relatedEntityId,
        clientId: input.clientId,
        priorityScore: input.priorityScore,
        startedAt: formatMySQLDateTime(startedAt),
        completedAt: formatMySQLDateTime(completedAt),
        timeToCompleteSeconds,
        actionTaken: input.actionTaken || 'manual'
      });

      // Clean up from active_tasks if exists
      await db.delete(schema.activeTasks).where(
        and(
          eq(schema.activeTasks.artistId, user.id),
          eq(schema.activeTasks.taskType, input.taskType),
          eq(schema.activeTasks.relatedEntityId, input.relatedEntityId || '')
        )
      );

      return { 
        success: true,
        timeToCompleteSeconds
      };
    }),

  /**
   * Get dashboard settings
   */
  getSettings: protectedProcedure
    .query(async ({ ctx }) => {
      const { user } = ctx;
      if (user.role !== 'artist' && user.role !== 'admin') {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });
      }

      let settings = await db.query.dashboardSettings.findFirst({
        where: eq(schema.dashboardSettings.artistId, user.id)
      });

      if (!settings) {
        // Return defaults
        return {
          maxVisibleTasks: 10,
          goalAdvancedBookingMonths: 3,
          preferredEmailClient: 'default' as const,
          showWeeklySnapshot: true
        };
      }

      return {
        maxVisibleTasks: settings.maxVisibleTasks || 10,
        goalAdvancedBookingMonths: settings.goalAdvancedBookingMonths || 3,
        preferredEmailClient: settings.preferredEmailClient || 'default',
        showWeeklySnapshot: settings.showWeeklySnapshot === 1
      };
    }),

  /**
   * Update dashboard settings
   */
  updateSettings: protectedProcedure
    .input(z.object({
      maxVisibleTasks: z.number().min(4).max(15).optional(),
      goalAdvancedBookingMonths: z.number().min(1).max(12).optional(),
      preferredEmailClient: z.enum(['default', 'gmail', 'outlook', 'apple_mail']).optional(),
      showWeeklySnapshot: z.boolean().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      if (user.role !== 'artist' && user.role !== 'admin') {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });
      }

      const existing = await db.query.dashboardSettings.findFirst({
        where: eq(schema.dashboardSettings.artistId, user.id)
      });

      const updateData: Record<string, any> = {};
      if (input.maxVisibleTasks !== undefined) updateData.maxVisibleTasks = input.maxVisibleTasks;
      if (input.goalAdvancedBookingMonths !== undefined) updateData.goalAdvancedBookingMonths = input.goalAdvancedBookingMonths;
      if (input.preferredEmailClient !== undefined) updateData.preferredEmailClient = input.preferredEmailClient;
      if (input.showWeeklySnapshot !== undefined) updateData.showWeeklySnapshot = input.showWeeklySnapshot ? 1 : 0;

      if (existing) {
        await db.update(schema.dashboardSettings)
          .set(updateData)
          .where(eq(schema.dashboardSettings.artistId, user.id));
      } else {
        await db.insert(schema.dashboardSettings).values({
          artistId: user.id,
          ...updateData
        });
      }

      return { success: true };
    }),

  /**
   * Get weekly analytics snapshot
   */
  getWeeklySnapshot: protectedProcedure
    .query(async ({ ctx }) => {
      const { user } = ctx;
      if (user.role !== 'artist' && user.role !== 'admin') {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });
      }

      // Calculate week boundaries (Monday to Sunday)
      const now = new Date();
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() + mondayOffset);
      weekStart.setHours(0, 0, 0, 0);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      // Get task completions for this week
      const completions = await db.query.taskCompletions.findMany({
        where: and(
          eq(schema.taskCompletions.artistId, user.id),
          gte(schema.taskCompletions.completedAt, weekStart.toISOString()),
          lte(schema.taskCompletions.completedAt, weekEnd.toISOString())
        )
      });

      // Calculate metrics
      const totalTasks = completions.length;
      const tier1Tasks = completions.filter(c => c.taskTier === 'tier1').length;
      const tier2Tasks = completions.filter(c => c.taskTier === 'tier2').length;
      const tier3Tasks = completions.filter(c => c.taskTier === 'tier3').length;
      const tier4Tasks = completions.filter(c => c.taskTier === 'tier4').length;

      // Calculate average completion times
      const avgCompletionTime = totalTasks > 0
        ? Math.round(completions.reduce((sum, c) => sum + c.timeToCompleteSeconds, 0) / totalTasks)
        : 0;

      const tier1Completions = completions.filter(c => c.taskTier === 'tier1');
      const avgTier1Time = tier1Completions.length > 0
        ? Math.round(tier1Completions.reduce((sum, c) => sum + c.timeToCompleteSeconds, 0) / tier1Completions.length)
        : 0;

      // Get consultation response times
      const consultationTasks = completions.filter(c => c.taskType === 'new_consultation');
      const avgConsultationResponse = consultationTasks.length > 0
        ? Math.round(consultationTasks.reduce((sum, c) => sum + c.timeToCompleteSeconds, 0) / consultationTasks.length)
        : 0;

      // Calculate benchmarks comparison
      const responseTimeVsBenchmark = avgConsultationResponse > 0
        ? Math.round((BENCHMARKS.AVERAGE_RESPONSE_TIME / avgConsultationResponse) * 100)
        : 100;

      // Calculate efficiency score (0-100)
      let efficiencyScore = 50; // Base score
      
      // Add points for task completion
      efficiencyScore += Math.min(25, totalTasks * 2.5);
      
      // Add points for fast response times
      if (avgConsultationResponse > 0 && avgConsultationResponse < BENCHMARKS.EXCELLENT_RESPONSE_TIME) {
        efficiencyScore += 15;
      } else if (avgConsultationResponse > 0 && avgConsultationResponse < BENCHMARKS.GOOD_RESPONSE_TIME) {
        efficiencyScore += 10;
      }
      
      // Add points for tier 1 task completion
      efficiencyScore += Math.min(10, tier1Tasks * 2);

      efficiencyScore = Math.min(100, Math.round(efficiencyScore));

      // Get rating based on efficiency
      let rating: 'elite' | 'excellent' | 'good' | 'average' | 'needs_improvement';
      if (efficiencyScore >= 90) rating = 'elite';
      else if (efficiencyScore >= 80) rating = 'excellent';
      else if (efficiencyScore >= 70) rating = 'good';
      else if (efficiencyScore >= 60) rating = 'average';
      else rating = 'needs_improvement';

      return {
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString(),
        metrics: {
          totalTasksCompleted: totalTasks,
          tier1TasksCompleted: tier1Tasks,
          tier2TasksCompleted: tier2Tasks,
          tier3TasksCompleted: tier3Tasks,
          tier4TasksCompleted: tier4Tasks,
          avgCompletionTimeSeconds: avgCompletionTime,
          avgTier1CompletionTimeSeconds: avgTier1Time,
          avgConsultationResponseSeconds: avgConsultationResponse,
        },
        comparison: {
          responseTimeVsBenchmark,
          // 100 = at benchmark, >100 = better than average, <100 = worse
          benchmarkLabel: responseTimeVsBenchmark >= 150 ? 'Elite' 
            : responseTimeVsBenchmark >= 120 ? 'Excellent'
            : responseTimeVsBenchmark >= 100 ? 'Good'
            : responseTimeVsBenchmark >= 80 ? 'Average'
            : 'Needs Improvement'
        },
        efficiencyScore,
        rating,
        insights: generateInsights(totalTasks, tier1Tasks, avgConsultationResponse, efficiencyScore)
      };
    }),

  /**
   * Dismiss weekly snapshot (mark as shown)
   */
  dismissWeeklySnapshot: protectedProcedure
    .mutation(async ({ ctx }) => {
      const { user } = ctx;
      if (user.role !== 'artist' && user.role !== 'admin') {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });
      }

      await db.update(schema.dashboardSettings)
        .set({ lastSnapshotShownAt: new Date().toISOString() })
        .where(eq(schema.dashboardSettings.artistId, user.id));

      return { success: true };
    }),

  /**
   * Check if weekly snapshot should be shown
   */
  shouldShowWeeklySnapshot: protectedProcedure
    .query(async ({ ctx }) => {
      const { user } = ctx;
      if (user.role !== 'artist' && user.role !== 'admin') {
        return { shouldShow: false };
      }

      const db = await getDb();
      if (!db) {
        return { shouldShow: false };
      }

      const settings = await db.query.dashboardSettings.findFirst({
        where: eq(schema.dashboardSettings.artistId, user.id)
      });

      if (!settings || settings.showWeeklySnapshot === 0) {
        return { shouldShow: false };
      }

      // Show on Monday if not shown this week
      const now = new Date();
      const dayOfWeek = now.getDay();
      
      if (dayOfWeek !== 1) {
        // Not Monday
        return { shouldShow: false };
      }

      if (!settings.lastSnapshotShownAt) {
        return { shouldShow: true };
      }

      const lastShown = new Date(settings.lastSnapshotShownAt);
      const daysSinceShown = (now.getTime() - lastShown.getTime()) / (1000 * 60 * 60 * 24);

      return { shouldShow: daysSinceShown >= 7 };
    }),

  /**
   * Get quick stats for dashboard header
   * Returns key metrics for artist at-a-glance view
   */
  getQuickStats: protectedProcedure
    .query(async ({ ctx }) => {
      const { user } = ctx;
      if (user.role !== 'artist' && user.role !== 'admin') {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });
      }

      const now = new Date();
      
      // Calculate week boundaries (Monday to Sunday)
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() + mondayOffset);
      weekStart.setHours(0, 0, 0, 0);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      // Calculate month boundaries
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      monthEnd.setHours(23, 59, 59, 999);

      // Get bookings this week (confirmed appointments)
      const weeklyBookings = await db.query.appointments.findMany({
        where: and(
          eq(schema.appointments.artistId, user.id),
          eq(schema.appointments.status, 'confirmed'),
          gte(schema.appointments.startTime, weekStart.toISOString()),
          lte(schema.appointments.startTime, weekEnd.toISOString())
        )
      });

      // Get all appointments this month to calculate open dates
      const monthlyAppointments = await db.query.appointments.findMany({
        where: and(
          eq(schema.appointments.artistId, user.id),
          gte(schema.appointments.startTime, monthStart.toISOString()),
          lte(schema.appointments.startTime, monthEnd.toISOString())
        )
      });

      // Calculate booked dates this month
      const bookedDates = new Set(
        monthlyAppointments.map(a => new Date(a.startTime).toDateString())
      );

      // Calculate working days remaining in month (Mon-Fri by default)
      // TODO: Add workDays to artistSettings schema for customization
      const workDays = [1, 2, 3, 4, 5]; // Mon-Fri
      let openDatesThisMonth = 0;
      
      for (let d = new Date(now); d <= monthEnd; d.setDate(d.getDate() + 1)) {
        const dayNum = d.getDay();
        if (workDays.includes(dayNum) && !bookedDates.has(d.toDateString())) {
          openDatesThisMonth++;
        }
      }

      // Get new enquiries (pending consultations/leads)
      const pendingLeads = await db.query.leads.findMany({
        where: and(
          eq(schema.leads.artistId, user.id),
          eq(schema.leads.status, 'pending')
        )
      });

      // Get pending consultations from conversations
      const pendingConsultations = await db.query.conversations.findMany({
        where: and(
          eq(schema.conversations.artistId, user.id),
          eq(schema.conversations.status, 'pending')
        )
      });

      const newEnquiries = pendingLeads.length + pendingConsultations.length;

      return {
        bookingsThisWeek: weeklyBookings.length,
        openDatesThisMonth,
        newEnquiries,
        // Additional context
        weekLabel: `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        monthLabel: now.toLocaleDateString('en-US', { month: 'long' })
      };
    })
});

/**
 * Generate personalized insights based on metrics
 */
function generateInsights(
  totalTasks: number,
  tier1Tasks: number,
  avgResponseTime: number,
  efficiencyScore: number
): string[] {
  const insights: string[] = [];

  if (totalTasks === 0) {
    insights.push("Start completing tasks to see your performance metrics!");
    return insights;
  }

  // Response time insights
  if (avgResponseTime > 0) {
    if (avgResponseTime < BENCHMARKS.ELITE_RESPONSE_TIME) {
      insights.push("🚀 Your consultation response time is elite! You're 3x faster than the average business.");
    } else if (avgResponseTime < BENCHMARKS.EXCELLENT_RESPONSE_TIME) {
      insights.push("⚡ Great response times! You're responding faster than 80% of businesses.");
    } else if (avgResponseTime > BENCHMARKS.AVERAGE_RESPONSE_TIME) {
      insights.push("💡 Tip: Responding to consultations within 1 hour can increase conversions by 7x.");
    }
  }

  // Tier 1 completion insights
  if (tier1Tasks >= 5) {
    insights.push("💰 Strong revenue protection! You completed " + tier1Tasks + " critical tasks this week.");
  } else if (tier1Tasks === 0 && totalTasks > 0) {
    insights.push("📋 Focus on Tier 1 tasks (red) first - they protect your immediate revenue.");
  }

  // Overall efficiency
  if (efficiencyScore >= 90) {
    insights.push("🏆 You're performing at elite level! Keep up the excellent work.");
  } else if (efficiencyScore >= 70) {
    insights.push("📈 Good progress! A few more completed tasks could push you to excellent.");
  } else {
    insights.push("🎯 Try to complete at least 5 tasks per week to improve your efficiency score.");
  }

  return insights.slice(0, 3); // Max 3 insights
}
