import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { eq, and, sql } from "drizzle-orm";
import { studios, studioMembers, users, conversations, messages } from "drizzle/schema";
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

    // Get public studio profile by slug, including active artists
    getStudioProfile: publicProcedure
        .input(z.object({
            slug: z.string()
        }))
        .query(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });

            const studio = await db.query.studios.findFirst({
                where: eq(studios.publicSlug, input.slug)
            });

            if (!studio) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Studio not found" });
            }

            // Get active artists in the studio
            const members = await db
                .select({
                    id: users.id,
                    name: users.name,
                    avatar: users.avatar,
                    bio: users.bio
                })
                .from(studioMembers)
                .innerJoin(users, eq(users.id, studioMembers.userId))
                .where(and(
                    eq(studioMembers.studioId, studio.id),
                    eq(studioMembers.status, 'active'),
                    // Assuming we only want to list people taking bookings
                    // For now, list everyone active
                ));

            return {
                studio,
                artists: members
            };
        }),

    // Invite an artist to the studio
    inviteArtist: protectedProcedure
        .input(z.object({
            studioId: z.string(),
            artistEmail: z.string().email(),
            role: z.enum(['owner', 'manager', 'artist', 'apprentice'])
        }))
        .mutation(async ({ ctx, input }) => {
            const db = await getDb();
            if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });

            // 1. Verify access (must be owner or manager)
            const requester = await db.query.studioMembers.findFirst({
                where: and(
                    eq(studioMembers.studioId, input.studioId),
                    eq(studioMembers.userId, ctx.user.id),
                    eq(studioMembers.status, 'active')
                )
            });

            if (!requester || (requester.role !== 'owner' && requester.role !== 'manager')) {
                throw new TRPCError({ code: "FORBIDDEN", message: "Only owners or managers can invite artists." });
            }

            // 2. Find the user by email
            const invitedUser = await db.query.users.findFirst({
                where: eq(users.email, input.artistEmail)
            });

            if (!invitedUser) {
                throw new TRPCError({ code: "NOT_FOUND", message: "User with this email not found." });
            }

            // 3. Check if they are already in the studio
            const existingMember = await db.query.studioMembers.findFirst({
                where: and(
                    eq(studioMembers.studioId, input.studioId),
                    eq(studioMembers.userId, invitedUser.id)
                )
            });

            let newMemberId: number;

            if (existingMember) {
                if (existingMember.status === 'active') {
                    throw new TRPCError({ code: "CONFLICT", message: "User is already an active member of this studio." });
                } else if (existingMember.status === 'pending_invite') {
                    throw new TRPCError({ code: "CONFLICT", message: "User already has a pending invite." });
                } else {
                    // They declined or were inactive, re-invite them
                    await db.update(studioMembers).set({ status: 'pending_invite', role: input.role }).where(eq(studioMembers.id, existingMember.id));
                    newMemberId = existingMember.id;
                }
            } else {
                // 4. Create pending invite
                // Using a unique constraint on studioId + userId, so insert is safe
                const [memberInsertResult] = await db.insert(studioMembers).values({
                    studioId: input.studioId,
                    userId: invitedUser.id,
                    role: input.role,
                    status: 'pending_invite'
                });
                newMemberId = memberInsertResult.insertId;
            }

            // 5. Fetch Studio Details for the Message
            const studio = await db.query.studios.findFirst({
                where: eq(studios.id, input.studioId)
            });

            if (studio) {
                // 6. Find or Create a Conversation between the Owner and the Artist
                let conversation = await db.query.conversations.findFirst({
                    where: and(
                        eq(conversations.artistId, invitedUser.id), // Invited artist receiving message
                        eq(conversations.clientId, ctx.user.id) // Studio Owner sending as 'client' in this context
                    )
                });

                if (!conversation) {
                    const [convResult] = await db.insert(conversations).values({
                        artistId: invitedUser.id,
                        clientId: ctx.user.id,
                    });
                    conversation = await db.query.conversations.findFirst({
                        where: eq(conversations.id, convResult.insertId)
                    });
                }

                if (conversation) {
                    // 7. Insert the 'studio_invite' message
                    await db.insert(messages).values({
                        conversationId: conversation.id,
                        senderId: ctx.user.id,
                        content: `I've invited you to join ${studio.name} as a resident artist!`,
                        messageType: 'studio_invite',
                        metadata: JSON.stringify({
                            studioId: studio.id,
                            studioName: studio.name,
                            inviteId: newMemberId, // Store the pending invite ID so we can respond to it easily
                            status: 'pending'      // 'pending', 'accepted', 'declined'
                        })
                    });

                    // Update conversation timestamp formats cleanly for MySQL Date types
                    await db.update(conversations)
                        .set({ lastMessageAt: sql`now()` })
                        .where(eq(conversations.id, conversation.id));
                }
            }

            return { success: true };
        }),

    // Get pending invites for the logged-in user
    getPendingInvites: protectedProcedure
        .query(async ({ ctx }) => {
            const db = await getDb();
            if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });

            const invites = await db
                .select({
                    id: studioMembers.id,
                    role: studioMembers.role,
                    createdAt: studioMembers.createdAt,
                    studio: {
                        id: studios.id,
                        name: studios.name,
                        logoUrl: studios.logoUrl
                    }
                })
                .from(studioMembers)
                .innerJoin(studios, eq(studios.id, studioMembers.studioId))
                .where(and(
                    eq(studioMembers.userId, ctx.user.id),
                    eq(studioMembers.status, 'pending_invite')
                ));

            return invites;
        }),

    // Respond to an invite
    respondToInvite: protectedProcedure
        .input(z.object({
            inviteId: z.number(),
            response: z.enum(['accept', 'decline'])
        }))
        .mutation(async ({ ctx, input }) => {
            const db = await getDb();
            if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });

            const invite = await db.query.studioMembers.findFirst({
                where: and(
                    eq(studioMembers.id, input.inviteId),
                    eq(studioMembers.userId, ctx.user.id),
                    eq(studioMembers.status, 'pending_invite')
                )
            });

            if (!invite) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Invite not found or already processed." });
            }

            if (input.response === 'accept') {
                await db.update(studioMembers)
                    .set({ status: 'active' })
                    .where(eq(studioMembers.id, input.inviteId));
            } else {
                await db.update(studioMembers)
                    .set({ status: 'declined' })
                    .where(eq(studioMembers.id, input.inviteId));
            }

            // Also find the message and update its metadata so the UI reflects the decision
            // Doing a robust search for any message containing this inviteId in metadata
            const allMessages = await db.query.messages.findMany({
                where: eq(messages.messageType, 'studio_invite')
            });

            for (const msg of allMessages) {
                if (msg.metadata) {
                    try {
                        const meta = JSON.parse(msg.metadata);
                        if (meta.inviteId === input.inviteId) {
                            meta.status = input.response === 'accept' ? 'accepted' : 'declined';
                            await db.update(messages)
                                .set({ metadata: JSON.stringify(meta) })
                                .where(eq(messages.id, msg.id));
                        }
                    } catch (e) {
                        // Ignore parse errors from invalid metadata
                    }
                }
            }

            return { success: true };
        }),
});
