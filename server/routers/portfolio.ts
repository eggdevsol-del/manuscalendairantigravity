import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import * as schema from "../../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";
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
          artistId: z.string().optional(), // If provided, view specific artist, else view all (feed)
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

      const where = input?.artistId
        ? eq(schema.portfolios.artistId, input.artistId)
        : undefined; // TODO: For feed, maybe limit to random or recent

      const items = await db.query.portfolios.findMany({
        where,
        orderBy: desc(schema.portfolios.createdAt),
        with: {
          likes: true, // Simplification, ideally we count them
        },
        limit: 50,
      });

      // Map to add isLiked and likeCount
      return items.map(item => ({
        ...item,
        likeCount: item.likes.length,
        isLiked: item.likes.some(l => l.userId === ctx.user.id),
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

      await db
        .delete(schema.portfolios)
        .where(eq(schema.portfolios.id, input.id));
      return { success: true };
    }),
});
