import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eventBus } from "../_core/eventBus";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { notificationOutbox, appointments } from "../../drizzle/schema";
import { and, eq, gt, ne } from "drizzle-orm";

export const messagesRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        conversationId: z.number(),
        limit: z.number().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      // Verify user is part of this conversation
      const conversation = await db.getConversationById(input.conversationId);

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
          message: "Not authorized to view these messages",
        });
      }

      const msgs = await db.getMessages(input.conversationId, input.limit);
      return msgs.reverse(); // Return in chronological order
    }),
  send: protectedProcedure
    .input(
      z.object({
        conversationId: z.number(),
        content: z.string(),
        messageType: z
          .enum([
            "text",
            "system",
            "appointment_request",
            "appointment_confirmed",
            "image",
          ])
          .default("text"),
        metadata: z.string().optional(),
        consultationId: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Verify user is part of this conversation
      const conversation = await db.getConversationById(input.conversationId);

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
          message: "Not authorized to send messages in this conversation",
        });
      }

      // Handle project proposals: Inject pending appointments immediately
      if (input.messageType === "appointment_request") {
        let metaObj: any = null;
        try {
          if (input.metadata) metaObj = JSON.parse(input.metadata);
        } catch (e) { }

        if (metaObj && metaObj.status === "pending" && Array.isArray(metaObj.dates) && metaObj.dates.length > 0) {
          // --- BEGIN VALIDATION ---
          const searchStart = new Date();
          searchStart.setHours(0, 0, 0, 0);

          const rawAppointments = await db.getArtistCalendar(
            conversation.artistId,
            searchStart
          );

          const existingAppointments = rawAppointments
            .filter((a) => a.status !== "cancelled" && a.status !== "rejected")
            .map((a) => ({
              ...a,
              startTime: new Date(a.startTime),
              endTime: new Date(a.endTime),
            }));

          for (const dateStr of metaObj.dates) {
            const startTime = new Date(dateStr);
            const duration = metaObj.serviceDuration || 60;
            const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

            const hasCollision = existingAppointments.some(appt => {
              const apptStart = new Date(appt.startTime);
              const apptEnd = new Date(appt.endTime);
              return startTime < apptEnd && endTime > apptStart;
            });

            if (hasCollision) {
              throw new TRPCError({
                code: "CONFLICT",
                message: "One or more selected dates conflict with existing appointments.",
              });
            }
          }
          // --- END VALIDATION ---

          const appointmentIds: number[] = [];
          
          // Even Spread Deposit Allocation
          const projectDeposit = typeof metaObj.depositAmount === "number" ? metaObj.depositAmount : 0;
          const totalDepositCents = Math.round(projectDeposit * 100);
          const numSittings = metaObj.dates.length;
          const baseAllocCents = Math.floor(totalDepositCents / numSittings);
          const remainderCents = totalDepositCents % numSittings;

          for (let i = 0; i < metaObj.dates.length; i++) {
            const dateStr = metaObj.dates[i];
            const startTime = new Date(dateStr);
            const duration = metaObj.serviceDuration || 60;
            const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

            const safePrice = typeof metaObj.price === "number" ? metaObj.price : 0;
            const expectedCents = Math.round(safePrice * 100);
            
            // Allocate cents (add 1 cent to early sittings if there's a remainder)
            const allocatedDepositCents = baseAllocCents + (i < remainderCents ? 1 : 0);
            const allocatedDepositDollars = allocatedDepositCents / 100;
            const balanceCents = expectedCents - allocatedDepositCents;

            const inserted = await db.createAppointment({
              conversationId: input.conversationId,
              artistId: conversation.artistId,
              clientId: conversation.clientId || "",
              title: metaObj.serviceName || "Project Proposal",
              description: "Pending Proposal Dates",
              startTime: startTime.toISOString().slice(0, 19).replace("T", " "),
              endTime: endTime.toISOString().slice(0, 19).replace("T", " "),
              serviceName: metaObj.serviceName || "Project Proposal",
              price: safePrice,
              depositAmount: allocatedDepositDollars,
              totalExpectedAmountCents: expectedCents,
              remainingBalanceCents: balanceCents,
              totalPaidAmountCents: 0,
              status: "pending",
            });

            if (inserted && inserted.id) {
              appointmentIds.push(inserted.id);
            }
          }

          if (appointmentIds.length > 0) {
            metaObj.appointmentIds = appointmentIds;
            // Update the message metadata before it is created
            input.metadata = JSON.stringify(metaObj);
          }
        }
      }

      const message = await db.createMessage({
        conversationId: input.conversationId,
        senderId: ctx.user.id,
        content: input.content,
        messageType: input.messageType,
        metadata: input.metadata,
      });

      // Send push notification to the other user
      const recipientId =
        conversation.artistId === ctx.user.id
          ? conversation.clientId
          : conversation.artistId;

      // Only send push for regular messages (not system messages)
      if (input.messageType === "text" || input.messageType === "image") {
        const messagePreview =
          input.messageType === "image" ? "Sent an image" : input.content;

        // Event creation handled below via DB Outbox

        // Auto-update consultation status if artist replies
        if (ctx.user.id === conversation.artistId) {
          try {
            // 1. If explicit ID provided, use it
            if (input.consultationId) {
              await db.updateConsultation(input.consultationId, {
                status: "responded",
              });
            }

            // 2. ALSO check for any pending consultations between these two users
            // This ensures that even if the ID wasn't passed, we catch it.
            // We can't rely on getConsultationsForUser because it might be cached or filtered

            // Get all consultations for this artist to match against client
            const allConsults = await db.getConsultationsForUser(
              ctx.user.id,
              "artist"
            );
            const pendingForClient = allConsults.filter(
              (c: any) =>
                c.clientId === conversation.clientId && c.status === "pending"
            );

            for (const consult of pendingForClient) {
              // Avoid double update if we already did it above
              if (consult.id !== input.consultationId) {
                await db.updateConsultation(consult.id, {
                  status: "responded",
                });
              }
            }
          } catch (err) {
            console.error("Failed to auto-update consultation status:", err);
          }
        }

        // Use the database instance to insert the notification outbox event directly
        const dbInst = await db.getDb();
        if (dbInst) {
          try {
            await dbInst
              .insert(
                notificationOutbox
              )
              .values({
                eventType: "message.created",
                payloadJson: JSON.stringify({
                  targetUserId: recipientId,
                  title: ctx.user.name || "Someone",
                  body: messagePreview,
                  data: { conversationId: input.conversationId },
                }),
                status: "pending",
              });
          } catch (err) {
            console.error(
              "[Outbox] Failed to insert message.created event:",
              err
            );
          }
        }
      }

      // Send appointment confirmation notification
      if (input.messageType === "appointment_confirmed") {
        const dates = input.content.match(
          /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), (\w+ \d+, \d{4})/g
        );
        const firstDate = dates && dates.length > 0 ? dates[0] : "soon";

        // Insert into outbox instead of eventBus.publish
        const dbInst = await db.getDb();
        if (dbInst) {
          try {
            await dbInst
              .insert(
                notificationOutbox
              )
              .values({
                eventType: "appointment.confirmed",
                payloadJson: JSON.stringify({
                  targetUserId: recipientId,
                  title: ctx.user.name || "A client",
                  body: `Appointment confirmed for ${firstDate}`, // Assuming body logic needed here or generic?
                  data: { conversationId: input.conversationId },
                }),
                status: "pending",
              });
          } catch (err) {
            console.error(
              "[Outbox] Failed to insert appointment.confirmed event:",
              err
            );
          }
        }
      }

      return message;
    }),
  updateMetadata: protectedProcedure
    .input(
      z.object({
        messageId: z.number(),
        metadata: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Get the message to verify ownership
      const message = await db.getMessageById(input.messageId);

      if (!message) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message not found",
        });
      }

      // Verify user is part of the conversation
      const conversation = await db.getConversationById(message.conversationId);

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
          message: "Not authorized to update this message",
        });
      }

      // Update the message metadata
      await db.updateMessageMetadata(input.messageId, input.metadata);

      return { success: true };
    }),

  requestBalance: protectedProcedure
    .input(
      z.object({
        conversationId: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const conversation = await db.getConversationById(input.conversationId);
      if (!conversation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" });
      }

      if (conversation.artistId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only artists can request balance" });
      }

      const dbInst = await db.getDb();
      if (!dbInst) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const pendingSittings = await dbInst.query.appointments.findMany({
        where: and(
          eq(appointments.conversationId, input.conversationId),
          gt(appointments.remainingBalanceCents, 0),
          ne(appointments.status, "cancelled")
        ),
        orderBy: [appointments.startTime],
      });

      if (pendingSittings.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No sittings have a remaining balance." });
      }

      const nextSitting = pendingSittings[0];

      // Self-heal: if deposit was paid but remainingBalanceCents was never recalculated
      // (pre-v1.0.623 appointments) or totalPaidAmountCents was stored in dollars (pre-v1.0.626), fix the stored value now.
      let effectiveBalance = nextSitting.remainingBalanceCents;
      let totalPaid = nextSitting.totalPaidAmountCents || 0;
      const totalExpected = nextSitting.totalExpectedAmountCents || 0;
      const depositDollars = nextSitting.depositAmount || 0;
      
      // If totalPaid exactly equals depositDollars, it means it missed the * 100 multiplier!
      if (totalPaid > 0 && totalPaid === depositDollars) {
          totalPaid = depositDollars * 100;
          await dbInst.update(appointments).set({
            totalPaidAmountCents: totalPaid
          }).where(eq(appointments.id, nextSitting.id));
      }

      if (totalPaid > 0 && totalExpected > 0) {
        // Recalculate: what the client still owes = expected - already paid
        const recalculated = totalExpected - totalPaid;
        if (recalculated > 0 && recalculated !== effectiveBalance) {
          effectiveBalance = recalculated;
          // Persist the corrected value
          await dbInst.update(appointments).set({
            remainingBalanceCents: effectiveBalance,
          }).where(eq(appointments.id, nextSitting.id));
        }
      } else if (totalExpected > 0 && depositDollars > 0) {
        // Fallback: use depositAmount field (dollars) if totalPaidAmountCents was never set
        const depositCents = Math.round(depositDollars * 100);
        const recalculated = totalExpected - depositCents;
        if (recalculated > 0 && recalculated < effectiveBalance) {
          effectiveBalance = recalculated;
          await dbInst.update(appointments).set({
            remainingBalanceCents: effectiveBalance,
            totalPaidAmountCents: depositCents,
          }).where(eq(appointments.id, nextSitting.id));
        }
      }

      const { createDepositToken } = await import("../services/depositToken");
      const token = createDepositToken(nextSitting.id);
      
      const appUrl = process.env.APP_URL || process.env.VITE_APP_URL || "https://www.tattoi.app";
      const checkoutLink = `${appUrl}/balance/${nextSitting.id}?token=${token}`;

      // Format sitting date for the card
      const sittingDate = nextSitting.startTime
        ? new Date(nextSitting.startTime).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
        : undefined;
      const sittingTime = nextSitting.startTime
        ? new Date(nextSitting.startTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
        : undefined;

      await db.createMessage({
        conversationId: input.conversationId,
        senderId: ctx.user.id,
        content: `Payment Request: Final balance of $${(effectiveBalance / 100).toFixed(2)} for ${nextSitting.title || "your sitting"}.`,
        messageType: "system",
        metadata: JSON.stringify({
          type: "payment_request",
          amountCents: effectiveBalance,
          bookingId: nextSitting.id,
          sittingTitle: nextSitting.title || "Final Balance",
          sittingDate,
          sittingTime,
          checkoutUrl: checkoutLink,
        }),
      });

      // Push notification via outbox
      try {
        await dbInst.insert(notificationOutbox).values({
          eventType: "balance.requested",
          payloadJson: JSON.stringify({
            clientId: conversation.clientId,
            artistId: ctx.user.id,
            conversationId: input.conversationId,
            appointmentId: nextSitting.id,
            amountCents: effectiveBalance,
          }),
          status: "pending",
        });
      } catch (err) {
        console.error("[Outbox] Failed to insert balance.requested event:", err);
      }

      return { success: true };
    }),

  requestAdditional: protectedProcedure
    .input(
      z.object({
        conversationId: z.number(),
        amountDollars: z.number().positive("Amount must be positive"),
        description: z.string().min(1, "Description is required"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const conversation = await db.getConversationById(input.conversationId);
      if (!conversation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" });
      }

      if (conversation.artistId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only artists can request additional payment" });
      }

      const dbInst = await db.getDb();
      if (!dbInst) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Find the fully-paid appointment for this conversation
      const fullyPaidAppointment = await dbInst.query.appointments.findFirst({
        where: and(
          eq(appointments.conversationId, input.conversationId),
          eq(appointments.paymentStatus, "fully_paid"),
          ne(appointments.status, "cancelled")
        ),
        orderBy: [appointments.startTime],
      });

      if (!fullyPaidAppointment) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No fully-paid appointment found." });
      }

      const amountCents = Math.round(input.amountDollars * 100);

      // Update the appointment to reflect the new additional charges
      await dbInst.update(appointments).set({
        totalExpectedAmountCents: (fullyPaidAppointment.totalExpectedAmountCents || 0) + amountCents,
        remainingBalanceCents: amountCents,
        paymentStatus: "deposit_paid" as any, // Flip back from fully_paid
      }).where(eq(appointments.id, fullyPaidAppointment.id));

      const { createDepositToken } = await import("../services/depositToken");
      const token = createDepositToken(fullyPaidAppointment.id);

      const appUrl = process.env.APP_URL || process.env.VITE_APP_URL || "https://www.tattoi.app";
      const checkoutLink = `${appUrl}/balance/${fullyPaidAppointment.id}?token=${token}`;

      await db.createMessage({
        conversationId: input.conversationId,
        senderId: ctx.user.id,
        content: `Additional Charge: $${input.amountDollars.toFixed(2)} for ${input.description}.`,
        messageType: "system",
        metadata: JSON.stringify({
          type: "payment_request",
          amountCents,
          bookingId: fullyPaidAppointment.id,
          sittingTitle: input.description,
          checkoutUrl: checkoutLink,
        }),
      });

      // Push notification via outbox
      try {
        await dbInst.insert(notificationOutbox).values({
          eventType: "additional.requested",
          payloadJson: JSON.stringify({
            clientId: conversation.clientId,
            artistId: ctx.user.id,
            conversationId: input.conversationId,
            appointmentId: fullyPaidAppointment.id,
            amountCents,
            description: input.description,
          }),
          status: "pending",
        });
      } catch (err) {
        console.error("[Outbox] Failed to insert additional.requested event:", err);
      }

      return { success: true };
    }),
});

