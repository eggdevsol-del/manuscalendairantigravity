import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { artistProcedure, protectedProcedure, router } from "../_core/trpc";
import { eventBus } from "../_core/eventBus";
import * as db from "../db";
import { localToUTC, getBusinessTimezone } from "../../shared/utils/timezone";
import { notificationOutbox } from "../../drizzle/schema";
import { getBankDetailLabels } from "../../shared/utils/bankDetails";
import { eq } from "drizzle-orm";
import * as schema from "../../drizzle/schema";

export const appointmentsRouter = router({
  getArtistCalendar: protectedProcedure
    .input(
      z.object({
        artistId: z.string(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Validate permission: You must be the artist requesting your own calendar, OR an admin.
      if (ctx.user.id !== input.artistId && ctx.user.role !== "admin") {
        const dbRef = await db.getDb();
        if (!dbRef) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        // Permit studio managers/owners to view their artist's standalone calendar scopes directly if queried
        const member = await dbRef.query.studioMembers.findFirst({
          where: (sm, { eq, and }) => and(eq(sm.userId, input.artistId), eq(sm.status, "active"))
        });

        const requesterMember = member?.studioId
          ? await dbRef.query.studioMembers.findFirst({
            where: (sm, { eq, and }) => and(eq(sm.studioId, member.studioId), eq(sm.userId, ctx.user.id))
          })
          : null;

        if (!requesterMember || (requesterMember.role !== "owner" && requesterMember.role !== "manager")) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Not authorized to view this calendar",
          });
        }
      }
      return db.getArtistCalendar(
        input.artistId,
        input.startDate,
        input.endDate
      );
    }),

  getClientCalendar: protectedProcedure
    .input(
      z.object({
        clientId: z.string(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Validate permission: Clients request their own history
      if (ctx.user.id !== input.clientId && ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not authorized to view this calendar",
        });
      }
      return db.getClientCalendar(
        input.clientId,
        input.startDate,
        input.endDate
      );
    }),

  getStudioCalendar: protectedProcedure
    .input(
      z.object({
        studioId: z.string(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Validate permission: Only active members of the studio can fetch its consolidated schedule
      const dbRef = await db.getDb();
      if (!dbRef) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const member = await dbRef.query.studioMembers.findFirst({
        where: (sm, { eq, and }) =>
          and(eq(sm.studioId, input.studioId), eq(sm.userId, ctx.user.id)),
      });

      if (!member || member.status !== "active") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not an active member of this studio",
        });
      }

      return db.getStudioCalendar(
        input.studioId,
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
        endTime: z.string(), // Now accepts local format
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
          message: "This slot is already booked.",
        });
      }

      // Retrieve artist's studio context to link this appointment to the overarching studio calendar
      const dbRef = await db.getDb();
      let studioId: string | undefined = undefined;
      if (dbRef) {
        const member = await dbRef.query.studioMembers.findFirst({
          where: (sm, { eq, and }) =>
            and(eq(sm.userId, input.artistId), eq(sm.status, "active")),
        });
        if (member) studioId = member.studioId;
      }

      const newAppt = await db.createAppointment({
        studioId: studioId || null,
        conversationId: input.conversationId,
        artistId: input.artistId,
        clientId: input.clientId,
        title: input.title,
        description: input.description,
        startTime: new Date(startTimeUTC)
          .toISOString()
          .slice(0, 19)
          .replace("T", " "),
        endTime: new Date(endTimeUTC)
          .toISOString()
          .slice(0, 19)
          .replace("T", " "),
        timeZone: timezone,
        serviceName: input.serviceName,
        price: input.price,
        depositAmount: input.depositAmount,
        status: "pending",
      });

      if (newAppt?.id) {
        await db.generateRequiredForms(newAppt.id);
      }

      return newAppt;
    }),
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        startTime: z.string().optional(), // Now accepts local format
        endTime: z.string().optional(), // Now accepts local format
        timeZone: z.string().optional(),
        status: z
          .enum(["pending", "confirmed", "cancelled", "completed", "no-show"])
          .optional(),
        serviceName: z.string().optional(),
        price: z.number().optional(),
        depositAmount: z.number().optional(),
        depositPaid: z.union([z.boolean(), z.number()]).optional(),
        actualStartTime: z.string().optional(),
        actualEndTime: z.string().optional(),
        clientArrived: z.union([z.boolean(), z.number()]).optional(),
        clientPaid: z.union([z.boolean(), z.number()]).optional(),
        amountPaid: z.number().optional(),
        paymentMethod: z.enum(["stripe", "paypal", "bank", "cash"]).optional(),
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

      // Convert times if provided
      const processedUpdates: any = { ...updates };
      if (updates.startTime || updates.endTime) {
        const timezone =
          updates.timeZone || appointment.timeZone || getBusinessTimezone();

        if (updates.startTime) {
          processedUpdates.startTime = localToUTC(updates.startTime, timezone);
        }
        if (updates.endTime) {
          processedUpdates.endTime = localToUTC(updates.endTime, timezone);
        }
        if (updates.timeZone) {
          processedUpdates.timeZone = timezone;
        }
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
    .input(
      z.object({
        clientId: z.string(),
        deleteProfile: z.boolean().optional()
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "artist" && ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only artists can delete all bookings for a client",
        });
      }

      return db.deleteAppointmentsForClient(ctx.user.id, input.clientId, input.deleteProfile);
    }),

  deleteAllForArtist: protectedProcedure
    .mutation(async ({ ctx }) => {
      if (ctx.user.role !== "artist" && ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only artists can delete all their bookings",
        });
      }

      const database = await db.getDb();
      if (!database) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }

      await database.delete(schema.appointments).where(eq(schema.appointments.artistId, ctx.user.id));
      return { success: true };
    }),

  resolveMysteryAppointments: protectedProcedure
    .input(
      z.object({
        clientId: z.string(),
        mysteryServiceName: z.string(),
        mappedServiceName: z.string(),
        mappedPrice: z.number(),
        mappedDuration: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "artist" && ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only artists can resolve imported appointments",
        });
      }

      return db.resolveMysteryAppointments(
        ctx.user.id,
        input.clientId,
        input.mysteryServiceName,
        input.mappedServiceName,
        input.mappedPrice,
        input.mappedDuration
      );
    }),

  confirmDeposit: artistProcedure
    .input(
      z.object({
        conversationId: z.number(),
        paymentProof: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get all pending appointments for this conversation
      const pendingAppointments = await db.getPendingAppointmentsByConversation(
        input.conversationId
      );

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
    .input(
      z.object({
        conversationId: z.number(),
        serviceName: z.string(),
        serviceDuration: z.number(),
        sittings: z.number(),
        price: z.number(),
        frequency: z.enum(["consecutive", "weekly", "biweekly", "monthly"]),
        startDate: z.date(),
      })
    )
    .query(async ({ ctx, input }) => {
      const conversation = await db.getConversationById(input.conversationId);
      if (!conversation)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found",
        });

      const artistSettings = await db.getArtistSettings(conversation.artistId);
      if (!artistSettings)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Artist settings not found",
        });

      let workSchedule: any[] = [];
      try {
        const parsedSchedule = JSON.parse(artistSettings.workSchedule);
        if (
          parsedSchedule &&
          typeof parsedSchedule === "object" &&
          !Array.isArray(parsedSchedule)
        ) {
          workSchedule = Object.entries(parsedSchedule).map(
            ([key, value]: [string, any]) => ({
              day: key.charAt(0).toUpperCase() + key.slice(1),
              ...value,
            })
          );
        } else if (Array.isArray(parsedSchedule)) {
          workSchedule = parsedSchedule;
        }
      } catch (e) {
        console.error("Failed to parse work schedule");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Invalid work schedule format",
        });
      }

      if (!workSchedule || workSchedule.length === 0) {
        console.log("Debug: Work schedule empty");
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Work hours not set up",
        });
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

      console.log(
        `Debug: maxDailyMinutes=${maxDailyMinutes}, serviceDuration=${input.serviceDuration}`
      );
      console.log(
        "Debug: Work Schedule Sample:",
        JSON.stringify(workSchedule[0])
      );

      if (input.serviceDuration > maxDailyMinutes) {
        console.log("Debug: Service duration exceeds maxDailyMinutes");
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Service duration (${input.serviceDuration} min) exceeds your longest work day (${maxDailyMinutes} min).`,
        });
      }

      // Fetch existing appointments for the artist relative to now to catch all future info
      let searchStart = new Date();
      searchStart.setHours(0, 0, 0, 0);

      const existingAppointments = await db.getArtistCalendar(
        conversation.artistId,
        searchStart
      );

      const busySlots = existingAppointments.map(a => ({
        startTime: new Date(a.startTime),
        endTime: new Date(a.endTime),
      }));

      const suggestedDates: Date[] = [];
      let currentDateSearch = new Date(input.startDate);
      // Ensure we start searching from the start date, or now if start date is past
      if (currentDateSearch < new Date()) {
        currentDateSearch = new Date();
        currentDateSearch.setMinutes(
          Math.ceil(currentDateSearch.getMinutes() / 30) * 30
        );
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
          endTime: new Date(slot.getTime() + input.serviceDuration * 60000),
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
    .input(
      z.object({
        conversationId: z.number(),
        timeZone: z.string().optional(), // Optional timezone for all appointments
        appointments: z.array(
          z.object({
            startTime: z.date(), // Keep as Date for now (findProjectAvailability returns Dates)
            endTime: z.date(),
            title: z.string(),
            description: z.string().optional(),
            serviceName: z.string(),
            price: z.number(),
            depositAmount: z.number().optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const conversation = await db.getConversationById(input.conversationId);
      if (!conversation)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found",
        });

      if (
        ctx.user.id !== conversation.artistId &&
        ctx.user.id !== conversation.clientId
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not authorized to book for this conversation",
        });
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
            message: `The slot ${appt.startTime.toLocaleString()} - ${appt.endTime.toLocaleTimeString()} is no longer available.`,
          });
        }

        const created = await db.createAppointment({
          conversationId: input.conversationId,
          artistId: conversation.artistId,
          clientId: conversation.clientId as string,
          title: appt.title,
          description: appt.description,
          startTime: appt.startTime
            .toISOString()
            .slice(0, 19)
            .replace("T", " "),
          endTime: appt.endTime.toISOString().slice(0, 19).replace("T", " "),
          timeZone: timezone, // Add timezone
          serviceName: appt.serviceName,
          price: appt.price,
          depositAmount: appt.depositAmount,
          status: "pending",
        });

        if (created) {
          appointmentIds.push(created.id);
          createdCount++;
          await db.generateRequiredForms(created.id);
        }
      }

      if (createdCount > 0) {
        // Publish proposal accepted event for push notification via outbox
        const dbInst = await db.getDb();
        if (dbInst) {
          try {
            await dbInst.insert(notificationOutbox).values({
              eventType: "proposal.accepted",
              payloadJson: JSON.stringify({
                clientId: conversation.clientId,
                artistId: conversation.artistId,
                conversationId: input.conversationId,
                appointmentId: appointmentIds[0],
              }),
              status: "pending",
            });
          } catch (err) {
            console.error(
              "[Outbox] Failed to insert proposal.accepted event:",
              err
            );
          }
        }
      }

      // Auto-send deposit info if enabled
      const artistSettings = await db.getArtistSettings(conversation.artistId);
      if (artistSettings) {
        await sendDepositMessage(
          input.conversationId,
          conversation.artistId,
          artistSettings
        );
      }

      return { success: true, count: createdCount, appointmentIds };
    }),

  deleteProposal: artistProcedure
    .input(
      z.object({
        messageId: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const message = await db.getMessageById(input.messageId);
      if (!message) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message not found",
        });
      }

      if (
        message.messageType !== "appointment_request" &&
        !message.content.includes("project_proposal")
      ) {
        // Fallback check if it's a proposal
      }

      // Parse metadata
      let metadata: any = {};
      try {
        metadata = message.metadata ? JSON.parse(message.metadata) : {};
      } catch (e) { }

      const appointmentId = metadata.appointmentId || metadata.id; // handle different structures

      if (appointmentId) {
        // Cancel the appointment
        await db.updateAppointment(
          appointmentId,
          { status: "cancelled" },
          ctx.user.id
        );

        // Log special action
        await db.logAppointmentAction({
          appointmentId,
          action: "proposal_revoked",
          performedBy: ctx.user.id,
          newValue: JSON.stringify({ messageId: input.messageId }),
        });
      } else {
        console.warn(
          `[deleteProposal] No appointmentId found for message ${input.messageId}, revoking without appointment update.`
        );
      }

      // Mark message as deleted/hidden
      metadata.status = "revoked";
      metadata.isDeleted = true;
      metadata.deletedAt = new Date().toISOString();
      await db.updateMessageMetadata(input.messageId, JSON.stringify(metadata));

      // Optional: Insert system message
      await db.createMessage({
        conversationId: message.conversationId,
        senderId: ctx.user.id,
        content: "Proposal was revoked by the artist.",
        messageType: "system",
      });

      return { success: true };
    }),

  getProposalForAppointment: protectedProcedure
    .input(z.number())
    .query(async ({ input, ctx }) => {
      const appointment = await db.getAppointment(input);
      if (!appointment)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Appointment not found",
        });

      // Find the proposal message in this conversation
      // We search for messages of type 'appointment_request' in the same conversation
      const messages = await db.getMessages(appointment.conversationId);

      // Find the most recent proposal message that matches this appointment
      // Usually there's one proposal per project, but we'll try to find the one containing this appointment's dates or related metadata
      const proposal = messages
        .filter((m: any) => m.messageType === "appointment_request")
        .find((m: any) => {
          try {
            const meta = m.metadata ? JSON.parse(m.metadata) : {};
            // Check if metadata contains this appointment date or ID
            // The structure varies, but we often store proposedDates as string array
            const apptStart = new Date(appointment.startTime).toISOString();
            const dates = meta.dates || meta.proposedDates || [];
            return dates.some(
              (d: string) => new Date(d).toISOString() === apptStart
            );
          } catch (e) {
            return false;
          }
        });

      if (!proposal) {
        // Fallback for standalone/imported appointments: Group by conversation and service name
        const database = await db.getDb();
        if (!database) return null;

        const allInConvo = await database.query.appointments.findMany({
          where: (a, { and, eq, ne, isNotNull }) => and(
            eq(a.conversationId, appointment.conversationId),
            isNotNull(a.serviceName),
            eq(a.serviceName, appointment.serviceName || ""),
            ne(a.status, "cancelled")
          ),
          orderBy: (a, { asc }) => [asc(a.startTime)],
        });

        // Only group if there are matching appointments
        if (allInConvo.length > 0) {
          const totalCost = allInConvo.reduce((sum: number, a: any) => sum + (a.price || 0), 0);

          return {
            message: { id: -1, messageType: "appointment_request" },
            metadata: {
              status: "accepted", // Auto-accept to show timeline
              serviceName: appointment.serviceName || "Imported Project",
              sittings: allInConvo.length,
              totalCost: totalCost,
              dates: allInConvo.map((a: any) => new Date(a.startTime).toISOString()),
              serviceDuration: appointment.endTime ? Math.round((new Date(appointment.endTime).getTime() - new Date(appointment.startTime).getTime()) / 60000) : 60,
            },
          };
        }
        return null;
      }

      try {
        return {
          message: proposal,
          metadata: proposal.metadata ? JSON.parse(proposal.metadata) : null,
        };
      } catch (e) {
        return null;
      }
    }),

  batchUpdateClientPrices: protectedProcedure
    .input(z.object({
      clientId: z.string(),
      artistId: z.string(),
      price: z.number().min(0),
      serviceName: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.id !== input.artistId && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized to batch update this context." });
      }

      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const nowString = new Date().toISOString().slice(0, 19).replace('T', ' ');

      const { and, eq, gte } = await import("drizzle-orm");

      const payload: any = { price: input.price };
      if (input.serviceName) {
        payload.serviceName = input.serviceName;
      }

      await database.update(schema.appointments)
        .set(payload)
        .where(
          and(
            eq(schema.appointments.clientId, input.clientId),
            eq(schema.appointments.artistId, input.artistId),
            gte(schema.appointments.startTime, nowString)
          )
        );

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
  let content =
    "To secure your booking, please pay the deposit using the details below:\n\n";

  if (artistSettings.businessName)
    content += `Business: ${artistSettings.businessName}\n`;

  const bankLabels = getBankDetailLabels(artistSettings.businessCountry || 'AU');

  if (artistSettings.bsb && bankLabels.bankCodeLabel) {
    content += `${bankLabels.bankCodeLabel}: ${artistSettings.bsb}\n`;
  }

  if (artistSettings.accountNumber)
    content += `${bankLabels.accountLabel}: ${artistSettings.accountNumber}\n`;
  if (artistSettings.depositAmount)
    content += `Amount: $${artistSettings.depositAmount}\n`;

  content +=
    "\nPlease send a screenshot of the payment receipt once transferred.";

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
    const schedule = workSchedule.find(
      (d: any) => d.day && d.day.toLowerCase() === dayName.toLowerCase()
    );

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

        while (
          current.getTime() + durationMinutes * 60000 <=
          dayEnd.getTime()
        ) {
          const potentialEnd = new Date(
            current.getTime() + durationMinutes * 60000
          );

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
