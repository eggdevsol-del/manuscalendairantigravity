import {
  DEFAULT_CONSENT_TEMPLATE,
  DEFAULT_MEDICAL_TEMPLATE,
} from "../../shared/formTemplates";
import { router, protectedProcedure, artistProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import {
  consentForms,
  artistSettings,
  procedureLogs,
} from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { format } from "date-fns";

export const formsRouter = router({
  getTemplates: artistProcedure.query(async ({ ctx }) => {
    const database = await db.getDb();
    if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const settings = await database.query.artistSettings.findFirst({
      where: eq(artistSettings.userId, ctx.user.id),
    });

    return {
      consentTemplate: settings?.consentTemplate || DEFAULT_CONSENT_TEMPLATE,
      medicalTemplate: settings?.medicalTemplate || DEFAULT_MEDICAL_TEMPLATE,
      form9Template: settings?.form9Template || "",
    };
  }),

  updateTemplates: artistProcedure
    .input(
      z.object({
        consentTemplate: z.string().optional(),
        medicalTemplate: z.string().optional(),
        form9Template: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await database
        .insert(artistSettings)
        .values({
          userId: ctx.user.id,
          workSchedule: "{}",
          services: "[]",
          ...input,
        })
        .onDuplicateKeyUpdate({
          set: {
            ...input,
            updatedAt: format(new Date(), "yyyy-MM-dd HH:mm:ss"),
          },
        });

      return { success: true };
    }),

  getPendingForms: protectedProcedure
    .input(z.object({ appointmentId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const conditions = [eq(consentForms.clientId, ctx.user.id)];
      if (input.appointmentId) {
        conditions.push(eq(consentForms.appointmentId, input.appointmentId));
      }
      conditions.push(eq(consentForms.status, "pending"));

      return database
        .select()
        .from(consentForms)
        .where(and(...conditions))
        .orderBy(desc(consentForms.createdAt));
    }),

  signForm: protectedProcedure
    .input(
      z.object({
        formId: z.number(),
        signature: z
          .string()
          .max(500000)
          .regex(
            /^data:image\/png;base64,[A-Za-z0-9+/=]+$/,
            "Draw or select a valid signature."
          ),
        photoPermission: z.boolean().optional(),
        answers: z.record(z.string(), z.enum(["yes", "no"])).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const form = await database.query.consentForms.findFirst({
        where: and(
          eq(consentForms.id, input.formId),
          eq(consentForms.clientId, ctx.user.id)
        ),
      });

      if (!form) throw new TRPCError({ code: "NOT_FOUND" });

      if (form.status === "signed")
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "This form is already signed. Contact your artist to record an amendment.",
        });
      const questions =
        form.formType === "medical_release"
          ? [...(form.content || "").matchAll(/^(\d+)\.\s/gm)].map(
              match => match[1]
            )
          : [];
      if (questions.some(id => !input.answers?.[id]))
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Please answer every medical question.",
        });
      const [result] = await database
        .update(consentForms)
        .set({
          signature: input.signature,
          formData: JSON.stringify({
            answers: input.answers || {},
            photoPermission: input.photoPermission === true,
            content: form.content,
            title: form.title,
            version: 1,
            signedBy: ctx.user.id,
          }),
          signedAt: format(new Date(), "yyyy-MM-dd HH:mm:ss"),
          status: "signed",
          updatedAt: format(new Date(), "yyyy-MM-dd HH:mm:ss"),
        })
        .where(
          and(
            eq(consentForms.id, input.formId),
            eq(consentForms.status, "pending")
          )
        );
      if (result.affectedRows !== 1)
        throw new TRPCError({
          code: "CONFLICT",
          message: "This form has already been signed.",
        });

      return { success: true };
    }),

  getProcedureLogs: artistProcedure.query(async ({ ctx }) => {
    const database = await db.getDb();
    if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    return database
      .select()
      .from(procedureLogs)
      .where(eq(procedureLogs.artistId, ctx.user.id))
      .orderBy(desc(procedureLogs.date));
  }),
});
