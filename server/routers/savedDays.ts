import { z } from "zod";
import { and, eq, gte, inArray } from "drizzle-orm";
import { artistProcedure, router } from "../_core/trpc";
import { getDb } from "../services/core";
import * as schema from "../../drizzle/schema";

/** Days an artist saved for clients from "Fill this day", so the booking composer can offer them on any
 *  device. Keys are "client:<id>" or "conversation:<id>". */
const key = z.string().regex(/^(client|conversation):\S{1,80}$/);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const database = async () => {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db;
};

export const savedDaysRouter = router({
  /** Saved days from `today` onward, as a map of key to day. */
  list: artistProcedure.input(z.object({ today: day })).query(async ({ ctx, input }) => {
    const db = await database();
    const rows = await db
      .select({ clientKey: schema.savedDays.clientKey, day: schema.savedDays.day })
      .from(schema.savedDays)
      .where(and(eq(schema.savedDays.artistId, ctx.user.id), gte(schema.savedDays.day, input.today)));
    return Object.fromEntries(rows.map(r => [r.clientKey, r.day])) as Record<string, string>;
  }),
  save: artistProcedure
    .input(z.object({ keys: z.array(key).min(1).max(4), day }))
    .mutation(async ({ ctx, input }) => {
      const db = await database();
      for (const clientKey of input.keys)
        await db
          .insert(schema.savedDays)
          .values({ artistId: ctx.user.id, clientKey, day: input.day })
          .onDuplicateKeyUpdate({ set: { day: input.day } });
      return { ok: true };
    }),
  forget: artistProcedure
    .input(z.object({ keys: z.array(key).min(1).max(4) }))
    .mutation(async ({ ctx, input }) => {
      const db = await database();
      await db
        .delete(schema.savedDays)
        .where(and(eq(schema.savedDays.artistId, ctx.user.id), inArray(schema.savedDays.clientKey, input.keys)));
      return { ok: true };
    }),
});
