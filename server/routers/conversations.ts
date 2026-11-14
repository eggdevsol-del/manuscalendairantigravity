import { requireConversationAccess } from "../services/access";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { getDb } from "../services/core";
import * as schema from "../../drizzle/schema";
import { eq, and, or, inArray, desc } from "drizzle-orm";
import * as pushService from "../services/pushService";
import {
  getClientRelationships,
  shareStudio,
} from "../services/userService";
import { toCounterpartIdentity } from "../services/identityService";

const isArtistRole = (role: string) => role === "artist" || role === "admin";

export const conversationsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const convos = await db.getConversationsForUser(ctx.user.id, ctx.user.role);
    const artistViewer = isArtistRole(ctx.user.role);
    const database = artistViewer ? await getDb() : null;
    const relationships = database
      ? await getClientRelationships(
          database,
          ctx.user.id,
          convos.map(c => c.clientId)
        )
      : null;

    // Fetch user details for each conversation
    const enriched = await Promise.all(
      convos.map(async conv => {
        const otherUserId =
          ((artistViewer ? conv.clientId : conv.artistId) || "") as string;
        const identity = await db.resolveIdentity(otherUserId, "user");
        // An artist sees a client's email and phone only once they really
        // work together.
        const otherUser = identity
          ? toCounterpartIdentity(identity, {
              email: !!relationships?.related.has(otherUserId),
              phone: !!relationships?.related.has(otherUserId),
              unclaimed: !!relationships?.unclaimed.has(otherUserId),
            })
          : undefined;

        if (ctx.user.role === "client" && otherUser) {
          const settings = await db.getArtistSettings(otherUserId);
          if (settings?.displayName) {
            otherUser.name = settings.displayName;
          }
          // Expose funnel banner, slug, and keywords for client profile cards
          (otherUser as any).publicSlug = settings?.publicSlug || null;
          (otherUser as any).funnelBannerUrl = settings?.funnelBannerUrl || null;
          (otherUser as any).keywords = settings?.keywords || null;
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
    .mutation(async ({ input, ctx }) => {
      if((ctx.user.role === "client" && ctx.user.id !== input.clientId) || (["artist","admin"].includes(ctx.user.role) && ctx.user.id !== input.artistId) || !["client","artist","admin"].includes(ctx.user.role)) throw new TRPCError({code:"FORBIDDEN",message:"You must be a participant in the conversation."});
      const existing = await db.getConversation(
        input.artistId,
        input.clientId
      );
      if (existing) return existing;

      const notAllowed = new TRPCError({
        code: "FORBIDDEN",
        message: "You can't start a conversation with this person.",
      });
      if (input.artistId === input.clientId) throw notAllowed;

      if (ctx.user.role === "client") {
        // A client may write to any real artist.
        const artist = await db.getUser(input.artistId);
        if (!artist || !isArtistRole(artist.role)) throw notAllowed;
      } else {
        // An artist may only open a conversation with someone they already
        // work with; otherwise any user id would become a "client" of theirs.
        const database = await getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const target = await db.getUser(input.clientId);
        if (!target) throw notAllowed;
        const { related } = await getClientRelationships(
          database,
          ctx.user.id,
          [target.id]
        );
        const allowed =
          (target.role === "client" && related.has(target.id)) ||
          (await shareStudio(database, ctx.user.id, target.id));
        if (!allowed) throw notAllowed;
      }

      return db.createConversation(input);
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
      const identity = await db.resolveIdentity(otherUserId, "user");
      const database =
        ctx.user.id === conversation.artistId ? await getDb() : null;
      const relationships = database
        ? await getClientRelationships(database, ctx.user.id, [otherUserId])
        : null;
      const otherUser = identity
        ? toCounterpartIdentity(identity, {
            email: !!relationships?.related.has(otherUserId),
            phone: !!relationships?.related.has(otherUserId),
            unclaimed: !!relationships?.unclaimed.has(otherUserId),
          })
        : undefined;

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
    .input(z.union([z.number(), z.object({ conversationId: z.number().int().positive(), messageIds: z.array(z.number().int().positive()).min(1).max(100) })]))
    .mutation(async ({ input, ctx }) => {
      const conversationId = typeof input === "number" ? input : input.conversationId;
      const database=await getDb();if(!database)throw new TRPCError({code:"INTERNAL_SERVER_ERROR"});
      await requireConversationAccess(database,conversationId,ctx.user.id);
      await db.markMessagesAsRead(conversationId, ctx.user.id, typeof input === "number" ? undefined : input.messageIds);
      if (ctx.user.role === "artist" || ctx.user.role === "admin") {
        await db.markConsultationAsViewed(conversationId);
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

      // Batch-fetch leads for all clients (for hasLead detection)
      const allLeads = await database.query.leads.findMany({
        where: and(
          eq(schema.leads.artistId, ctx.user.id),
          inArray(schema.leads.clientId, clientIds)
        ),
        columns: { clientId: true },
      });
      const clientsWithLeads = new Set(allLeads.map(l => l.clientId).filter(Boolean));

      const now = new Date().toISOString();
      // Contact and personal details only for people the artist really works with.
      const { related } = await getClientRelationships(
        database,
        ctx.user.id,
        clientIds
      );

      const clientsData = await Promise.all(
        clientIds.map(async clientId => {
          const found = await db.getUser(clientId);
          if (!found) return null;
          // Someone who is only a conversation row shows as a name and
          // picture until they write, book or pay.
          const profileAvailable = related.has(clientId);
          const user = profileAvailable
            ? found
            : {
                ...found,
                email: null,
                phone: null,
                gender: null,
                birthday: null,
                city: null,
                country: null,
              };

          // Apply direct demographic filters (location, birthday) safely
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
          let hasUpcoming = false;

          for (const appt of clientAppts) {
            if (appt.status === "completed") {
              sittings += 1;
            }
            // Check for upcoming appointments
            if (
              (appt.status === "confirmed" || appt.status === "pending") &&
              appt.startTime > now
            ) {
              hasUpcoming = true;
            }
            // amountPaid is stored as whole dollars (int), not cents
            if (appt.clientPaid === 1 && appt.amountPaid) {
              tlv += appt.amountPaid;
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
            hasUpcoming,
            hasLead: clientsWithLeads.has(clientId),
            hasPushSubscription,
            profileAvailable,
          };
        })
      );

      return clientsData.filter(Boolean);
    }),

  bulkMessageClients: protectedProcedure
    .input(
      z.object({
        clientIds: z.array(z.string()).max(1000),
        messageContent: z.string().trim().min(1).max(5000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "artist" && ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only artists can bulk message clients",
        });
      }

      const database = await getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Real clients of this artist only: a conversation row alone is
      // something the artist can create, so it does not make someone a
      // recipient.
      const requested = Array.from(new Set(input.clientIds));
      const { related } = await getClientRelationships(
        database,
        ctx.user.id,
        requested
      );
      const recipients = requested.filter(id => related.has(id));

      // A broadcast is a promotion. Someone who unsubscribed from promotions,
      // or has every promotion channel switched off, does not get one. A row
      // with both channels off is all an unsubscribe leaves behind, so that
      // is what counts; no row at all means they never said no.
      const preferences: { userId: string; sms: number; push: number }[] =
        recipients.length > 0
          ? await database
              .select({
                userId: schema.offerPreferences.userId,
                sms: schema.offerPreferences.sms,
                push: schema.offerPreferences.push,
              })
              .from(schema.offerPreferences)
              .where(inArray(schema.offerPreferences.userId, recipients))
          : [];
      const promotionsOff = new Set(
        preferences.filter(p => !p.sms && !p.push).map(p => p.userId)
      );

      let successfullySent = 0;
      let optedOut = 0;

      for (const clientId of recipients) {
        if (promotionsOff.has(clientId)) {
          optedOut++;
          continue;
        }
        // Already confirmed as this artist's client above (a lead,
        // consultation or plan can come before any chat), so a missing chat
        // is opened rather than the client silently skipped.
        const conversation =
          (await db.getConversation(ctx.user.id, clientId)) ??
          (await db.createConversation({ artistId: ctx.user.id, clientId }));
        if (!conversation) continue;

        // Push actual message payload to the conversation thread directly
        await db.createMessage({
          conversationId: conversation.id,
          senderId: ctx.user.id,
          content: input.messageContent,
          messageType: "text",
        });

        successfullySent++;
      }

      return {
        success: true,
        count: successfullySent,
        /** Selected people who were not messaged, for any reason. */
        skipped: requested.length - successfullySent,
        /** Of those, the ones with promotions switched off. */
        optedOut,
        /** Of those, the ones who are not this artist's clients. */
        notClients: requested.length - recipients.length,
      };
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

      // An email the artist types proves nothing about the account behind
      // it, so an existing account is only reused when it is already this
      // artist's client.
      const matches: { id: string }[] = input.email
        ? await database
            .select({ id: schema.users.id })
            .from(schema.users)
            .where(eq(schema.users.email, input.email))
            .limit(20)
        : [];
      const { related } = await getClientRelationships(
        database,
        ctx.user.id,
        matches.map(m => m.id)
      );
      const known = matches.find(m => related.has(m.id));

      let clientId: string;

      if (known) {
        clientId = known.id;
      } else {
        clientId = `client_${Date.now()}_${randomBytes(6).toString("hex")}`;
        await db.createUser({
          id: clientId,
          name: input.name,
          // Sign-in finds accounts by email, so a second record must not
          // carry an email that already belongs to someone.
          email: matches.length > 0 ? null : input.email,
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

  deleteAllClientsForArtist: protectedProcedure.mutation(async ({ ctx }) => {
    if (ctx.user.role !== "artist" && ctx.user.role !== "admin") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only artists can delete their clients list",
      });
    }

    // Removes the artist's own unpaid bookings and conversations. It refuses
    // while sittings are coming up or money is involved, and never touches
    // client accounts, paid bookings or signed forms.
    return db.deleteAllClientsForArtist(ctx.user.id);
  }),
});
