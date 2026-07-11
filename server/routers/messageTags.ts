import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { messageTags } from "../../drizzle/schema";
import { and, eq } from "drizzle-orm";
import * as db from "../db";

export const messageTagsRouter = router({
  // Toggle a tag on/off for a message (idempotent)
  toggle: protectedProcedure
    .input(
      z.object({
        messageId: z.number(),
        conversationId: z.number(),
        tag: z.string().max(30).default("design"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Check if tag already exists
      const existing = await database.query.messageTags.findFirst({
        where: and(
          eq(messageTags.messageId, input.messageId),
          eq(messageTags.artistId, ctx.user.id),
          eq(messageTags.tag, input.tag)
        ),
      });

      if (existing) {
        // Remove the tag
        await database
          .delete(messageTags)
          .where(eq(messageTags.id, existing.id));
        return { tagged: false, tag: input.tag };
      } else {
        // Add the tag
        await database.insert(messageTags).values({
          messageId: input.messageId,
          conversationId: input.conversationId,
          artistId: ctx.user.id,
          tag: input.tag,
        });
        return { tagged: true, tag: input.tag };
      }
    }),

  // List all tags for a conversation
  list: protectedProcedure
    .input(
      z.object({
        conversationId: z.number(),
      })
    )
    .query(async ({ input, ctx }) => {
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const tags = await database.query.messageTags.findMany({
        where: and(
          eq(messageTags.conversationId, input.conversationId),
          eq(messageTags.artistId, ctx.user.id)
        ),
      });

      return tags;
    }),

  // Remove all tags for a conversation
  bulkRemove: protectedProcedure
    .input(
      z.object({
        conversationId: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await database
        .delete(messageTags)
        .where(
          and(
            eq(messageTags.conversationId, input.conversationId),
            eq(messageTags.artistId, ctx.user.id)
          )
        );

      return { success: true };
    }),
});
