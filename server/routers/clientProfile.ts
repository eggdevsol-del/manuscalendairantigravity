import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { moodboards, moodboardItems, users, consentForms, appointments } from "../../drizzle/schema";
import { eq, desc, and, gte } from "drizzle-orm";
import { z } from "zod";

export const clientProfileRouter = router({
    getProfile: protectedProcedure.query(async ({ ctx }) => {
        const user = await db.getUser(ctx.user.id);
        if (!user) {
            throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        }
        return user;
    }),

    updateBio: protectedProcedure
        .input(z.object({ bio: z.string().max(500) }))
        .mutation(async ({ ctx, input }) => {
            const database = await db.getDb();
            if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

            await database.update(users)
                .set({ bio: input.bio })
                .where(eq(users.id, ctx.user.id));

            return { success: true };
        }),

    updateAvatar: protectedProcedure
        .input(z.object({ avatarUrl: z.string().url() }))
        .mutation(async ({ ctx, input }) => {
            const database = await db.getDb();
            if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

            await database.update(users)
                .set({ avatar: input.avatarUrl })
                .where(eq(users.id, ctx.user.id));

            return { success: true };
        }),

    getSpendSummary: protectedProcedure.query(async ({ ctx }) => {
        const appointments = await db.getAppointmentsForUser(ctx.user.id, "client");

        const validAppointments = appointments.filter(a =>
            a.status === 'completed' || a.status === 'confirmed'
        );

        let totalSpend = 0;
        let maxSingleSpend = 0;

        validAppointments.forEach(appt => {
            const price = Number(appt.price || 0);
            totalSpend += price;
            if (price > maxSingleSpend) {
                maxSingleSpend = price;
            }
        });

        return {
            totalSpend,
            maxSingleSpend,
            appointmentCount: validAppointments.length
        };
    }),

    getHistory: protectedProcedure.query(async ({ ctx }) => {
        const allAppointments = await db.getAppointmentsForUser(ctx.user.id, "client");
        return allAppointments
            .filter(a => a.status === 'completed' || a.status === 'confirmed')
            .map(a => ({
                id: a.id,
                type: 'appointment',
                date: a.startTime,
                title: a.title,
                description: a.serviceName,
                status: a.status,
                price: a.price,
                depositAmount: a.depositAmount,
                clientPaid: a.clientPaid,
                paymentMethod: a.paymentMethod,
                actualStartTime: a.actualStartTime,
                actualEndTime: a.actualEndTime,
            }))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }),

    getUpcoming: protectedProcedure.query(async ({ ctx }) => {
        const allAppointments = await db.getAppointmentsForUser(ctx.user.id, "client");
        const now = new Date();
        return allAppointments
            .filter(a =>
                (a.status === 'pending' || a.status === 'confirmed') &&
                new Date(a.startTime) > now
            )
            .map(a => ({
                id: a.id,
                date: a.startTime,
                endDate: a.endTime,
                title: a.title,
                serviceName: a.serviceName,
                status: a.status,
                price: a.price,
                depositAmount: a.depositAmount,
                sessionNumber: a.sessionNumber,
                totalSessions: a.totalSessions,
            }))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }),

    getConsentForms: protectedProcedure.query(async ({ ctx }) => {
        const database = await db.getDb();
        if (!database) return [];

        return database.select()
            .from(consentForms)
            .where(eq(consentForms.clientId, ctx.user.id))
            .orderBy(desc(consentForms.createdAt));
    }),

    getBoards: protectedProcedure.query(async ({ ctx }) => {
        const database = await db.getDb();
        if (!database) return [];

        const userBoards = await database.select().from(moodboards)
            .where(eq(moodboards.clientId, ctx.user.id))
            .orderBy(desc(moodboards.createdAt));

        const boardsWithItems = await Promise.all(userBoards.map(async (board) => {
            const items = await database.select().from(moodboardItems)
                .where(eq(moodboardItems.moodboardId, board.id))
                .orderBy(desc(moodboardItems.createdAt))
                .limit(4);

            return {
                ...board,
                previewImages: items.map(i => i.imageUrl),
                itemCount: items.length
            };
        }));

        return boardsWithItems;
    }),

    createMoodboard: protectedProcedure
        .input(z.object({ title: z.string().min(1) }))
        .mutation(async ({ ctx, input }) => {
            const database = await db.getDb();
            if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

            await database.insert(moodboards).values({
                clientId: ctx.user.id,
                title: input.title
            });
            return { success: true };
        }),

    deleteMoodboard: protectedProcedure
        .input(z.object({ boardId: z.number() }))
        .mutation(async ({ ctx, input }) => {
            const database = await db.getDb();
            if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

            const board = await database.query.moodboards.findFirst({
                where: and(eq(moodboards.id, input.boardId), eq(moodboards.clientId, ctx.user.id))
            });
            if (!board) throw new TRPCError({ code: "FORBIDDEN" });

            await database.delete(moodboards).where(eq(moodboards.id, input.boardId));
            return { success: true };
        }),

    addMoodboardImage: protectedProcedure
        .input(z.object({ boardId: z.number(), imageUrl: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const database = await db.getDb();
            if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

            const board = await database.query.moodboards.findFirst({
                where: and(eq(moodboards.id, input.boardId), eq(moodboards.clientId, ctx.user.id))
            });
            if (!board) throw new TRPCError({ code: "FORBIDDEN" });

            await database.insert(moodboardItems).values({
                moodboardId: input.boardId,
                imageUrl: input.imageUrl
            });

            return { success: true };
        }),

    getPhotos: protectedProcedure.query(async ({ ctx }) => {
        const conversations = await db.getConversationsForUser(ctx.user.id, "client");

        const allPhotos: { id: number, url: string, createdAt: Date }[] = [];

        for (const conv of conversations) {
            const msgs = await db.getMessages(conv.id, 50);
            msgs.forEach(m => {
                if (m.senderId === ctx.user.id && m.messageType === 'image') {
                    allPhotos.push({
                        id: m.id,
                        url: m.content,
                        createdAt: m.createdAt ? new Date(m.createdAt) : new Date()
                    });
                }
            });
        }

        return allPhotos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    })
});
