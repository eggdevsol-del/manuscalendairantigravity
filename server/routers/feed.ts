import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import * as schema from "../../drizzle/schema";
import { eq, and, asc, desc, sql, isNotNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";

export const feedRouter = router({
  /**
   * Get the discover feed — round-robin interleaved portfolio items across all artists.
   * Each "card" groups consecutive images from the same artist for carousel display.
   * Public-ish: requires auth (to track likes) but doesn't need artist role.
   */
  getDiscoverFeed: protectedProcedure
    .input(
      z.object({
        cursor: z.number().optional(), // offset-based pagination
        limit: z.number().min(1).max(20).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database connection failed",
        });

      // 1. Get all artists who have portfolio items and are onboarded
      const artistsWithPortfolios = await db
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
        .where(
          and(
            isNotNull(schema.artistSettings.publicSlug),
            eq(schema.users.hasCompletedOnboarding, 1)
          )
        );

      if (artistsWithPortfolios.length === 0) {
        return { cards: [], nextCursor: null };
      }

      // 2. Get all portfolio items grouped by artist
      const artistIds = artistsWithPortfolios.map((a) => a.userId);
      const allPortfolios = await db.query.portfolios.findMany({
        where: sql`${schema.portfolios.artistId} IN (${sql.join(
          artistIds.map((id) => sql`${id}`),
          sql`, `
        )})`,
        orderBy: desc(schema.portfolios.createdAt),
        with: {
          likes: true,
        },
      });

      // 3. Group portfolios by artist
      const portfoliosByArtist = new Map<string, typeof allPortfolios>();
      for (const item of allPortfolios) {
        const existing = portfoliosByArtist.get(item.artistId) || [];
        existing.push(item);
        portfoliosByArtist.set(item.artistId, existing);
      }

      // Filter to only artists that actually have portfolio items
      const activeArtists = artistsWithPortfolios.filter(
        (a) => (portfoliosByArtist.get(a.userId)?.length || 0) > 0
      );

      if (activeArtists.length === 0) {
        return { cards: [], nextCursor: null };
      }

      // 4. Round-robin interleave: create feed cards
      // Each card = one portfolio item with artist info
      // Cycle through artists equally, wrapping smaller portfolios
      const feedCards: Array<{
        id: number;
        artistId: string;
        artistName: string;
        artistAvatar: string | null;
        artistCity: string | null;
        artistSlug: string | null;
        keywords: string[];
        imageUrl: string;
        description: string | null;
        createdAt: string | null;
        likeCount: number;
        isLiked: boolean;
      }> = [];

      // Determine max portfolio length for round-robin cycles
      const maxLen = Math.max(
        ...activeArtists.map(
          (a) => portfoliosByArtist.get(a.userId)?.length || 0
        )
      );

      // Shuffle artists for variety (seeded by date so consistent within a day)
      const shuffled = [...activeArtists].sort(
        () => Math.random() - 0.5
      );

      for (let i = 0; i < maxLen; i++) {
        for (const artist of shuffled) {
          const items = portfoliosByArtist.get(artist.userId) || [];
          if (items.length === 0) continue;
          // Wrap around for smaller portfolios
          const item = items[i % items.length];
          // Don't add duplicates from wrapping in a single feed load
          if (i >= items.length) continue;

          feedCards.push({
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
            likeCount: item.likes.length,
            isLiked: item.likes.some(
              (l: { userId: string }) => l.userId === ctx.user.id
            ),
          });
        }
      }

      // 5. Paginate
      const offset = input.cursor || 0;
      const page = feedCards.slice(offset, offset + input.limit);
      const nextCursor =
        offset + input.limit < feedCards.length
          ? offset + input.limit
          : null;

      return { cards: page, nextCursor };
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
        orderBy: desc(schema.portfolios.createdAt),
        with: {
          likes: true,
        },
      });

      const cards = portfolios.map((item) => ({
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
        likeCount: item.likes.length,
        isLiked: item.likes.some(
          (l: { userId: string }) => l.userId === ctx.user.id
        ),
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
        })
        .from(schema.portfolios)
        .where(eq(schema.portfolios.artistId, input.artistId))
        .orderBy(
          asc(schema.portfolios.sortOrder),
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
        portfolio: portfolioItems.map((p) => ({
          id: p.id,
          imageUrl: p.imageUrl,
          description: p.description,
          sortOrder: p.sortOrder ?? 0,
        })),
        postCount: portfolioItems.length,
        totalLikes,
      };
    }),
});
