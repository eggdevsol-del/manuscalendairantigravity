import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { getDb } from "../services/core";
import * as schema from "../../drizzle/schema";
import { eq, and, or, inArray, desc } from "drizzle-orm";
import * as pushService from "../services/pushService";

export const conversationsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const convos = await db.getConversationsForUser(ctx.user.id, ctx.user.role);

    // Fetch user details for each conversation
    const enriched = await Promise.all(
      convos.map(async conv => {
        const otherUserId =
          ((ctx.user.role === "artist" ? conv.clientId : conv.artistId) || "") as string;
        const otherUser = await db.resolveIdentity(otherUserId, "user");

        if (ctx.user.role === "client" && otherUser) {
          const settings = await db.getArtistSettings(otherUserId);
          if (settings?.displayName) {
            otherUser.name = settings.displayName;
          }
        }

        const unreadCount = await db.getUnreadMessageCount(
          conv.id,
          ctx.user.id
        );

        return {
          ...conv,
          otherUser,
          unreadCount,
        };
      })
    );

    return enriched;
  }),
  getOrCreate: protectedProcedure
    .input(
      z.object({
        artistId: z.string(),
        clientId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      let conversation = await db.getConversation(
        input.artistId,
        input.clientId
      );

      if (!conversation) {
        conversation = await db.createConversation(input);
      }

      return conversation;
    }),
  getById: protectedProcedure
    .input(z.number())
    .query(async ({ input, ctx }) => {
      const conversation = await db.getConversationById(input);

      if (!conversation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found",
        });
      }

      // Verify user is part of this conversation
      if (
        conversation.artistId !== ctx.user.id &&
        conversation.clientId !== ctx.user.id
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not authorized to view this conversation",
        });
      }

      // Get the other user's details
      const otherUserId =
        ((ctx.user.id === conversation.artistId
          ? conversation.clientId
          : conversation.artistId) || "") as string;
      const otherUser = await db.resolveIdentity(otherUserId, "user");

      if (ctx.user.id === conversation.clientId && otherUser) {
        const settings = await db.getArtistSettings(otherUserId);
        if (settings?.displayName) {
          otherUser.name = settings.displayName;
        }
      }

      return {
        ...conversation,
        otherUser,
      };
    }),
  markAsRead: protectedProcedure
    .input(z.number())
    .mutation(async ({ input, ctx }) => {
      await db.markMessagesAsRead(input, ctx.user.id);
      if (ctx.user.role === "artist") {
        await db.markConsultationAsViewed(input);
      }
      return { success: true };
    }),
  pinConsultation: protectedProcedure
    .input(
      z.object({
        conversationId: z.number(),
        consultationId: z.number().nullable(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Verify ownership
      const conversation = await db.getConversationById(input.conversationId);
      if (!conversation) throw new TRPCError({ code: "NOT_FOUND" });

      // Only artist should be able to pin? Or both? User said "artist should have the option to Pin it"
      if (ctx.user.id !== conversation.artistId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only artists can pin consultations",
        });
      }

      // Update conversation
      await db.pinConsultation(input.conversationId, input.consultationId);

      return { success: true };
    }),

  /**
   * Get media (images) associated with a client
   * Fetches reference images and body placement images from leads
   */
  getClientMedia: protectedProcedure
    .input(
      z.object({
        clientId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const database = await getDb();
      if (!database) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database connection failed",
        });
      }

      // Get leads for this client with the current artist
      const leads = await database.query.leads.findMany({
        where: and(
          eq(schema.leads.artistId, ctx.user.id),
          or(
            eq(schema.leads.clientId, input.clientId),
            eq(
              schema.leads.clientEmail,
              // Get email from users table
              database
                .select({ email: schema.users.email })
                .from(schema.users)
                .where(eq(schema.users.id, input.clientId))
                .limit(1)
            )
          )
        ),
      });

      // Collect all images from leads
      const referenceImages: {
        url: string;
        type: "reference";
        leadId: number;
      }[] = [];
      const bodyPlacementImages: {
        url: string;
        type: "body_placement";
        leadId: number;
      }[] = [];

      for (const lead of leads) {
        // Parse reference images
        if (lead.referenceImages) {
          try {
            const images = JSON.parse(lead.referenceImages);
            if (Array.isArray(images)) {
              images.forEach((url: string) => {
                referenceImages.push({
                  url,
                  type: "reference",
                  leadId: lead.id,
                });
              });
            }
          } catch (e) {
            console.error("Failed to parse referenceImages:", e);
          }
        }

        // Parse body placement images
        if (lead.bodyPlacementImages) {
          try {
            const images = JSON.parse(lead.bodyPlacementImages);
            if (Array.isArray(images)) {
              images.forEach((url: string) => {
                bodyPlacementImages.push({
                  url,
                  type: "body_placement",
                  leadId: lead.id,
                });
              });
            }
          } catch (e) {
            console.error("Failed to parse bodyPlacementImages:", e);
          }
        }
      }

      return {
        referenceImages,
        bodyPlacementImages,
        totalCount: referenceImages.length + bodyPlacementImages.length,
      };
    }),

  /**
   * Get list of clients for the current artist
   * Used by promotions feature to send promotions to specific clients
   */
  getClients: protectedProcedure
    .input(z.object({
      location: z.string().optional(),
      minTlv: z.number().optional(),
      maxTlv: z.number().optional(),
      birthMonth: z.number().optional(), // 1-12
      minSittings: z.number().optional(),
      maxSittings: z.number().optional(),
      gender: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "artist" && ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only artists can access client list",
        });
      }

      const database = await getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const convos = await db.getConversationsForUser(ctx.user.id, "artist");

      // Get unique clients from conversations
      const clientIdsSet = new Set(convos.map(c => c.clientId));
      const clientIds = Array.from(clientIdsSet).filter(Boolean) as string[];
      if (clientIds.length === 0) return [];

      // Fetch all relevant appointments at once to construct TLV and sittings
      const allAppointments = await database.query.appointments.findMany({
        where: and(
          eq(schema.appointments.artistId, ctx.user.id),
          inArray(schema.appointments.clientId, clientIds)
        )
      });

      const clientsData = await Promise.all(
        clientIds.map(async clientId => {
          const user = await db.getUser(clientId);
          if (!user) return null;

          // Apply direct demographic filters (gender, location, birthday) safely
          if (input?.gender && user.gender !== input.gender) return null;
          if (input?.location) {
            const cityMatch = user.city ? user.city.toLowerCase().includes(input.location.toLowerCase()) : false;
            const countryMatch = user.country ? user.country.toLowerCase().includes(input.location.toLowerCase()) : false;
            if (!cityMatch && !countryMatch) return null;
          }
          if (input?.birthMonth && user.birthday) {
            const bMonth = new Date(user.birthday).getMonth() + 1;
            if (bMonth !== input.birthMonth) return null;
          }

          const clientAppts = allAppointments.filter(a => a.clientId === clientId);

          let tlv = 0;
          let sittings = 0;

          for (const appt of clientAppts) {
            if (appt.status === "completed") {
              sittings += 1;
            }
            if (appt.clientPaid === 1 && appt.amountPaid) {
              tlv += (appt.amountPaid / 100); // Assuming cents based on context
            } else if (appt.clientPaid === 1 && appt.price) {
              tlv += appt.price; // fallback if amountPaid isn't recorded but it is checked out
            }
          }

          if (input?.minTlv !== undefined && tlv < input.minTlv) return null;
          if (input?.maxTlv !== undefined && tlv > input.maxTlv) return null;
          if (input?.minSittings !== undefined && sittings < input.minSittings) return null;
          if (input?.maxSittings !== undefined && sittings > input.maxSittings) return null;

          // Use pushService to check subscription status (SSOT)
          const hasPushSubscription =
            await pushService.hasActiveSubscription(clientId);

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            city: user.city,
            country: user.country,
            gender: user.gender,
            birthday: user.birthday,
            avatar: user.avatar,
            tlv,
            sittings,
            hasPushSubscription,
          };
        })
      );

      return clientsData.filter(Boolean);
    }),

  bulkMessageClients: protectedProcedure
    .input(z.object({
      clientIds: z.array(z.string()),
      messageContent: z.string().min(1)
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "artist" && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only artists can bulk message clients" });
      }

      const database = await getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      let successfullySent = 0;

      for (const clientId of input.clientIds) {
        // Find or create conversation dynamically natively
        let conversation: any = await db.getConversation(ctx.user.id, clientId);
        if (!conversation) {
          conversation = await db.createConversation({
            artistId: ctx.user.id,
            clientId: clientId
          });
        }

        if (!conversation) continue;

        // Push actual message payload to the conversation thread directly
        await db.createMessage({
          conversationId: conversation.id,
          senderId: ctx.user.id,
          content: input.messageContent,
          messageType: "text"
        });

        successfullySent++;
      }

      return { success: true, count: successfullySent };
    }),

  createClient: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        email: z.string().email().optional().nullable(),
        phone: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "artist" && ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only artists can create clients",
        });
      }

      const database = await getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Check if client exists by email (if provided)
      let existingUser = null;
      if (input.email) {
        const results = await database
          .select()
          .from(schema.users)
          .where(eq(schema.users.email, input.email))
          .limit(1);
        existingUser = results[0];
      }

      let clientId: string;

      if (existingUser) {
        clientId = existingUser.id;
      } else {
        // Create new user
        clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await db.createUser({
          id: clientId,
          name: input.name,
          email: input.email,
          phone: input.phone,
          role: "client",
          hasCompletedOnboarding: 1 as any, // TinyInt fix?
        });
      }

      // Create/Get conversation
      let conversation = await db.getConversation(ctx.user.id, clientId);
      if (!conversation) {
        conversation = await db.createConversation({
          artistId: ctx.user.id,
          clientId: clientId,
        });
      }

      return conversation;
    }),

  deleteAllClientsForArtist: protectedProcedure
    .mutation(async ({ ctx }) => {
      if (ctx.user.role !== "artist" && ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only artists can delete their clients list",
        });
      }

      const database = await getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Severing the artist's conversations effectively empties their client roster.
      // Simultaneously wiping appointments tied to them ensures total wiped state for the feature.
      await database.delete(schema.conversations).where(eq(schema.conversations.artistId, ctx.user.id));
      await database.delete(schema.appointments).where(eq(schema.appointments.artistId, ctx.user.id));

      return { success: true };
    }),
});
