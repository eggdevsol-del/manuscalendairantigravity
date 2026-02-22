import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import { studios, studioMembers, users } from "drizzle/schema";
import { getDb } from "../services/core";

export const studiosRouter = router({
    // Get the current user's studio details
    getCurrentStudio: protectedProcedure
        .query(async ({ ctx }) => {
            const db = await getDb();
            if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });

            const results = await db
                .select({
                    id: studios.id,
                    name: studios.name,
                    ownerId: studios.ownerId,
                    stripeSubscriptionId: studios.stripeSubscriptionId,
                    subscriptionStatus: studios.subscriptionStatus,
                    subscriptionTier: studios.subscriptionTier,
                    role: studioMembers.role,
                    status: studioMembers.status
                })
                .from(studioMembers)
                .innerJoin(studios, eq(studios.id, studioMembers.studioId))
                .where(and(
                    eq(studioMembers.userId, ctx.user.id),
                    eq(studioMembers.status, 'active')
                ))
                .limit(1);

            if (results.length === 0) {
                return null;
            }

            return results[0];
        }),

    // TESTING ONLY: Bypass Stripe and jump directly to evaluating a tier
    testUpgradeStudio: protectedProcedure
        .input(z.object({ tier: z.enum(['solo', 'studio']) }))
        .mutation(async ({ ctx, input }) => {
            const db = await getDb();
            if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

            const membership = await db.query.studioMembers.findFirst({
                where: and(eq(studioMembers.userId, ctx.user.id), eq(studioMembers.role, 'owner'))
            });

            if (!membership) {
                // Instantly create and upgrade studio
                const studioId = crypto.randomUUID();
                await db.insert(studios).values({
                    id: studioId,
                    name: "My Studio",
                    ownerId: ctx.user.id,
                    subscriptionTier: input.tier,
                    subscriptionStatus: 'active'
                });
                await db.insert(studioMembers).values({
                    studioId,
                    userId: ctx.user.id,
                    role: 'owner',
                    status: 'active'
                });
                return { success: true };
            }

            // Update existing studio
            await db.update(studios)
                .set({ subscriptionTier: input.tier, subscriptionStatus: 'active' })
                .where(eq(studios.id, membership.studioId));

            return { success: true };
        }),

    // Upgrade a Solo artist to a Studio owner
    createStudio: protectedProcedure
        .input(z.object({
            name: z.string().min(2, "Studio name must be at least 2 characters")
        }))
        .mutation(async ({ ctx, input }) => {
            const db = await getDb();
            if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });

            // 1. Check if user is already in a studio
            const existingMember = await db.query.studioMembers.findFirst({
                where: eq(studioMembers.userId, ctx.user.id)
            });

            if (existingMember) {
                throw new TRPCError({
                    code: "CONFLICT",
                    message: "User is already part of a studio."
                });
            }

            const studioId = crypto.randomUUID();

            // 2. Create the studio
            await db.insert(studios).values({
                id: studioId,
                name: input.name,
                ownerId: ctx.user.id,
                subscriptionTier: 'studio',
                subscriptionStatus: 'active' // In a real flow, this waits for Stripe webhook
            });

            // 3. Make the user the owner
            await db.insert(studioMembers).values({
                studioId,
                userId: ctx.user.id,
                role: 'owner',
                status: 'active'
            });

            return { success: true, studioId };
        }),

    // Get all members of a studio
    getStudioMembers: protectedProcedure
        .input(z.object({
            studioId: z.string()
        }))
        .query(async ({ ctx, input }) => {
            const db = await getDb();
            if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });

            // 1. Verify access
            const isMember = await db.query.studioMembers.findFirst({
                where: and(
                    eq(studioMembers.studioId, input.studioId),
                    eq(studioMembers.userId, ctx.user.id)
                )
            });

            if (!isMember) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "You do not have access to this studio's members."
                });
            }

            // 2. Safely return members (Using query builder as Drizzle relationships can struggle without explicit config)
            const members = await db
                .select({
                    id: studioMembers.id,
                    role: studioMembers.role,
                    status: studioMembers.status,
                    createdAt: studioMembers.createdAt,
                    user: {
                        id: users.id,
                        name: users.name,
                        email: users.email,
                        avatar: users.avatar
                    }
                })
                .from(studioMembers)
                .innerJoin(users, eq(users.id, studioMembers.userId))
                .where(eq(studioMembers.studioId, input.studioId));

            return members;
        }),

    // Remove a member or leave a studio
    removeMember: protectedProcedure
        .input(z.object({
            studioId: z.string(),
            userId: z.string()
        }))
        .mutation(async ({ ctx, input }) => {
            const db = await getDb();
            if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });

            const requester = await db.query.studioMembers.findFirst({
                where: and(
                    eq(studioMembers.studioId, input.studioId),
                    eq(studioMembers.userId, ctx.user.id)
                )
            });

            if (!requester) {
                throw new TRPCError({ code: "FORBIDDEN" });
            }

            // Only owners or the user themselves can remove a member
            if (requester.role !== 'owner' && ctx.user.id !== input.userId) {
                throw new TRPCError({ code: "FORBIDDEN", message: "Only owners can remove other members." });
            }

            // Prevent removing the sole owner without transferring ownership first
            if (requester.role === 'owner' && ctx.user.id === input.userId) {
                const ownerCount = await db
                    .select()
                    .from(studioMembers)
                    .where(and(
                        eq(studioMembers.studioId, input.studioId),
                        eq(studioMembers.role, 'owner')
                    ));

                if (ownerCount.length <= 1) {
                    throw new TRPCError({
                        code: "PRECONDITION_FAILED",
                        message: "Cannot leave studio as the sole owner. Transfer ownership or delete the studio."
                    });
                }
            }

            await db
                .delete(studioMembers)
                .where(and(
                    eq(studioMembers.studioId, input.studioId),
                    eq(studioMembers.userId, input.userId)
                ));

            return { success: true };
        }),
});
