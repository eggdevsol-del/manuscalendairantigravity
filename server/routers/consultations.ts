import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

export const consultationsRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          status: z
            .enum([
              "pending",
              "responded",
              "scheduled",
              "completed",
              "cancelled",
            ])
            .optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const consultations = await db.getConsultationsForUser(
        ctx.user.id,
        ctx.user.role,
        input?.status
      );

      // Enrich with user details
      const enriched = await Promise.all(
        consultations.map(async c => {
          const artist = c.artistId ? await db.getUser(c.artistId) : null;
          const client = c.clientId ? await db.getUser(c.clientId) : null;
          return {
            ...c,
            artist,
            client,
          };
        })
      );

      return enriched;
    }),
  create: protectedProcedure
    .input(
      z.object({
        artistId: z.string(),
        subject: z.string(),
        description: z.string(),
        placement: z.string().optional(),
        style: z.string().optional(),
        referenceUrls: z.array(z.string()).optional(),
        preferredDate: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Embed tattoo-specific metadata into description as structured text
      // so the artist sees all details without needing a schema change
      const parts: string[] = [];
      if (input.style) parts.push(`Style: ${input.style}`);
      if (input.placement) parts.push(`Placement: ${input.placement}`);
      if (input.description) parts.push(`\nDescription:\n${input.description}`);
      if (input.referenceUrls?.length) {
        parts.push(`\nReferences:\n${input.referenceUrls.join("\n")}`);
      }

      return db.createConsultation({
        clientId: ctx.user.id,
        artistId: input.artistId,
        subject: input.subject,
        description: parts.join("\n"),
        preferredDate: input.preferredDate
          ? new Date(input.preferredDate).toISOString()
          : undefined,
      });
    }),
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        status: z
          .enum(["pending", "responded", "scheduled", "completed", "cancelled"])
          .optional(),
        conversationId: z.number().optional(),
        viewed: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const consultation = await db.getConsultation(input.id);

      if (!consultation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Consultation not found",
        });
      }

      // Verify user is part of this consultation
      if (
        consultation.artistId !== ctx.user.id &&
        consultation.clientId !== ctx.user.id
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not authorized to update this consultation",
        });
      }

      const { id, ...updates } = input;
      return db.updateConsultation(id, updates);
    }),
});
