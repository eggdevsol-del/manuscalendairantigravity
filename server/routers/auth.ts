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
        country: z.string().max(100).optional(),
        birthday: z.string().max(20).optional(),
        gender: z.enum(["male", "female", "other", "prefer_not_to_say"]).optional(),
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
  listArtists: protectedProcedure
    .input(
      z.object({
        lat: z.number().optional(),
        lng: z.number().optional(),
        sortBy: z.enum(["all", "distance", "popularity"]).optional().default("all"),
      }).optional()
    )
    .query(async ({ input }) => {
      const database = await db.getDb();
      if (!database) return [];

      // Get all users with artist or admin role
      const artists = await db.getArtists();

      const { eq, or, sql } = await import("drizzle-orm");
      const { appointments } = await import("../../drizzle/schema");

      // Fetch count of completed/confirmed appointments group by artistId
      const bookingCounts = await database
        .select({
          artistId: appointments.artistId,
          bookingCount: sql<number>`count(${appointments.id})`.mapWith(Number),
        })
        .from(appointments)
        .where(
          or(
            eq(appointments.status, "completed"),
            eq(appointments.status, "confirmed")
          )
        )
        .groupBy(appointments.artistId);

      const countMap = new Map<string, number>();
      bookingCounts.forEach((b) => {
        countMap.set(b.artistId, b.bookingCount);
      });

      // Enrich artists with booking count and optionally calculate distance
      let enrichedArtists = artists.map((artist) => {
        const bookingCount = countMap.get(artist.id) || 0;
        let distance: number | null = null;

        if (input?.lat && input?.lng && artist.lat != null && artist.lng != null) {
          const clientLat = input.lat;
          const clientLng = input.lng;
          const lat1 = Number(artist.lat);
          const lng1 = Number(artist.lng);

          const dLat = ((lat1 - clientLat) * Math.PI) / 180;
          const dLng = ((lng1 - clientLng) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((clientLat * Math.PI) / 180) *
              Math.cos((lat1 * Math.PI) / 180) *
              Math.sin(dLng / 2) *
              Math.sin(dLng / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          distance = 6371 * c; // in km
        }

        return {
          ...artist,
          bookingCount,
          distance,
        };
      });

      // Sort
      const sortBy = input?.sortBy || "all";
      if (sortBy === "popularity") {
        enrichedArtists.sort((a, b) => b.bookingCount - a.bookingCount);
      } else if (sortBy === "distance") {
        enrichedArtists.sort((a, b) => {
          const distA = a.distance ?? Infinity;
          const distB = b.distance ?? Infinity;
          return distA - distB;
        });
      }

      return enrichedArtists;
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
