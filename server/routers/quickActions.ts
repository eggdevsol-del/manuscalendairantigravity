import { z } from "zod";
import { artistProcedure, router } from "../_core/trpc";
import * as db from "../db";

export const quickActionsRouter = router({
  list: artistProcedure.query(async ({ ctx }) => {
    return db.getQuickActionButtons(ctx.user.id);
  }),
  create: artistProcedure
    .input(
      z.object({
        label: z.string(),
        actionType: z.enum([
          "send_text",
          "find_availability",
          "deposit_info",
          "custom",
        ]),
        content: z.string(),
        position: z.number(),
        enabled: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const dbInput = { ...input, enabled: input.enabled ? 1 : 0 };
      return db.createQuickActionButton({
        userId: ctx.user.id,
        ...dbInput,
      } as any);
    }),
  update: artistProcedure
    .input(
      z.object({
        id: z.number(),
        label: z.string().optional(),
        actionType: z
          .enum(["send_text", "find_availability", "deposit_info", "custom"])
          .optional(),
        content: z.string().optional(),
        position: z.number().optional(),
        enabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, enabled, ...rest } = input;
      const updates: any = { ...rest };
      if (enabled !== undefined) updates.enabled = enabled ? 1 : 0;
      return db.updateQuickActionButton(id, updates);
    }),
  delete: artistProcedure.input(z.number()).mutation(async ({ input }) => {
    return db.deleteQuickActionButton(input);
  }),
});
