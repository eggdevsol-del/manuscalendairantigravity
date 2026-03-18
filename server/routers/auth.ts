import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { authRouter as coreAuthRouter } from "../_core/auth-router";
import { getSessionCookieOptions } from "../_core/cookies";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import * as db from "../db";

export const authRouter = router({
  ...coreAuthRouter._def.procedures,
  me: publicProcedure.query(opts => opts.ctx.user),
  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return {
      success: true,
    } as const;
  }),
  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().max(100).optional(),
        phone: z.string().max(30).optional(),
        avatar: z.string().max(2000).optional(),
        bio: z.string().max(500).optional(),
        savedSignature: z.string().max(50000).optional(),
        address: z.string().max(300).optional(),
        city: z.string().max(100).optional(),
        birthday: z.string().max(20).optional(),
        instagramUsername: z.string().max(60).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return db.updateUserProfile(ctx.user.id, input);
    }),
  setRole: protectedProcedure
    .input(z.enum(["artist", "client"]))
    .mutation(async ({ ctx, input }) => {
      // Only allow role selection during onboarding (before completion)
      if (ctx.user.hasCompletedOnboarding) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Role cannot be changed after onboarding is complete",
        });
      }
      return db.updateUserProfile(ctx.user.id, {
        role: input,
      });
    }),
  completeOnboarding: protectedProcedure.mutation(async ({ ctx }) => {
    await db.updateUserProfile(ctx.user.id, {
      hasCompletedOnboarding: 1,
    });
  }),
  linkInstagram: protectedProcedure
    .input(
      z.object({
        instagramUsername: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return db.updateUserProfile(ctx.user.id, {
        instagramUsername: input.instagramUsername,
      });
    }),
  getInstagramAuthUrl: publicProcedure.query(() => {
    // For now, return empty string - will be replaced with real OAuth URL
    // when Instagram credentials are configured
    return { url: "" };
  }),
  listArtists: protectedProcedure.query(async () => {
    // Get all users with artist or admin role
    return db.getArtists();
  }),
  deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
    const database = await db.getDb();
    if (!database) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    }

    // Explicit deletions if cascaded foreign keys aren't strictly enforced in Drizzle.
    const { eq } = await import("drizzle-orm");
    const schema = await import("../../drizzle/schema");

    // Clear session cookies via empty response logic handles by client-side logout
    await database.delete(schema.users).where(eq(schema.users.id, ctx.user.id));

    return { success: true };
  }),
});
