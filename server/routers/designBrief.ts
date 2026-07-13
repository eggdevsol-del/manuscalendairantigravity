import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { designBriefs } from "../../drizzle/schema";
import { and, eq } from "drizzle-orm";
import * as db from "../db";
import { generatePersonalisedMessage, summariseConversationState } from "../services/llmEnrichment";

export const designBriefRouter = router({
  /**
   * Get conversation brief — analyses the full conversation via LLM.
   * No tags required. Cache invalidates when a new message arrives.
   */
  get: protectedProcedure
    .input(
      z.object({
        conversationId: z.number(),
      })
    )
    .query(async ({ input, ctx }) => {
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      try {
        const summary = await summariseConversationState(
          database,
          input.conversationId,
          ctx.user.id
        );

        return {
          brief: summary,
          isStale: false,
        };
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error("Failed to generate conversation brief:", errMsg);

        // Return cached version if available
        const cached = await database.query.designBriefs.findFirst({
          where: and(
            eq(designBriefs.conversationId, input.conversationId),
            eq(designBriefs.artistId, ctx.user.id)
          ),
        });

        let userError = "Failed to generate brief.";
        if (errMsg.includes("insufficient_quota") || errMsg.includes("429")) {
          userError = "LLM quota exceeded — please top up your OpenAI billing or use a different API key.";
        } else if (errMsg.includes("401") || errMsg.includes("Unauthorized")) {
          userError = "LLM API key is invalid — check OPENAI_API_KEY in your .env file.";
        } else if (errMsg.includes("OPENAI_API_KEY is not configured")) {
          userError = "No LLM API key configured — add OPENAI_API_KEY to your .env file.";
        } else {
          userError = `LLM error: ${errMsg.substring(0, 120)}`;
        }

        if (cached?.conversationSummary) {
          return {
            brief: cached.conversationSummary,
            isStale: true,
            error: `Brief refresh failed — showing cached version. (${userError})`,
          };
        }
        return {
          brief: null,
          isStale: false,
          error: userError,
        };
      }
    }),

  /**
   * Force regenerate the conversation brief.
   * Clears the cached summaryGeneratedAt to force a fresh LLM call.
   */
  refresh: protectedProcedure
    .input(
      z.object({
        conversationId: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Clear cached summary to force regeneration
      const existing = await database.query.designBriefs.findFirst({
        where: and(
          eq(designBriefs.conversationId, input.conversationId),
          eq(designBriefs.artistId, ctx.user.id)
        ),
      });

      if (existing) {
        await database
          .update(designBriefs)
          .set({ summaryGeneratedAt: null })
          .where(eq(designBriefs.id, existing.id));
      }

      // Now generate fresh
      const summary = await summariseConversationState(
        database,
        input.conversationId,
        ctx.user.id
      );

      return { brief: summary };
    }),

  // Generate a personalised SMS/email draft for a task
  generateDraft: protectedProcedure
    .input(
      z.object({
        conversationId: z.number(),
        channel: z.enum(["sms", "email"]),
        taskContext: z.string().optional(),
        clientName: z.string(),
        taskType: z.string().optional(),
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
        input.taskContext,
        input.taskType
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
