import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { users, conversations, appointments, artistSettings } from "../../drizzle/schema";
import { z } from "zod";
import { eq, and, or } from "drizzle-orm";
import { format, parseISO, isValid } from "date-fns";
import { localToUTC, getBusinessTimezone } from "../../shared/utils/timezone";

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
                        results.success++;
                    } else {
                        results.skipped++;
                    }
                } catch (error) {
                    console.error("[DataImport] Row failure:", error);
                    results.failed++;
                }
            }

            return results;
        }),

    bulkImportAppointments: protectedProcedure
        .input(
            z.object({
                appointments: z.array(
                    z.object({
                        clientName: z.string().min(1),
                        clientEmail: z.string().email().optional().or(z.literal("")),
                        clientPhone: z.string().optional().or(z.literal("")),
                        date: z.string(),
                        startTime: z.string(),
                        endTime: z.string().optional(),
                        serviceName: z.string().optional(),
                    })
                ),
                serviceMap: z.record(z.string(), z.string()).optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
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

            // Fetch artist settings once to resolve mapped services
            let internalServices: any[] = [];
            const settings = await database.query.artistSettings.findFirst({
                where: eq(artistSettings.userId, ctx.user.id)
            });
            if (settings?.services) {
                try {
                    const parsed = JSON.parse(settings.services);
                    if (Array.isArray(parsed)) internalServices = parsed;
                } catch (e) { }
            }

            for (const appt of input.appointments) {
                try {
                    // Try to parse the Date
                    const parseString = `${appt.date.trim()} ${appt.startTime.trim()}`;
                    let startObj = new Date(parseString);

                    // Fallback to strict ISO if standard parsing fails
                    if (isNaN(startObj.getTime())) {
                        startObj = new Date(`${appt.date.trim()}T${appt.startTime.trim()}`);
                    }

                    if (!isValid(startObj) || isNaN(startObj.getTime())) {
                        console.warn(`[DataImport] Skipping unparsable date string: ${parseString}`);
                        results.failed++;
                        continue;
                    }

                    // 1. Find existing global user by email or phone
                    const conditions = [];
                    if (appt.clientEmail) conditions.push(eq(users.email, appt.clientEmail));
                    if (appt.clientPhone) conditions.push(eq(users.phone, appt.clientPhone));

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
                            name: appt.clientName,
                            email: appt.clientEmail || null,
                            phone: appt.clientPhone || null,
                            role: "client",
                            loginMethod: "imported"
                        });
                    }

                    // 3. Bind Context
                    let convId = 0;
                    const existingConv = await database.query.conversations.findFirst({
                        where: and(
                            eq(conversations.artistId, ctx.user.id),
                            eq(conversations.clientId, clientId)
                        )
                    });

                    if (existingConv) {
                        convId = existingConv.id;
                    } else {
                        await database.insert(conversations).values({
                            artistId: ctx.user.id,
                            clientId: clientId
                        });

                        // Re-query to guarantee reliable integer ID across different drivers
                        const newConv = await database.query.conversations.findFirst({
                            where: and(
                                eq(conversations.artistId, ctx.user.id),
                                eq(conversations.clientId, clientId)
                            )
                        });
                        convId = newConv!.id;
                    }

                    // 4. Calculate End Time and Service Mapping Overrides
                    let mappedService = null;
                    if (appt.serviceName && input.serviceMap && input.serviceMap[appt.serviceName]) {
                        const mappedId = input.serviceMap[appt.serviceName];
                        if (mappedId !== "SKIP") {
                            mappedService = internalServices.find((s: any) => s.id === mappedId);
                        }
                    }

                    let defaultDurationMs = 60 * 60 * 1000;
                    if (mappedService && typeof mappedService.duration === "number") {
                        defaultDurationMs = mappedService.duration * 60 * 1000;
                    }

                    let endObj = new Date(startObj.getTime() + defaultDurationMs);
                    if (appt.endTime && !mappedService) { // Only trust CSV end time if we aren't overriding via mapping
                        let parsedEnd = new Date(`${appt.date.trim()} ${appt.endTime.trim()}`);
                        if (isNaN(parsedEnd.getTime())) {
                            parsedEnd = new Date(`${appt.date.trim()}T${appt.endTime.trim()}`);
                        }
                        if (isValid(parsedEnd) && !isNaN(parsedEnd.getTime())) {
                            endObj = parsedEnd;
                        }
                    }

                    // 5. Insert Appointment Schedule (Converted to UTC ISO for standard frontend parsing)
                    const timezone = getBusinessTimezone(); // Defaults to Aus/BNE, will be dynamic later

                    // The CSV parsing generated a "local" date object matching the spreadsheet text.
                    // We extract that local format as a string, then run it through our standard localToUTC converter.
                    const startLocalFormat = format(startObj, "yyyy-MM-dd'T'HH:mm");
                    const endLocalFormat = format(endObj, "yyyy-MM-dd'T'HH:mm");

                    const startTimeUTC = localToUTC(startLocalFormat, timezone);
                    const endTimeUTC = localToUTC(endLocalFormat, timezone);

                    // Convert to MySQL compatible UTC strings (stripping the 'T' and 'Z')
                    const startStr = new Date(startTimeUTC).toISOString().slice(0, 19).replace('T', ' ');
                    const endStr = new Date(endTimeUTC).toISOString().slice(0, 19).replace('T', ' ');

                    const existingAppt = await database.query.appointments.findFirst({
                        where: and(
                            eq(appointments.artistId, ctx.user.id),
                            eq(appointments.clientId, clientId),
                            eq(appointments.startTime, startStr)
                        )
                    });

                    if (existingAppt) {
                        results.skipped++;
                        continue;
                    }

                    const finalServiceName = mappedService ? mappedService.name : (appt.serviceName || "Imported Appointment");
                    const finalPrice = mappedService && typeof mappedService.price === "number" ? mappedService.price : undefined;

                    await database.insert(appointments).values({
                        conversationId: convId,
                        artistId: ctx.user.id,
                        clientId: clientId,
                        title: finalServiceName,
                        startTime: startStr,
                        endTime: endStr,
                        status: "confirmed",
                        serviceName: finalServiceName,
                        price: finalPrice,
                        timeZone: "Australia/Brisbane", // Configured later based on user settings
                    });

                    results.success++;
                } catch (error) {
                    console.error("[DataImport] Appointment Row failure:", error);
                    results.failed++;
                }
            }

            return results;
        }),
});
