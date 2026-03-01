import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { users, conversations } from "../../drizzle/schema";
import { z } from "zod";
import { eq, and, or } from "drizzle-orm";

export const dataImportRouter = router({
    bulkImportClients: protectedProcedure
        .input(
            z.object({
                clients: z.array(
                    z.object({
                        name: z.string().min(1),
                        email: z.string().email().optional().or(z.literal("")),
                        phone: z.string().optional().or(z.literal("")),
                        source: z.string().optional(),
                    })
                ),
            })
        )
        .mutation(async ({ ctx, input }) => {
            // Must be an artist or admin to import to an artist's workspace
            if (ctx.user.role !== "artist" && ctx.user.role !== "admin") {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "Only artists can import data directly.",
                });
            }

            const database = await db.getDb();
            if (!database) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Database not available",
                });
            }

            const results = {
                success: 0,
                skipped: 0,
                failed: 0,
            };

            // Since Drizzle handles upserts or batching differently per driver,
            // and we need to check if the user is ALREADY the artist's client,
            // we do this safely in chunks. For SQLite/Turso, batch limits apply.

            for (const client of input.clients) {
                try {
                    if (!client.email && !client.phone) {
                        results.skipped++;
                        continue;
                    }

                    // 1. Find existing global user by email or phone
                    const conditions = [];
                    if (client.email) conditions.push(eq(users.email, client.email));
                    if (client.phone) conditions.push(eq(users.phone, client.phone));

                    let existingUser = null;
                    if (conditions.length > 0) {
                        existingUser = await database.query.users.findFirst({
                            where: or(...conditions)
                        });
                    }

                    let clientId = "";

                    // 2. Insert or Map
                    if (existingUser) {
                        clientId = existingUser.id;
                    } else {
                        clientId = `usr_imp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                        await database.insert(users).values({
                            id: clientId,
                            name: client.name,
                            email: client.email || null,
                            phone: client.phone || null,
                            role: "client",
                            loginMethod: "imported"
                        });
                    }

                    // 3. Bind to the Artist's workspace explicitly via Conversations table
                    const existingConv = await database.query.conversations.findFirst({
                        where: and(
                            eq(conversations.artistId, ctx.user.id),
                            eq(conversations.clientId, clientId)
                        )
                    });

                    if (!existingConv) {
                        await database.insert(conversations).values({
                            artistId: ctx.user.id,
                            clientId: clientId
                        });
                    }

                    results.success++;
                } catch (error) {
                    console.error("[DataImport] Row failure:", error);
                    results.failed++;
                }
            }

            return results;
        }),
});
