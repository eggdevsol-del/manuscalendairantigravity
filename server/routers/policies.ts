import { z } from "zod";
import { artistProcedure, publicProcedure, router } from "../_core/trpc";
import * as db from "../db";

export const policiesRouter = router({
  list: artistProcedure.query(async ({ ctx }) => {
    return db.getPolicies(ctx.user.id);
  }),
  getByType: publicProcedure
    .input(
      z.object({
        artistId: z.string(),
        policyType: z.enum(["deposit", "design", "reschedule", "cancellation"]),
      })
    )
    .query(async ({ input }) => {
      return db.getPolicyByType(input.artistId, input.policyType);
    }),
  upsert: artistProcedure
    .input(
      z.object({
        policyType: z.enum(["deposit", "design", "reschedule", "cancellation"]),
        title: z.string(),
        content: z.string(),
        enabled: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const dbInput = { ...input, enabled: input.enabled ? 1 : 0 };
      return db.upsertPolicy({
        artistId: ctx.user.id,
        ...dbInput,
      } as any);
    }),
  delete: artistProcedure.input(z.number()).mutation(async ({ input }) => {
    return db.deletePolicy(input);
  }),
});
