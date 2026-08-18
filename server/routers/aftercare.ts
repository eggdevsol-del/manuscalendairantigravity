import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { eq, and } from "drizzle-orm";
import * as schema from "../../drizzle/schema";

export const aftercareRouter = router({
  /**
   * Get the artist's aftercare template (with phases).
   * If no template exists, returns null (the migration seeds defaults on deploy).
   */
  getTemplate: protectedProcedure
    .input(z.object({ artistId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const dbRef = await db.getDb();
      if (!dbRef) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const targetArtistId = input.artistId || ctx.user.id;

      const template = await dbRef.query.aftercareTemplates.findFirst({
        where: and(
          eq(schema.aftercareTemplates.artistId, targetArtistId),
          eq(schema.aftercareTemplates.isDefault, 1),
        ),
        with: {
          phases: {
            orderBy: (phases, { asc }) => [asc(phases.sortOrder)],
          },
        },
      });

      return template || null;
    }),

  /**
   * Artist updates their aftercare template phases.
   */
  updateTemplate: protectedProcedure
    .input(z.object({
      templateId: z.number(),
      name: z.string().optional(),
      totalDays: z.number().optional(),
      phases: z.array(z.object({
        id: z.number().optional(), // existing phase ID (omit for new)
        fromDay: z.number(),
        toDay: z.number(),
        label: z.string(),
        instruction: z.string(),
        sortOrder: z.number(),
      })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const dbRef = await db.getDb();
      if (!dbRef) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Verify ownership
      const template = await dbRef.query.aftercareTemplates.findFirst({
        where: eq(schema.aftercareTemplates.id, input.templateId),
      });

      if (!template) throw new TRPCError({ code: "NOT_FOUND" });
      if (template.artistId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

      // Update template fields
      if (input.name || input.totalDays) {
        await dbRef.update(schema.aftercareTemplates).set({
          ...(input.name && { name: input.name }),
          ...(input.totalDays && { totalDays: input.totalDays }),
        }).where(eq(schema.aftercareTemplates.id, input.templateId));
      }

      // Replace phases if provided
      if (input.phases) {
        // Delete existing phases
        await dbRef.delete(schema.aftercarePhases)
          .where(eq(schema.aftercarePhases.templateId, input.templateId));

        // Insert new phases
        for (const phase of input.phases) {
          await dbRef.insert(schema.aftercarePhases).values({
            templateId: input.templateId,
            fromDay: phase.fromDay,
            toDay: phase.toDay,
            label: phase.label,
            instruction: phase.instruction,
            sortOrder: phase.sortOrder,
          });
        }
      }

      return { success: true };
    }),

  /**
   * Get aftercare data for a specific completed booking.
   * Returns the template phases + day count so the client can render the timeline.
   */
  getForBooking: protectedProcedure
    .input(z.object({ appointmentId: z.number() }))
    .query(async ({ ctx, input }) => {
      const dbRef = await db.getDb();
      if (!dbRef) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const appointment = await dbRef.query.appointments.findFirst({
        where: eq(schema.appointments.id, input.appointmentId),
      });

      if (!appointment) throw new TRPCError({ code: "NOT_FOUND" });

      // Must be the client or artist
      if (appointment.clientId !== ctx.user.id && appointment.artistId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Must be completed with a completedAt date
      if (!appointment.completedAt) {
        return null;
      }

      // Get the aftercare template (either the one saved on the appointment, or the artist's default)
      const templateId = appointment.aftercareTemplateId;
      let template;

      if (templateId) {
        template = await dbRef.query.aftercareTemplates.findFirst({
          where: eq(schema.aftercareTemplates.id, templateId),
          with: {
            phases: {
              orderBy: (phases, { asc }) => [asc(phases.sortOrder)],
            },
          },
        });
      }

      // Fallback to artist's default template
      if (!template) {
        template = await dbRef.query.aftercareTemplates.findFirst({
          where: and(
            eq(schema.aftercareTemplates.artistId, appointment.artistId),
            eq(schema.aftercareTemplates.isDefault, 1),
          ),
          with: {
            phases: {
              orderBy: (phases, { asc }) => [asc(phases.sortOrder)],
            },
          },
        });
      }

      if (!template) return null;

      // Calculate day count
      const completedDate = new Date(appointment.completedAt);
      const today = new Date();
      const diffMs = today.getTime() - completedDate.getTime();
      const daysSince = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;

      return {
        template,
        daysSince,
        totalDays: template.totalDays,
        isHealed: daysSince > template.totalDays,
        completedAt: appointment.completedAt,
        artistId: appointment.artistId,
      };
    }),
});
