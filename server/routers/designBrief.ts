import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { designBriefs, messageTags, messages } from "../../drizzle/schema";
import { and, eq, desc } from "drizzle-orm";
import * as db from "../db";
import { compileDesignBrief, generatePersonalisedMessage, summariseConversationState } from "../services/llmEnrichment";

export const designBriefRouter = router({
  // Get cached brief for a conversation (or generate if stale)
  get: protectedProcedure
    .input(
      z.object({
        conversationId: z.number(),
      })
    )
    .query(async ({ input, ctx }) => {
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Get the cached brief
      const cached = await database.query.designBriefs.findFirst({
        where: and(
          eq(designBriefs.conversationId, input.conversationId),
          eq(designBriefs.artistId, ctx.user.id)
        ),
      });

      // Get latest tag timestamp
      const latestTag = await database.query.messageTags.findFirst({
        where: and(
          eq(messageTags.conversationId, input.conversationId),
          eq(messageTags.artistId, ctx.user.id)
        ),
        orderBy: [desc(messageTags.createdAt)],
      });

      // If no tags exist, return null
      if (!latestTag) {
        return { brief: null, messageCount: 0, isStale: false };
      }

      // If cached brief exists and is not stale, return it
      if (
        cached &&
        cached.lastTaggedAt &&
        latestTag.createdAt &&
        new Date(cached.lastTaggedAt) >= new Date(latestTag.createdAt)
      ) {
        return {
          brief: cached.briefText,
          messageCount: cached.messageCount,
          isStale: false,
          generatedAt: cached.generatedAt,
        };
      }

      // Brief is stale or doesn't exist — generate a new one
      try {
        const result = await compileDesignBrief(database, input.conversationId, ctx.user.id);

        // Upsert the brief
        if (cached) {
          await database
            .update(designBriefs)
            .set({
              briefText: result.briefText,
              messageCount: result.messageCount,
              lastTaggedAt: latestTag.createdAt,
              generatedAt: new Date().toISOString(),
            })
            .where(eq(designBriefs.id, cached.id));
        } else {
          await database.insert(designBriefs).values({
            conversationId: input.conversationId,
            artistId: ctx.user.id,
            briefText: result.briefText,
            messageCount: result.messageCount,
            lastTaggedAt: latestTag.createdAt,
          });
        }

        return {
          brief: result.briefText,
          messageCount: result.messageCount,
          isStale: false,
          generatedAt: new Date().toISOString(),
        };
      } catch (error) {
        console.error("Failed to generate design brief:", error);
        // Count how many tags actually exist
        const tagCount = await database.query.messageTags.findMany({
          where: and(
            eq(messageTags.conversationId, input.conversationId),
            eq(messageTags.artistId, ctx.user.id)
          ),
        });
        // Return cached version if available, even if stale
        if (cached) {
          return {
            brief: cached.briefText,
            messageCount: cached.messageCount,
            isStale: true,
            generatedAt: cached.generatedAt,
            error: "Brief refresh failed — showing cached version.",
          };
        }
        return {
          brief: null,
          messageCount: tagCount.length,
          isStale: false,
          error: "Failed to generate brief. Check LLM configuration.",
        };
      }
    }),

  // Force regenerate the brief
  refresh: protectedProcedure
    .input(
      z.object({
        conversationId: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const result = await compileDesignBrief(database, input.conversationId, ctx.user.id);

      const latestTag = await database.query.messageTags.findFirst({
        where: and(
          eq(messageTags.conversationId, input.conversationId),
          eq(messageTags.artistId, ctx.user.id)
        ),
        orderBy: [desc(messageTags.createdAt)],
      });

      // Upsert
      const existing = await database.query.designBriefs.findFirst({
        where: and(
          eq(designBriefs.conversationId, input.conversationId),
          eq(designBriefs.artistId, ctx.user.id)
        ),
      });

      if (existing) {
        await database
          .update(designBriefs)
          .set({
            briefText: result.briefText,
            messageCount: result.messageCount,
            lastTaggedAt: latestTag?.createdAt || null,
            generatedAt: new Date().toISOString(),
          })
          .where(eq(designBriefs.id, existing.id));
      } else {
        await database.insert(designBriefs).values({
          conversationId: input.conversationId,
          artistId: ctx.user.id,
          briefText: result.briefText,
          messageCount: result.messageCount,
          lastTaggedAt: latestTag?.createdAt || null,
        });
      }

      return {
        brief: result.briefText,
        messageCount: result.messageCount,
      };
    }),

  // Generate a personalised SMS/email draft for a task
  generateDraft: protectedProcedure
    .input(
      z.object({
        conversationId: z.number(),
        channel: z.enum(["sms", "email"]),
        taskContext: z.string().optional(),
        clientName: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const draft = await generatePersonalisedMessage(
        database,
        input.conversationId,
        ctx.user.id,
        input.channel,
        input.clientName,
        input.taskContext
      );

      return { draft };
    }),

  // Get a one-line conversation state summary for dashboard
  conversationState: protectedProcedure
    .input(
      z.object({
        conversationId: z.number(),
      })
    )
    .query(async ({ input, ctx }) => {
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const summary = await summariseConversationState(
        database,
        input.conversationId,
        ctx.user.id
      );

      return { summary };
    }),
});
