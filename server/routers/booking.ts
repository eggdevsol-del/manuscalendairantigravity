import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { artistProcedure, router } from "../_core/trpc";
import * as db from "../db";
import * as BookingService from "../services/booking.service";

export const bookingRouter = router({
    checkAvailability: artistProcedure
        .input(z.object({
            conversationId: z.number(),
            serviceName: z.string(),
            serviceDuration: z.number(),
            sittings: z.number(),
            price: z.number(),
            frequency: z.enum(["single", "consecutive", "weekly", "biweekly", "monthly"]),
            startDate: z.date(),
            timeZone: z.string(),
        }))
        .query(async ({ input }) => {
            const { conversationId, frequency, sittings, serviceDuration } = input;

            try {
                console.log("[BookingRouter] Checking availability for:", { conversationId, frequency, sittings });

                const conversation = await db.getConversationById(conversationId);

                if (!conversation) {
                    console.error("[BookingRouter] Conversation not found");
                    throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" });
                }

                const artistSettings = await db.getArtistSettings(conversation.artistId);

                console.log("[BookingRouter] Artist Settings found:", !!artistSettings);

                if (!artistSettings) {
                    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Artist has not configured settings" });
                }

                // 1. Parse Schedule
                const workSchedule = BookingService.parseWorkSchedule(artistSettings.workSchedule);
                console.log("[BookingRouter] Work Schedule parsed, days enabled:", workSchedule.filter(d => d.enabled).length);

                // 2. Validate Duration Constraints
                const maxDailyMinutes = BookingService.getMaxDailyMinutes(workSchedule);
                if (serviceDuration > maxDailyMinutes) {
                    throw new TRPCError({
                        code: "PRECONDITION_FAILED",
                        message: `Service duration (${serviceDuration} min) exceeds your longest work day (${maxDailyMinutes} min).`
                    });
                }

                // 3. Fetch Existing Appointments
                // Use getAppointmentsForUser which supports fromDate
                const searchStart = new Date(input.startDate);

                const rawAppointments = await db.getAppointmentsForUser(
                    conversation.artistId,
                    "artist",
                    searchStart
                );

                const existingAppointments = rawAppointments.map(a => ({
                    ...a,
                    startTime: new Date(a.startTime),
                    endTime: new Date(a.endTime)
                }));

                console.log("[BookingRouter] Existing appointments count:", existingAppointments.length);

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

                console.log("[BookingRouter] Calculation success, dates found:", dates.length);

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

    // Migration of the bookProject mutation
    bookProject: artistProcedure
        .input(z.object({
            conversationId: z.number(),
            timeZone: z.string().default("UTC"), // Add timezone input
            appointments: z.array(z.object({
                startTime: z.date(),
                endTime: z.date(), // We can derive duration from this
                title: z.string(),
                description: z.string().optional(),
                serviceName: z.string(),
                price: z.number(),
                depositAmount: z.number().optional(),
            })),
        }))
        .mutation(async ({ input }) => {
            const conversation = await db.getConversationById(input.conversationId);
            if (!conversation) throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" });

            // Validate Work Hours
            const artistSettings = await db.getArtistSettings(conversation.artistId);
            if (artistSettings) {
                const workSchedule = BookingService.parseWorkSchedule(artistSettings.workSchedule);

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
                        // Allow a small grace period or override? No, strict for now based on user request.
                        // Actually, if it's "11pm" vs "work hours", it's a bug.
                        throw new TRPCError({
                            code: "PRECONDITION_FAILED",
                            message: `Invalid booking time: ${validation.reason}`
                        });
                    }
                }
            }

            let createdCount = 0;
            const appointmentIds: number[] = [];
            for (const appt of input.appointments) {
                const created = await db.createAppointment({
                    conversationId: input.conversationId,
                    artistId: conversation.artistId,
                    clientId: conversation.clientId,
                    title: appt.title,
                    description: appt.description,
                    startTime: appt.startTime,
                    endTime: appt.endTime,
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

            // Create Proposal Message
            const firstAppt = input.appointments[0];
            const datesSummary = input.appointments.map(a => a.startTime).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

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
                status: 'pending',
                policies: enabledPolicies
            });

            await db.createMessage({
                conversationId: input.conversationId,
                senderId: conversation.artistId,
                content: "Project Proposal", // Fallback text
                messageType: "appointment_request",
                metadata: proposalMetadata,
                readBy: null,
                createdAt: new Date()
            });

            return { success: true, count: createdCount, appointmentIds };
        })
});
