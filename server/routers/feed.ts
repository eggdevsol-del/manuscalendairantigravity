import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import * as schema from "../../drizzle/schema";
import { eq, and, asc, desc, sql, isNotNull, lt } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";

const R2_PUBLIC = (process.env.R2_PUBLIC_URL || "").replace(/\/$/, "");

/**
 * Resolve the best video URL for a portfolio item.
 * - R2 URLs are returned directly (CDN-served, no server bottleneck)
 * - Legacy Instagram CDN URLs fall back to the proxy endpoint
 * - Non-video items return null
 */
function resolveVideoUrl(item: {
  id: number;
  mediaType: string | null;
  cdnUrl: string | null;
}): string | null {
  if (item.mediaType !== "video" || !item.cdnUrl) return null;
  // If hosted on R2 or Cloudflare CDN, return direct URL (CDN-served, scales infinitely)
  if (
    item.cdnUrl.includes(".r2.dev") ||
    (R2_PUBLIC && item.cdnUrl.startsWith(R2_PUBLIC))
  ) {
    return item.cdnUrl;
  }
  // Stale legacy URL: return null so it renders as a photo rather than stalling video player with a 502
  return null;
}

export const feedRouter = router({
  /**
   * Get the discover feed — round-robin interleaved portfolio items across all artists.
   * Each "card" groups consecutive images from the same artist for carousel display.
   * Public-ish: requires auth (to track likes) but doesn't need artist role.
   */
  getDiscoverFeed: protectedProcedure
    .input(
      z.object({
        cursor: z.number().int().positive().optional(),
        limit: z.number().int().min(1).max(20).default(10),
        tag: z.string().max(100).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const {
        portfolios: p,
        users: u,
        artistSettings: settings,
        portfolioLikes: likes,
      } = schema;
      const conditions = [
        isNotNull(settings.publicSlug),
        eq(p.availabilityState, "available"),
        eq(u.hasCompletedOnboarding, 1),
      ];
      if (input.cursor) conditions.push(lt(p.id, input.cursor));
      if (input.tag)
        conditions.push(
          sql`JSON_CONTAINS(IF(JSON_VALID(${p.tags}), LOWER(${p.tags}), '[]'), ${JSON.stringify(input.tag.toLowerCase())})`
        );
      // A stable primary-key cursor avoids reshuffling, duplicate cards and offset drift.
      // Only one page and aggregate like counts cross the database boundary.
      const rows = await db
        .select({
          id: p.id,
          artistId: p.artistId,
          artistName: sql<string>`COALESCE(${settings.displayName}, ${u.name}, 'Artist')`,
          artistAvatar: u.avatar,
          artistCity: sql<
            string | null
          >`CASE WHEN ${settings.showCity} = 1 THEN ${u.city} ELSE NULL END`,
          artistSlug: settings.publicSlug,
          keywords: settings.keywords,
          imageUrl: p.imageUrl,
          description: p.description,
          createdAt: p.createdAt,
          mediaType: p.mediaType,
          cdnUrl: p.cdnUrl,
          tags: p.tags,
          likeCount:
            sql<number>`(SELECT COUNT(*) FROM ${likes} WHERE ${likes.portfolioId} = ${p.id})`.mapWith(
              Number
            ),
          isLiked:
            sql<number>`EXISTS(SELECT 1 FROM ${likes} WHERE ${likes.portfolioId} = ${p.id} AND ${likes.userId} = ${ctx.user.id})`.mapWith(
              Number
            ),
        })
        .from(p)
        .innerJoin(u, eq(u.id, p.artistId))
        .innerJoin(settings, eq(settings.userId, p.artistId))
        .where(and(...conditions))
        .orderBy(desc(p.id))
        .limit(input.limit + 1);
      const cards = rows.slice(0, input.limit).map(row => {
        let tags: string[] = [];
        try {
          const value = JSON.parse(row.tags || "[]");
          if (Array.isArray(value))
            tags = value.filter(
              (tag): tag is string => typeof tag === "string"
            );
        } catch {}
        return {
          ...row,
          keywords: (row.keywords || "")
            .split(",")
            .map(k => k.trim())
            .filter(Boolean),
          tags,
          isLiked: !!row.isLiked,
          videoUrl: resolveVideoUrl(row),
        };
      });
      return {
        cards,
        nextCursor:
          rows.length > input.limit ? cards[cards.length - 1].id : null,
      };
    }),

  /**
   * Get all portfolio items for a specific artist (for artist focus mode).
   */
  getArtistFeed: protectedProcedure
    .input(
      z.object({
        artistId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database connection failed",
        });

      // Get artist info
      const artistInfo = await db
        .select({
          userId: schema.users.id,
          name: schema.users.name,
          avatar: schema.users.avatar,
          city: schema.users.city,
          displayName: schema.artistSettings.displayName,
          publicSlug: schema.artistSettings.publicSlug,
          keywords: schema.artistSettings.keywords,
        })
        .from(schema.users)
        .innerJoin(
          schema.artistSettings,
          eq(schema.users.id, schema.artistSettings.userId)
        )
        .where(eq(schema.users.id, input.artistId))
        .limit(1);

      if (artistInfo.length === 0) {
        return { cards: [] };
      }

      const artist = artistInfo[0];

      // Get all portfolio items for this artist
      const portfolios = await db.query.portfolios.findMany({
        where: eq(schema.portfolios.artistId, input.artistId),
        orderBy: [
          desc(schema.portfolios.publishedAt),
          desc(schema.portfolios.createdAt),
        ],
        with: {
          likes: true,
        },
      });

      const cards = portfolios.map(item => ({
        id: item.id,
        artistId: artist.userId,
        artistName: artist.displayName || artist.name || "Artist",
        artistAvatar: artist.avatar,
        artistCity: artist.city,
        artistSlug: artist.publicSlug,
        keywords: artist.keywords
          ? artist.keywords.split(",").map((k: string) => k.trim())
          : [],
        imageUrl: item.imageUrl,
        description: item.description,
        createdAt: item.createdAt,
        mediaType: item.mediaType,
        videoUrl: resolveVideoUrl(item),
        likeCount: item.likes.length,
        isLiked: item.likes.some(
          (l: { userId: string }) => l.userId === ctx.user.id
        ),
        tags: (() => {
          try {
            return item.tags ? JSON.parse(item.tags as string) : [];
          } catch {
            return [];
          }
        })(),
      }));

      return { cards };
    }),

  /**
   * Get full artist public profile data for the profile overlay.
   */
  getArtistPublicProfile: protectedProcedure
    .input(z.object({ artistId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database connection failed",
        });

      // 1. Artist info: user + settings
      const rows = await db
        .select({
          id: schema.users.id,
          name: schema.users.name,
          avatar: schema.users.avatar,
          city: schema.users.city,
          bio: schema.users.bio,
          phone: schema.users.phone,
          displayName: schema.artistSettings.displayName,
          publicSlug: schema.artistSettings.publicSlug,
          keywords: schema.artistSettings.keywords,
          showEmail: schema.artistSettings.showEmail,
          showPhone: schema.artistSettings.showPhone,
          showCity: schema.artistSettings.showCity,
          showWebsite: schema.artistSettings.showWebsite,
          websiteUrl: schema.artistSettings.websiteUrl,
          businessEmail: schema.artistSettings.businessEmail,
        })
        .from(schema.users)
        .innerJoin(
          schema.artistSettings,
          eq(schema.users.id, schema.artistSettings.userId)
        )
        .where(eq(schema.users.id, input.artistId))
        .limit(1);

      if (rows.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Artist not found",
        });
      }

      const artist = rows[0];

      // 2. Portfolio items ordered by sortOrder ASC, createdAt DESC
      const portfolioItems = await db
        .select({
          id: schema.portfolios.id,
          imageUrl: schema.portfolios.imageUrl,
          description: schema.portfolios.description,
          sortOrder: schema.portfolios.sortOrder,
          mediaType: schema.portfolios.mediaType,
          cdnUrl: schema.portfolios.cdnUrl,
          tags: schema.portfolios.tags,
        })
        .from(schema.portfolios)
        .where(eq(schema.portfolios.artistId, input.artistId))
        .orderBy(
          asc(schema.portfolios.sortOrder),
          desc(schema.portfolios.publishedAt),
          desc(schema.portfolios.createdAt)
        );

      // 3. Total like count across all of this artist's portfolio items
      const likeCountResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.portfolioLikes)
        .innerJoin(
          schema.portfolios,
          eq(schema.portfolioLikes.portfolioId, schema.portfolios.id)
        )
        .where(eq(schema.portfolios.artistId, input.artistId));

      const totalLikes = likeCountResult[0]?.count ?? 0;

      // 4. Build response — conditionally expose contact fields
      const keywordsArray: string[] = artist.keywords
        ? artist.keywords
            .split(",")
            .map((k: string) => k.trim())
            .filter(Boolean)
        : [];

      return {
        id: artist.id,
        displayName: artist.displayName || artist.name || "Artist",
        avatar: artist.avatar,
        slug: artist.publicSlug,
        city: artist.showCity ? artist.city : null,
        bio: artist.bio,
        email: artist.showEmail ? artist.businessEmail : null,
        phone: artist.showPhone ? artist.phone : null,
        website: artist.showWebsite ? (artist.websiteUrl ?? null) : null,
        showCity: !!artist.showCity,
        keywords: keywordsArray,
        portfolio: portfolioItems.map(p => ({
          id: p.id,
          imageUrl: p.imageUrl,
          description: p.description,
          sortOrder: p.sortOrder ?? 0,
          mediaType: p.mediaType,
          videoUrl: resolveVideoUrl(p),
          tags: (() => {
            try {
              return p.tags ? JSON.parse(p.tags) : [];
            } catch {
              return [];
            }
          })(),
        })),
        postCount: portfolioItems.length,
        totalLikes,
      };
    }),

  /**
   * Public (unauthenticated) artist profile looked up by slug.
   * Returns the same shape as getArtistPublicProfile but omits
   * sensitive contact fields (email, phone, website).
   */
  getPublicArtistProfile: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database connection failed",
        });

      // 1. Resolve slug → artistSettings row
      const settingsRows = await db
        .select()
        .from(schema.artistSettings)
        .where(eq(schema.artistSettings.publicSlug, input.slug.toLowerCase()))
        .limit(1);

      if (settingsRows.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Artist not found",
        });
      }

      const settings = settingsRows[0];

      // 2. Fetch user row
      const userRows = await db
        .select({
          id: schema.users.id,
          name: schema.users.name,
          avatar: schema.users.avatar,
          city: schema.users.city,
          bio: schema.users.bio,
        })
        .from(schema.users)
        .where(eq(schema.users.id, settings.userId))
        .limit(1);

      if (userRows.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Artist not found",
        });
      }

      const user = userRows[0];

      // 3. Portfolio items ordered by sortOrder ASC
      const portfolioItems = await db
        .select({
          id: schema.portfolios.id,
          imageUrl: schema.portfolios.imageUrl,
          description: schema.portfolios.description,
          sortOrder: schema.portfolios.sortOrder,
          mediaType: schema.portfolios.mediaType,
          cdnUrl: schema.portfolios.cdnUrl,
        })
        .from(schema.portfolios)
        .where(
          and(
            eq(schema.portfolios.artistId, settings.userId),
            eq(schema.portfolios.availabilityState, "available")
          )
        )
        .orderBy(
          asc(schema.portfolios.sortOrder),
          desc(schema.portfolios.publishedAt),
          desc(schema.portfolios.createdAt)
        );

      // 4. Build response — no sensitive contact fields
      const keywordsArray: string[] = settings.keywords
        ? settings.keywords
            .split(",")
            .map((k: string) => k.trim())
            .filter(Boolean)
        : [];

      return {
        id: user.id,
        displayName: settings.displayName || user.name || "Artist",
        avatar: user.avatar,
        slug: settings.publicSlug,
        city: settings.showCity ? user.city : null,
        bio: user.bio,
        showCity: !!settings.showCity,
        bookingEnabled: !!settings.funnelEnabled,
        keywords: keywordsArray,
        portfolio: portfolioItems.map(p => ({
          id: p.id,
          imageUrl: p.imageUrl,
          description: p.description,
          sortOrder: p.sortOrder ?? 0,
          mediaType: p.mediaType,
          videoUrl: resolveVideoUrl(p),
        })),
        postCount: portfolioItems.length,
      };
    }),
});
