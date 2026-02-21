import { router, protectedProcedure, artistProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { consentForms, artistSettings, procedureLogs } from "../../drizzle/schema";
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
            consentTemplate: settings?.consentTemplate || "",
            medicalTemplate: settings?.medicalTemplate || "",
            form9Template: settings?.form9Template || "",
        };
    }),

    updateTemplates: artistProcedure
        .input(z.object({
            consentTemplate: z.string().optional(),
            medicalTemplate: z.string().optional(),
            form9Template: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            const database = await db.getDb();
            if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

            await database.update(artistSettings)
                .set({
                    ...input,
                    updatedAt: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
                })
                .where(eq(artistSettings.userId, ctx.user.id));

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
            conditions.push(eq(consentForms.status, 'pending'));

            return database.select()
                .from(consentForms)
                .where(and(...conditions))
                .orderBy(desc(consentForms.createdAt));
        }),

    signForm: protectedProcedure
        .input(z.object({
            formId: z.number(),
            signature: z.string(), // Base64
        }))
        .mutation(async ({ ctx, input }) => {
            const database = await db.getDb();
            if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

            const form = await database.query.consentForms.findFirst({
                where: and(eq(consentForms.id, input.formId), eq(consentForms.clientId, ctx.user.id))
            });

            if (!form) throw new TRPCError({ code: "NOT_FOUND" });

            await database.update(consentForms)
                .set({
                    signature: input.signature,
                    signedAt: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
                    status: 'signed',
                    updatedAt: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
                })
                .where(eq(consentForms.id, input.formId));

            return { success: true };
        }),

    getProcedureLogs: artistProcedure.query(async ({ ctx }) => {
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        return database.select()
            .from(procedureLogs)
            .where(eq(procedureLogs.artistId, ctx.user.id))
            .orderBy(desc(procedureLogs.date));
    }),
});
