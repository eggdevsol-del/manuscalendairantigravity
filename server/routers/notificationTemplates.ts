import { z } from "zod";
import { artistProcedure, router } from "../_core/trpc";
import * as db from "../db";

export const notificationTemplatesRouter = router({
  list: artistProcedure.query(async ({ ctx }) => {
    return db.getNotificationTemplates(ctx.user.id);
  }),
  create: artistProcedure
    .input(
      z.object({
        templateType: z.enum([
          "confirmation",
          "reminder",
          "follow_up",
          "birthday",
          "promotional",
          "aftercare",
          "preparation",
          "custom",
        ]),
        title: z.string(),
        content: z.string(),
        timing: z.string().optional(),
        enabled: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return db.createNotificationTemplate({
        userId: ctx.user.id,
        ...input,
      });
    }),
  update: artistProcedure
    .input(
      z.object({
        id: z.number(),
        templateType: z
          .enum([
            "confirmation",
            "reminder",
            "follow_up",
            "birthday",
            "promotional",
            "aftercare",
            "preparation",
            "custom",
          ])
          .optional(),
        title: z.string().optional(),
        content: z.string().optional(),
        timing: z.string().optional(),
        enabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      return db.updateNotificationTemplate(id, updates);
    }),
  delete: artistProcedure.input(z.number()).mutation(async ({ input }) => {
    return db.deleteNotificationTemplate(input);
  }),
});
