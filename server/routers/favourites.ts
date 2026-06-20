import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";
import { favouriteArtists } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

export const favouritesRouter = router({
  /** List all favourited artist IDs for the current client */
  list: protectedProcedure.query(async ({ ctx }) => {
    const dbRef = await db.getDb();
    if (!dbRef) return [];

    const rows = await dbRef
      .select({ artistId: favouriteArtists.artistId })
      .from(favouriteArtists)
      .where(eq(favouriteArtists.clientId, ctx.user.id));
    return rows.map(r => r.artistId);
  }),

  /** Toggle favourite — adds if not exists, removes if exists */
  toggle: protectedProcedure
    .input(z.object({ artistId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const dbRef = await db.getDb();
      if (!dbRef) return { favourited: false };

      const existing = await dbRef
        .select({ id: favouriteArtists.id })
        .from(favouriteArtists)
        .where(
          and(
            eq(favouriteArtists.clientId, ctx.user.id),
            eq(favouriteArtists.artistId, input.artistId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await dbRef
          .delete(favouriteArtists)
          .where(eq(favouriteArtists.id, existing[0].id));
        return { favourited: false };
      } else {
        await dbRef.insert(favouriteArtists).values({
          clientId: ctx.user.id,
          artistId: input.artistId,
        });
        return { favourited: true };
      }
    }),
});
