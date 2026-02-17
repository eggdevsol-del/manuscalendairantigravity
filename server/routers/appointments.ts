import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { artistProcedure, protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { localToUTC, getBusinessTimezone } from "../../shared/utils/timezone";

export const appointmentsRouter = router({
    list: protectedProcedure
        .input(
            z.object({
                startDate: z.date().optional(),
                endDate: z.date().optional(),
            })
        )
        .query(async ({ ctx, input }) => {
            return db.getAppointmentsForUser(
                ctx.user.id,
                ctx.user.role,
                input.startDate,
                input.endDate
            );
        }),
    getByConversation: protectedProcedure
        .input(z.number())
        .query(async ({ input, ctx }) => {
            // Verify user is part of this conversation
            const conversation = await db.getConversationById(input);

            if (!conversation) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Conversation not found",
                });
            }

            if (
                conversation.artistId !== ctx.user.id &&
                conversation.clientId !== ctx.user.id
            ) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "Not authorized to view these appointments",
                });
            }

            return db.getAppointmentsByConversation(input);
        }),
    create: protectedProcedure
        .input(
            z.object({
                conversationId: z.number(),
                artistId: z.string(),
                clientId: z.string(),
                title: z.string(),
                description: z.string().optional(),
                startTime: z.string(), // Now accepts local format "YYYY-MM-DDTHH:mm"
                endTime: z.string(),   // Now accepts local format
                timeZone: z.string().optional(), // Optional, defaults to business timezone
                serviceName: z.string().optional(),
                price: z.number().optional(),
                depositAmount: z.number().optional(),
            })
        )
        .mutation(async ({ input }) => {
            const timezone = input.timeZone || getBusinessTimezone();

            // Convert local times to UTC
            const startTimeUTC = localToUTC(input.startTime, timezone);
            const endTimeUTC = localToUTC(input.endTime, timezone);

            // Check for overlap using UTC times
            const isOverlapping = await db.checkAppointmentOverlap(
                input.artistId,
                new Date(startTimeUTC),
                new Date(endTimeUTC)
            );

            if (isOverlapping) {
                throw new TRPCError({
                    code: "CONFLICT",
                    message: "This slot is already booked."
                });
            }

            return db.createAppointment({
                conversationId: input.conversationId,
                artistId: input.artistId,
                clientId: input.clientId,
                title: input.title,
                description: input.description,
                startTime: new Date(startTimeUTC).toISOString().slice(0, 19).replace('T', ' '),
                endTime: new Date(endTimeUTC).toISOString().slice(0, 19).replace('T', ' '),
                timeZone: timezone,
                serviceName: input.serviceName,
                price: input.price,
                depositAmount: input.depositAmount,
                status: "pending",
            });
        }),
    update: protectedProcedure
        .input(
            z.object({
                id: z.number(),
                title: z.string().optional(),
                description: z.string().optional(),
                startTime: z.string().optional(), // Now accepts local format
                endTime: z.string().optional(),   // Now accepts local format
                timeZone: z.string().optional(),
                status: z
                    .enum(["pending", "confirmed", "cancelled", "completed"])
                    .optional(),
                serviceName: z.string().optional(),
                price: z.number().optional(),
                depositAmount: z.number().optional(),
                depositPaid: z.boolean().optional(),
                actualStartTime: z.string().optional(),
                actualEndTime: z.string().optional(),
                clientArrived: z.boolean().optional(),
                clientPaid: z.boolean().optional(),
                amountPaid: z.number().optional(),
                paymentMethod: z.enum(['stripe', 'paypal', 'bank', 'cash']).optional(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            const appointment = await db.getAppointment(input.id);

            if (!appointment) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Appointment not found",
                });
            }

            // Verify user is part of this appointment
            if (
                appointment.artistId !== ctx.user.id &&
                appointment.clientId !== ctx.user.id
            ) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "Not authorized to update this appointment",
                });
            }

            const { id, ...updates } = input;

            // Helper to ensure dates are in MySQL format (YYYY-MM-DD HH:mm:ss)
            const formatToMySQL = (dateStr: string | undefined | null) => {
                if (!dateStr) return dateStr;
                // If it's an ISO string (contains T and ends with Z), convert it
                if (dateStr.includes('T')) {
                    return dateStr.replace('T', ' ').split('.')[0].split('Z')[0];
                }
                return dateStr;
            };

            // Convert times if provided
            const processedUpdates: any = { ...updates };

            // Sanitize all potential date fields for MySQL compatibility
            if (updates.startTime) processedUpdates.startTime = formatToMySQL(localToUTC(updates.startTime, updates.timeZone || appointment.timeZone || getBusinessTimezone()));
            if (updates.endTime) processedUpdates.endTime = formatToMySQL(localToUTC(updates.endTime, updates.timeZone || appointment.timeZone || getBusinessTimezone()));
            if (updates.actualStartTime) processedUpdates.actualStartTime = formatToMySQL(updates.actualStartTime);
            if (updates.actualEndTime) processedUpdates.actualEndTime = formatToMySQL(updates.actualEndTime);

            if (updates.timeZone) {
                processedUpdates.timeZone = updates.timeZone;
            }

            return db.updateAppointment(id, processedUpdates, ctx.user.id);
        }),
    delete: protectedProcedure
        .input(z.number())
        .mutation(async ({ input, ctx }) => {
            const appointment = await db.getAppointment(input);

            if (!appointment) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Appointment not found",
                });
            }

            // Verify user is part of this appointment
            if (
                appointment.artistId !== ctx.user.id &&
                appointment.clientId !== ctx.user.id
            ) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "Not authorized to delete this appointment",
                });
            }

            return db.deleteAppointment(input, ctx.user.id);
        }),

    deleteAllForClient: protectedProcedure
        .input(z.object({
            clientId: z.string()
        }))
        .mutation(async ({ input, ctx }) => {
            if (ctx.user.role !== "artist" && ctx.user.role !== "admin") {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "Only artists can delete all bookings for a client",
                });
            }

            return db.deleteAppointmentsForClient(ctx.user.id, input.clientId);
        }),

    confirmDeposit: artistProcedure
        .input(z.object({
            conversationId: z.number(),
            paymentProof: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            // Get all pending appointments for this conversation
            const pendingAppointments = await db.getPendingAppointmentsByConversation(input.conversationId);

            if (!pendingAppointments || pendingAppointments.length === 0) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "No pending appointments found",
                });
            }

            // Confirm all pending appointments
            await db.confirmAppointments(input.conversationId, input.paymentProof);

            return { success: true, count: pendingAppointments.length };
        }),

    findProjectAvailability: artistProcedure
        .input(z.object({
            conversationId: z.number(),
            serviceName: z.string(),
            serviceDuration: z.number(),
            sittings: z.number(),
            price: z.number(),
            frequency: z.enum(["consecutive", "weekly", "biweekly", "monthly"]),
            startDate: z.date(),
        }))
        .query(async ({ ctx, input }) => {
            const conversation = await db.getConversationById(input.conversationId);
            if (!conversation) throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" });

            const artistSettings = await db.getArtistSettings(conversation.artistId);
            if (!artistSettings) throw new TRPCError({ code: "NOT_FOUND", message: "Artist settings not found" });

            let workSchedule: any[] = [];
            try {
                const parsedSchedule = JSON.parse(artistSettings.workSchedule);
                if (parsedSchedule && typeof parsedSchedule === 'object' && !Array.isArray(parsedSchedule)) {
                    workSchedule = Object.entries(parsedSchedule).map(([key, value]: [string, any]) => ({
                        day: key.charAt(0).toUpperCase() + key.slice(1),
                        ...value
                    }));
                } else if (Array.isArray(parsedSchedule)) {
                    workSchedule = parsedSchedule;
                }
            } catch (e) {
                console.error("Failed to parse work schedule");
                throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Invalid work schedule format" });
            }

            if (!workSchedule || workSchedule.length === 0) {
                console.log("Debug: Work schedule empty");
                throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Work hours not set up" });
            }

            // Validation: Check if service fits in ANY work day
            const maxDailyMinutes = workSchedule.reduce((max, day) => {
                if (!day.enabled) return max;
                const startStr = day.start || day.startTime;
                const endStr = day.end || day.endTime;

                const s = parseTime(startStr);
                const e = parseTime(endStr);

                if (!s || !e) return max;

                let startMins = s.hour * 60 + s.minute;
                let endMins = e.hour * 60 + e.minute;

                if (endMins < startMins) endMins += 24 * 60; // Handle overnight

                const minutes = endMins - startMins;
                return Math.max(max, minutes);
            }, 0);

            console.log(`Debug: maxDailyMinutes=${maxDailyMinutes}, serviceDuration=${input.serviceDuration}`);
            console.log("Debug: Work Schedule Sample:", JSON.stringify(workSchedule[0]));

            if (input.serviceDuration > maxDailyMinutes) {
                console.log("Debug: Service duration exceeds maxDailyMinutes");
                throw new TRPCError({
                    code: "PRECONDITION_FAILED",
                    message: `Service duration (${input.serviceDuration} min) exceeds your longest work day (${maxDailyMinutes} min).`
                });
            }

            // Fetch existing appointments for the artist relative to now to catch all future info
            let searchStart = new Date(input.startDate);
            const now = new Date();
            if (searchStart < now) searchStart = now;
            searchStart.setHours(0, 0, 0, 0);

            const existingAppointments = await db.getAppointmentsForUser(
                conversation.artistId,
                "artist",
                searchStart
            );

            const busySlots = existingAppointments.map(a => ({
                startTime: new Date(a.startTime),
                endTime: new Date(a.endTime)
            }));

            const suggestedDates: Date[] = [];
            let currentDateSearch = new Date(input.startDate);
            // Ensure we start searching from the start date, or now if start date is past
            if (currentDateSearch < new Date()) {
                currentDateSearch = new Date();
                currentDateSearch.setMinutes(Math.ceil(currentDateSearch.getMinutes() / 30) * 30);
                currentDateSearch.setSeconds(0);
                currentDateSearch.setMilliseconds(0);
            }

            // Calculate total cost
            const totalCost = input.price * input.sittings;

            for (let i = 0; i < input.sittings; i++) {
                // Find next available slot
                const slot = findNextAvailableSlot(
                    currentDateSearch,
                    input.serviceDuration,
                    workSchedule,
                    busySlots
                );

                if (!slot) {
                    throw new TRPCError({
                        code: "PRECONDITION_FAILED",
                        message: `Could not find available slot for sitting ${i + 1} within the next year. Check your calendar availability.`,
                    });
                }

                suggestedDates.push(slot);

                // Add to existing appointments to prevent overlap with consecutive sittings
                busySlots.push({
                    startTime: new Date(slot),
                    endTime: new Date(slot.getTime() + input.serviceDuration * 60000)
                });

                // Calculate next search date based on frequency
                const nextDate = new Date(slot);
                switch (input.frequency) {
                    case "consecutive":
                        nextDate.setDate(nextDate.getDate() + 1);
                        break;
                    case "weekly":
                        nextDate.setDate(nextDate.getDate() + 7);
                        break;
                    case "biweekly":
                        nextDate.setDate(nextDate.getDate() + 14);
                        break;
                    case "monthly":
                        nextDate.setMonth(nextDate.getMonth() + 1);
                        break;
                }

                nextDate.setHours(0, 0, 0, 0);
                currentDateSearch = nextDate;
            }

            return { dates: suggestedDates, totalCost };
        }),

    bookProject: protectedProcedure
        .input(z.object({
            conversationId: z.number(),
            timeZone: z.string().optional(), // Optional timezone for all appointments
            appointments: z.array(z.object({
                startTime: z.date(), // Keep as Date for now (findProjectAvailability returns Dates)
                endTime: z.date(),
                title: z.string(),
                description: z.string().optional(),
                serviceName: z.string(),
                price: z.number(),
                depositAmount: z.number().optional(),
            })),
        }))
        .mutation(async ({ ctx, input }) => {
            const conversation = await db.getConversationById(input.conversationId);
            if (!conversation) throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" });

            if (ctx.user.id !== conversation.artistId && ctx.user.id !== conversation.clientId) {
                throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized to book for this conversation" });
            }

            const timezone = input.timeZone || getBusinessTimezone();

            let createdCount = 0;
            const appointmentIds: number[] = [];
            for (const appt of input.appointments) {
                // Check for overlap
                const isOverlapping = await db.checkAppointmentOverlap(
                    conversation.artistId,
                    appt.startTime,
                    appt.endTime
                );

                if (isOverlapping) {
                    throw new TRPCError({
                        code: "CONFLICT",
                        message: `The slot ${appt.startTime.toLocaleString()} - ${appt.endTime.toLocaleTimeString()} is no longer available.`
                    });
                }

                const created = await db.createAppointment({
                    conversationId: input.conversationId,
                    artistId: conversation.artistId,
                    clientId: conversation.clientId,
                    title: appt.title,
                    description: appt.description,
                    startTime: appt.startTime.toISOString().slice(0, 19).replace('T', ' '),
                    endTime: appt.endTime.toISOString().slice(0, 19).replace('T', ' '),
                    timeZone: timezone, // Add timezone
                    serviceName: appt.serviceName,
                    price: appt.price,
                    depositAmount: appt.depositAmount,
                    status: "pending",
                });

                if (created) {
                    appointmentIds.push(created.id);
                    createdCount++;
                }
            }

            // Auto-send deposit info if enabled
            const artistSettings = await db.getArtistSettings(conversation.artistId);
            if (artistSettings) {
                await sendDepositMessage(input.conversationId, conversation.artistId, artistSettings);
            }


            return { success: true, count: createdCount, appointmentIds };
        }),

    deleteProposal: artistProcedure
        .input(z.object({
            messageId: z.number(),
        }))
        .mutation(async ({ input, ctx }) => {
            const message = await db.getMessageById(input.messageId);
            if (!message) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Message not found",
                });
            }

            if (message.messageType !== 'appointment_request' && !message.content.includes('project_proposal')) {
                // Fallback check if it's a proposal
            }

            // Parse metadata
            let metadata: any = {};
            try {
                metadata = message.metadata ? JSON.parse(message.metadata) : {};
            } catch (e) { }

            const appointmentId = metadata.appointmentId || metadata.id; // handle different structures

            if (!appointmentId) {
                throw new TRPCError({
                    code: "PRECONDITION_FAILED",
                    message: "No appointment associated with this proposal",
                });
            }

            // Cancel the appointment
            await db.updateAppointment(appointmentId, { status: 'cancelled' }, ctx.user.id);

            // Log special action
            await db.logAppointmentAction({
                appointmentId,
                action: 'proposal_revoked',
                performedBy: ctx.user.id,
                newValue: JSON.stringify({ messageId: input.messageId })
            });

            // Mark message as deleted/hidden
            metadata.isDeleted = true;
            metadata.deletedAt = new Date().toISOString();
            await db.updateMessageMetadata(input.messageId, JSON.stringify(metadata));

            // Optional: Insert system message
            await db.createMessage({
                conversationId: message.conversationId,
                senderId: ctx.user.id,
                content: "Proposal was revoked by the artist.",
                messageType: "system"
            });

            return { success: true };
        }),
});

