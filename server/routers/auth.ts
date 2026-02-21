import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { authRouter as coreAuthRouter } from "../_core/auth-router";
import { getSessionCookieOptions } from "../_core/cookies";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import * as db from "../db";

export const authRouter = router({
    ...coreAuthRouter._def.procedures,
    me: publicProcedure.query((opts) => opts.ctx.user),
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
                name: z.string().optional(),
                phone: z.string().optional(),
                avatar: z.string().optional(),
                bio: z.string().optional(),
                savedSignature: z.string().optional(),
                address: z.string().optional(),
                city: z.string().optional(),
                birthday: z.string().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            return db.updateUserProfile(ctx.user.id, input);
        }),
    setRole: protectedProcedure
        .input(z.enum(["artist", "client"]))
        .mutation(async ({ ctx, input }) => {
            return db.updateUserProfile(ctx.user.id, {
                role: input,
                hasCompletedOnboarding: true
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
    listArtists: publicProcedure.query(async () => {
        // Get all users with artist or admin role
        return db.getArtists();
    }),
});
