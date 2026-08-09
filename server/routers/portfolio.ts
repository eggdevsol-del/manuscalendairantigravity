import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import * as schema from "../../drizzle/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";

export const portfolioRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        imageUrl: z.string(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "artist" && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database connection failed",
        });

      await db.insert(schema.portfolios).values({
        artistId: ctx.user.id,
        imageUrl: input.imageUrl,
        description: input.description,
      });

      return { success: true };
    }),

  list: protectedProcedure
    .input(
      z
        .object({
          artistId: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database connection failed",
        });

      const conditions = [];
      if (input?.artistId) {
        conditions.push(eq(schema.portfolios.artistId, input.artistId));
      }
      // Only show available items
      conditions.push(eq(schema.portfolios.availabilityState, "available"));

      const where = conditions.length > 1
        ? and(...conditions)
        : conditions[0];

      const items = await db.query.portfolios.findMany({
        where,
        orderBy: [schema.portfolios.sortOrder, desc(schema.portfolios.createdAt)],
        with: {
          likes: true,
          classifications: true,
        },
        limit: 500,
      });

      // Map to add isLiked, likeCount, and display URL
      return items.map(item => ({
        ...item,
        likeCount: item.likes.length,
        isLiked: item.likes.some(l => l.userId === ctx.user.id),
        displayUrl: item.thumbnailUrl || item.imageUrl,
      }));
    }),

  toggleLike: protectedProcedure
    .input(
      z.object({
        portfolioId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database connection failed",
        });

      const existing = await db.query.portfolioLikes.findFirst({
        where: and(
          eq(schema.portfolioLikes.portfolioId, input.portfolioId),
          eq(schema.portfolioLikes.userId, ctx.user.id)
        ),
      });

      if (existing) {
        await db
          .delete(schema.portfolioLikes)
          .where(eq(schema.portfolioLikes.id, existing.id));
        return { liked: false };
      } else {
        await db.insert(schema.portfolioLikes).values({
          portfolioId: input.portfolioId,
          userId: ctx.user.id,
        });
        return { liked: true };
      }
    }),

  delete: protectedProcedure
    .input(
      z.object({
        id: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database connection failed",
        });

      const item = await db.query.portfolios.findFirst({
        where: eq(schema.portfolios.id, input.id),
      });

      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
      if (item.artistId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Explicitly delete likes first (guards against missing CASCADE in DB)
      await db
        .delete(schema.portfolioLikes)
        .where(eq(schema.portfolioLikes.portfolioId, input.id));

      await db
        .delete(schema.portfolios)
        .where(eq(schema.portfolios.id, input.id));
      return { success: true };
    }),

  bulkDelete: protectedProcedure
    .input(
      z.object({
        ids: z.array(z.number()).min(1).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database connection failed",
        });

      if (ctx.user.role !== "artist" && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Verify ownership of all items
      const items = await db.query.portfolios.findMany({
        where: inArray(schema.portfolios.id, input.ids),
        columns: { id: true, artistId: true },
      });

      const ownedIds = items
        .filter(item => item.artistId === ctx.user.id || ctx.user.role === "admin")
        .map(item => item.id);

      if (ownedIds.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No matching items found" });
      }

      // Delete likes first
      await db
        .delete(schema.portfolioLikes)
        .where(inArray(schema.portfolioLikes.portfolioId, ownedIds));

      // Delete portfolio items
      await db
        .delete(schema.portfolios)
        .where(inArray(schema.portfolios.id, ownedIds));

      return { success: true, deletedCount: ownedIds.length };
    }),

  reorder: protectedProcedure
    .input(
      z.object({
        items: z.array(
          z.object({
            id: z.number(),
            sortOrder: z.number(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "artist" && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database connection failed",
        });

      // Batch update sort orders
      for (const item of input.items) {
        await db
          .update(schema.portfolios)
          .set({ sortOrder: item.sortOrder })
          .where(
            and(
              eq(schema.portfolios.id, item.id),
              eq(schema.portfolios.artistId, ctx.user.id)
            )
          );
      }

      return { success: true };
    }),
});
