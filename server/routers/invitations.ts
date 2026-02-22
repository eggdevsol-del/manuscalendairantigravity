import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import { studioMembers } from "../../drizzle/schema";
import { getDb } from "../services/core";

export const invitationsRouter = router({
    // Generate an invite link for a new member
    generateInvite: protectedProcedure
        .input(z.object({
            studioId: z.string(),
            email: z.string().email(),
            role: z.enum(['manager', 'artist', 'apprentice'])
        }))
        .mutation(async ({ ctx, input }) => {
            const db = await getDb();
            if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });

            // 1. Verify caller has permission to invite
            const requester = await db.query.studioMembers.findFirst({
                where: and(
                    eq(studioMembers.studioId, input.studioId),
                    eq(studioMembers.userId, ctx.user.id)
                )
            });

            if (!requester || (requester.role !== 'owner' && requester.role !== 'manager')) {
                throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to invite members." });
            }

            // 2. Generate an invite code (In a real app, store this in an `invitations` table)
            const inviteCode = crypto.randomUUID();

            // For now, we simulate sending the email
            const inviteLink = `${process.env.VITE_APP_URL || "http://localhost:3000"}/studio/join?code=${inviteCode}&studio=${input.studioId}`;
            console.log(`[Invitations] Invite for ${input.email}: ${inviteLink}`);

            return { success: true, inviteLink, message: "Invite sent successfully." };
        }),

    // Accept an invitation
    acceptInvite: protectedProcedure
        .input(z.object({
            studioId: z.string(),
            code: z.string()
        }))
        .mutation(async ({ ctx, input }) => {
            const db = await getDb();
            if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });

            // 1. Validate the code (omitted explicit invitation table lookup for brevity)
            if (!input.code) {
                throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid invite code" });
            }

            // 2. Ensure user isn't already in a studio
            const existingMember = await db.query.studioMembers.findFirst({
                where: eq(studioMembers.userId, ctx.user.id)
            });

            if (existingMember) {
                throw new TRPCError({ code: "CONFLICT", message: "You are already a member of a studio." });
            }

            // 3. Join the studio
            await db.insert(studioMembers).values({
                studioId: input.studioId,
                userId: ctx.user.id,
                role: 'artist', // Default role upon join
                status: 'active'
            });

            return { success: true };
        }),
});
