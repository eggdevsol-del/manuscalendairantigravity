import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eventBus } from "../_core/eventBus";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { notificationOutbox } from "../../drizzle/schema";

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
            const conversation = await db.getConversationById(
                input.conversationId
            );

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

            const msgs = await db.getMessages(
                input.conversationId,
                input.limit
            );
            return msgs.reverse(); // Return in chronological order
        }),
    send: protectedProcedure
        .input(
            z.object({
                conversationId: z.number(),
                content: z.string(),
                messageType: z
                    .enum(["text", "system", "appointment_request", "appointment_confirmed", "image"])
                    .default("text"),
                metadata: z.string().optional(),
                consultationId: z.number().optional(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            // Verify user is part of this conversation
            const conversation = await db.getConversationById(
                input.conversationId
            );

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

            const message = await db.createMessage({
                conversationId: input.conversationId,
                senderId: ctx.user.id,
                content: input.content,
                messageType: input.messageType,
                metadata: input.metadata,
            });

            // Send push notification to the other user
            const recipientId = conversation.artistId === ctx.user.id
                ? conversation.clientId
                : conversation.artistId;

            // Only send push for regular messages (not system messages)
            if (input.messageType === "text" || input.messageType === "image") {
                const messagePreview = input.messageType === "image"
                    ? "Sent an image"
                    : input.content;

                // Event creation handled below via DB Outbox

                // Auto-update consultation status if artist replies
                if (ctx.user.id === conversation.artistId) {
                    try {
                        // 1. If explicit ID provided, use it
                        if (input.consultationId) {
                            await db.updateConsultation(input.consultationId, { status: "responded" });
                        }

                        // 2. ALSO check for any pending consultations between these two users
                        // This ensures that even if the ID wasn't passed, we catch it.
                        // We can't rely on getConsultationsForUser because it might be cached or filtered

                        // Get all consultations for this artist to match against client
                        const allConsults = await db.getConsultationsForUser(ctx.user.id, "artist");
                        const pendingForClient = allConsults.filter(
                            (c: any) => c.clientId === conversation.clientId && c.status === "pending"
                        );

                        for (const consult of pendingForClient) {
                            // Avoid double update if we already did it above
                            if (consult.id !== input.consultationId) {
                                await db.updateConsultation(consult.id, { status: "responded" });
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
                        await dbInst.insert(db.notificationOutbox || require('../../drizzle/schema').notificationOutbox).values({
                            eventType: 'message.created',
                            payloadJson: JSON.stringify({
                                targetUserId: recipientId,
                                title: ctx.user.name || "Someone",
                                body: messagePreview,
                                data: { conversationId: input.conversationId }
                            }),
                            status: 'pending',
                        });
                    } catch (err) {
                        console.error('[Outbox] Failed to insert message.created event:', err);
                    }
                }

            }

            // Send appointment confirmation notification
            if (input.messageType === "appointment_confirmed") {
                const dates = input.content.match(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), (\w+ \d+, \d{4})/g);
                const firstDate = dates && dates.length > 0 ? dates[0] : "soon";

                // Insert into outbox instead of eventBus.publish
                const dbInst = await db.getDb();
                if (dbInst) {
                    try {
                        await dbInst.insert(db.notificationOutbox || require('../../drizzle/schema').notificationOutbox).values({
                            eventType: 'appointment.confirmed',
                            payloadJson: JSON.stringify({
                                targetUserId: recipientId,
                                title: ctx.user.name || "A client",
                                body: `Appointment confirmed for ${firstDate}`, // Assuming body logic needed here or generic?
                                data: { conversationId: input.conversationId }
                            }),
                            status: 'pending',
                        });
                    } catch (err) {
                        console.error('[Outbox] Failed to insert appointment.confirmed event:', err);
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
});
