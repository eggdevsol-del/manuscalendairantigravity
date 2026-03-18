import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { artistProcedure, router, publicProcedure } from "../_core/trpc";
import * as db from "../db";
import * as BookingService from "../services/booking.service";
import { checkAndApplyNewClient } from "./promotions";

export const bookingRouter = router({
  checkAvailability: artistProcedure
    .input(
      z.object({
        conversationId: z.number(),
        serviceName: z.string(),
        serviceDuration: z.number(),
        sittings: z.number(),
        price: z.number(),
        frequency: z.enum([
          "single",
          "consecutive",
          "weekly",
          "biweekly",
          "monthly",
        ]),
        startDate: z.date(),
        timeZone: z.string(),
      })
    )
    .query(async ({ input }) => {
      const { conversationId, frequency, sittings, serviceDuration } = input;

      try {
        console.log("[BookingRouter] Checking availability for:", {
          conversationId,
          frequency,
          sittings,
        });

        const conversation = await db.getConversationById(conversationId);

        if (!conversation) {
          console.error("[BookingRouter] Conversation not found");
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Conversation not found",
          });
        }

        const artistSettings = await db.getArtistSettings(
          conversation.artistId
        );

        console.log("[BookingRouter] Artist Settings found:", !!artistSettings);

        if (!artistSettings) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Artist has not configured settings",
          });
        }

        // 1. Parse Schedule
        const workSchedule = BookingService.parseWorkSchedule(
          artistSettings.workSchedule
        );
        console.log(
          "[BookingRouter] Work Schedule parsed, days enabled:",
          workSchedule.filter(d => d.enabled).length
        );

        // 2. Validate Duration Constraints
        const maxDailyMinutes = BookingService.getMaxDailyMinutes(workSchedule);
        if (serviceDuration > maxDailyMinutes) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Service duration (${serviceDuration} min) exceeds your longest work day (${maxDailyMinutes} min).`,
          });
        }

        // 3. Fetch Existing Appointments
        // Use getAppointmentsForUser which supports fromDate
        // CAUTION: It evaluates based on startTime >= searchStart.
        // We MUST search from start of day to ensure we catch currently overlapping
        // "in progress" appointments that started before the exact current time!
        const searchStart = new Date(input.startDate);
        searchStart.setHours(0, 0, 0, 0);

        const rawAppointments = await db.getArtistCalendar(
          conversation.artistId,
          searchStart
        );

        const existingAppointments = rawAppointments
          .filter(a => a.status !== "cancelled" && a.status !== "rejected")
          .map(a => ({
            ...a,
            startTime: new Date(a.startTime),
            endTime: new Date(a.endTime),
          }));

        console.log(
          "[BookingRouter] Existing appointments count:",
          existingAppointments.length
        );

        // 4. Calculate Dates
        const dates = BookingService.calculateProjectDates({
          serviceDuration,
          sittings,
          frequency,
          startDate: input.startDate,
          workSchedule,
          existingAppointments,
          timeZone: input.timeZone,
        });

        console.log(
          "[BookingRouter] Calculation success, dates found:",
          dates.length
        );

        const totalCost = input.price * input.sittings;

        return {
          dates,
          totalCost,
        };
      } catch (error) {
        console.error("[BookingRouter] Error in checkAvailability:", error);
        throw error;
      }
    }),

  getCalendarIndicators: publicProcedure
    .input(
      z.object({
        artistId: z.string(),
        startDate: z.date(),
        endDate: z.date(),
      })
    )
    .query(async ({ input }) => {
      const { artistId, startDate, endDate } = input;

      const artistSettings = await db.getArtistSettings(artistId);
      if (!artistSettings || !artistSettings.services) return {};

      let services: any[] = [];
      try {
        services = JSON.parse(artistSettings.services);
      } catch (e) {
        console.error("[BookingRouter] Failed to parse services json for indicators", e);
      }

      const serviceColorMap: Record<string, string> = {};
      services.forEach((s) => {
        if (s.name && s.color) {
          serviceColorMap[s.name] = s.color;
        }
      });

      const rawAppts = await db.getArtistCalendar(artistId, startDate, endDate);
      // Only show confirmed and completed — pending bookings should NOT block public calendar
      const validAppts = rawAppts.filter(
        (a) =>
          a.status === "confirmed" ||
          a.status === "completed" ||
          a.status === "no-show"
      );

      // Public response only exposes busy percentage per day — NOT exact durations or times
      const indicators: Record<
        string,
        { color: string; percentage: number }[]
      > = {};

      for (const appt of validAppts) {
        if (!appt.startTime || !appt.endTime || !appt.serviceName) continue;

        const start = new Date(appt.startTime);
        const end = new Date(appt.endTime);
        const durationMinutes = (end.getTime() - start.getTime()) / 60000;

        if (durationMinutes <= 0) continue;

        // Use standard YYYY-MM-DD local format
        const dateKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(
          2,
          "0"
        )}-${String(start.getDate()).padStart(2, "0")}`;

        let percentage = 25; // partial / quarter day
        if (durationMinutes >= 300) {
          percentage = 100; // full day (5+ hours)
        } else if (durationMinutes >= 180) {
          percentage = 50; // half day (3-5 hours)
        }

        const color = serviceColorMap[appt.serviceName] || "#6366f1"; // default to primary

        if (!indicators[dateKey]) {
          indicators[dateKey] = [];
        }

        indicators[dateKey].push({
          color,
          percentage,
        });
      }

      return indicators;
    }),

  // Migration of the bookProject mutation
  bookProject: artistProcedure
    .input(
      z.object({
        conversationId: z.number(),
        timeZone: z.string().default("UTC"), // Add timezone input
        appointments: z.array(
          z.object({
            startTime: z.date(),
            endTime: z.date(), // We can derive duration from this
            title: z.string(),
            description: z.string().optional(),
            serviceName: z.string(),
            price: z.number(),
            depositAmount: z.number().optional(),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      const conversation = await db.getConversationById(input.conversationId);
      if (!conversation)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found",
        });

      // Validate Work Hours
      const artistSettings = await db.getArtistSettings(conversation.artistId);
      if (artistSettings) {
        const workSchedule = BookingService.parseWorkSchedule(
          artistSettings.workSchedule
        );

        for (const appt of input.appointments) {
          const durationMs = appt.endTime.getTime() - appt.startTime.getTime();
          const durationMinutes = Math.floor(durationMs / 60000);

          const validation = BookingService.validateAppointmentForWorkHours(
            appt.startTime,
            durationMinutes,
            workSchedule,
            input.timeZone
          );

          if (!validation.valid) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: `Invalid booking time: ${validation.reason}`,
            });
          }
        }
      }

      // Check if this is a new client (no prior appointments)
      // We check BEFORE creating the new ones to see if they had 0 count
      const distinctAppointments = await db.getArtistCalendar(
        conversation.artistId
      );
      // db.getAppointmentsForUser might not filter by specific client if querying as artist.
      // Let's use getAppointmentsForUser(conversation.clientId, "client")

      const priorAppointments = await db.getClientCalendar(
        conversation.clientId
      );
      const isNewClient = priorAppointments.length === 0;

      let createdCount = 0;
      const appointmentIds: number[] = [];
      for (const appt of input.appointments) {
        const created = await db.createAppointment({
          conversationId: input.conversationId,
          artistId: conversation.artistId,
          clientId: conversation.clientId,
          title: appt.title,
          description: appt.description,
          startTime: appt.startTime
            .toISOString()
            .slice(0, 19)
            .replace("T", " "),
          endTime: appt.endTime.toISOString().slice(0, 19).replace("T", " "),
          serviceName: appt.serviceName,
          price: appt.price,
          depositAmount: appt.depositAmount,
          status: "pending",
        });
        if (created) {
          appointmentIds.push(created.id);
        }
        createdCount++;
      }

      // Trigger Auto-Apply Promotions if new client
      if (isNewClient) {
        // Fire and forget - don't await strictly or catch error to not block booking
        checkAndApplyNewClient(
          conversation.artistId,
          conversation.clientId
        ).catch(err => {
          console.error("[BookingRouter] Auto-apply promotion failed:", err);
        });
      }

      // Create Proposal Message
      const firstAppt = input.appointments[0];
      const datesSummary = input.appointments
        .map(a => a.startTime)
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

      // Fetch policies
      const policies = await db.getPolicies(conversation.artistId);
      const enabledPolicies = policies.filter(p => p.enabled);

      // Construct metadata for the message (JSON string)
      // This structure should match what ProjectProposalMessage expects
      const proposalMetadata = JSON.stringify({
        serviceName: firstAppt.serviceName,
        totalCost: input.appointments.reduce((sum, a) => sum + a.price, 0),
        sittings: input.appointments.length,
        dates: datesSummary,
        status: "pending",
        policies: enabledPolicies,
      });

      await db.createMessage({
        conversationId: input.conversationId,
        senderId: conversation.artistId,
        content: "Project Proposal", // Fallback text
        messageType: "appointment_request",
        metadata: proposalMetadata,
        readBy: null,
      });

      return { success: true, count: createdCount, appointmentIds };
    }),
});