// Helper function to send deposit info
async function sendDepositMessage(
    conversationId: number,
    artistId: string,
    artistSettings: any
) {
    if (!artistSettings?.autoSendDepositInfo) return;

    // Default message content
    let content = "To secure your booking, please pay the deposit using the details below:\n\n";

    if (artistSettings.businessName) content += `Business: ${artistSettings.businessName}\n`;
    if (artistSettings.bsb) content += `BSB: ${artistSettings.bsb}\n`;
    if (artistSettings.accountNumber) content += `Account: ${artistSettings.accountNumber}\n`;
    if (artistSettings.depositAmount) content += `Amount: $${artistSettings.depositAmount}\n`;

    content += "\nPlease send a screenshot of the payment receipt once transferred.";

    await db.createMessage({
        conversationId,
        senderId: artistId,
        content,
        messageType: "text",
    });
}

// Helper to parse time strings like "14:30" or "02:30 PM"
function parseTime(timeStr: string): { hour: number; minute: number } | null {
    if (!timeStr) return null;
    try {
        const normalized = timeStr.trim().toUpperCase();
        let hour = 0;
        let minute = 0;

        const isPM = normalized.includes("PM");
        const isAM = normalized.includes("AM");

        const cleanTime = normalized.replace("PM", "").replace("AM", "").trim();
        const parts = cleanTime.split(":");

        if (parts.length < 2) return null;

        hour = parseInt(parts[0], 10);
        minute = parseInt(parts[1], 10);

        if (isNaN(hour) || isNaN(minute)) return null;

        if (isPM && hour < 12) hour += 12;
        if (isAM && hour === 12) hour = 0;

        return { hour, minute };
    } catch (e) {
        return null; // Fail safe
    }
}

