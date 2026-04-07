import { z } from "zod";
import { publicProcedure, adminProcedure, router } from "../_core/trpc";
import { getDb } from "../services/core";
import * as schema from "../../drizzle/schema";
import { desc, eq, and, lt, sql } from "drizzle-orm";

// ── Rate limiter (in-memory, per IP) ──
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10; // max errors per IP per minute

function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);
    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
        return true;
    }
    if (entry.count >= RATE_LIMIT) return false;
    entry.count++;
    return true;
}

// Periodic cleanup
setInterval(() => {
    const now = Date.now();
    Array.from(rateLimitMap.entries()).forEach(([ip, entry]) => {
        if (now > entry.resetAt) rateLimitMap.delete(ip);
    });
}, 5 * 60_000);

export const errorLogRouter = router({
    // Public — errors happen before auth
    log: publicProcedure
        .input(
            z.object({
                message: z.string().max(2000),
                stack: z.string().max(10000).optional(),
                componentStack: z.string().max(10000).optional(),
                boundary: z.string().max(100).optional(),
                url: z.string().max(500).optional(),
                userId: z.number().optional(),
                userRole: z.string().max(50).optional(),
                userAgent: z.string().max(500).optional(),
                appVersion: z.string().max(50).optional(),
                metadata: z.string().max(5000).optional(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            // Rate limit by IP — ctx.req is Express Request (see server/_core/context.ts)
            const ip =
                ctx.req?.ip ||
                ctx.req?.headers?.["x-forwarded-for"] ||
                "unknown";
            if (!checkRateLimit(String(ip))) {
                return { ok: false, reason: "rate_limited" };
            }
            const db = await getDb();
            if (!db) return { ok: false, reason: "db_unavailable" };
            await db.insert(schema.errorLog).values(input);
            return { ok: true };
        }),

    // Admin: list errors
    list: adminProcedure
        .input(
            z.object({
                limit: z.number().min(1).max(200).default(50),
                offset: z.number().min(0).default(0),
                resolved: z.boolean().optional(),
            })
        )
        .query(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("Database connection failed");
            const conditions =
                input.resolved !== undefined
                    ? eq(schema.errorLog.resolved, input.resolved ? 1 : 0)
                    : undefined;
            const [errors, countResult] = await Promise.all([
                db
                    .select()
                    .from(schema.errorLog)
                    .where(conditions)
                    .orderBy(desc(schema.errorLog.createdAt))
                    .limit(input.limit)
                    .offset(input.offset),
                db
                    .select({ count: sql<number>`count(*)` })
                    .from(schema.errorLog)
                    .where(conditions),
            ]);
            return { errors, total: countResult[0]?.count || 0 };
        }),

    // Admin: mark resolved
    resolve: adminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("Database connection failed");
            await db
                .update(schema.errorLog)
                .set({ resolved: 1 })
                .where(eq(schema.errorLog.id, input.id));
            return { ok: true };
        }),

    // Admin: clear all resolved
    clearResolved: adminProcedure.mutation(async () => {
        const db = await getDb();
        if (!db) throw new Error("Database connection failed");
        await db
            .delete(schema.errorLog)
            .where(eq(schema.errorLog.resolved, 1));
        return { ok: true };
    }),

    // Admin: purge resolved errors older than 30 days
    purgeOld: adminProcedure.mutation(async () => {
        const db = await getDb();
        if (!db) throw new Error("Database connection failed");
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        await db
            .delete(schema.errorLog)
            .where(
                and(
                    eq(schema.errorLog.resolved, 1),
                    lt(schema.errorLog.createdAt, thirtyDaysAgo)
                )
            );
        return { ok: true };
    }),
});