// Helper function to find next available slot
function findNextAvailableSlot(
    startDate: Date,
    durationMinutes: number,
    workSchedule: any[],
    existingAppointments: any[]
): Date | null {
    const MAX_SEARCH_DAYS = 365;
    let current = new Date(startDate);
    const now = new Date();

    if (current < now) {
        current = new Date(now);
        const remainder = current.getMinutes() % 30;
        if (remainder !== 0) {
            current.setMinutes(current.getMinutes() + (30 - remainder));
        }
        current.setSeconds(0);
        current.setMilliseconds(0);
    }

    for (let dayOffset = 0; dayOffset < MAX_SEARCH_DAYS; dayOffset++) {
        const dayName = current.toLocaleDateString("en-US", { weekday: "long" });
        // Case-insensitive match for day name
        const schedule = workSchedule.find((d: any) => d.day && d.day.toLowerCase() === dayName.toLowerCase());

        if (schedule && schedule.enabled) {
            const startStr = schedule.start || schedule.startTime;
            const endStr = schedule.end || schedule.endTime;

            const startParsed = parseTime(startStr);
            const endParsed = parseTime(endStr);

            if (startParsed && endParsed) {
                const dayStart = new Date(current);
                dayStart.setHours(startParsed.hour, startParsed.minute, 0, 0);

                const dayEnd = new Date(current);
                dayEnd.setHours(endParsed.hour, endParsed.minute, 0, 0);

                if (current < dayStart) {
                    current.setTime(dayStart.getTime());
                }

                while (current.getTime() + durationMinutes * 60000 <= dayEnd.getTime()) {
                    const potentialEnd = new Date(current.getTime() + durationMinutes * 60000);

                    const hasCollision = existingAppointments.some((appt: any) => {
                        const apptStart = new Date(appt.startTime);
                        const apptEnd = new Date(appt.endTime);
                        return current < apptEnd && potentialEnd > apptStart;
                    });

                    if (!hasCollision) {
                        return new Date(current);
                    }

                    // Increment by 30 mins
                    current.setTime(current.getTime() + 30 * 60000);
                }
            }
        }

        current.setDate(current.getDate() + 1);
        current.setHours(0, 0, 0, 0);
    }

    return null;
}
