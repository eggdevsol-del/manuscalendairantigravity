import { systemLogs, InsertSystemLog } from "../../drizzle/schema";
import { getDb } from "./core";

/**
 * Creates a raw system log entry in the database.
 */
export async function createLog(log: InsertSystemLog) {
    try {
        const db = await getDb();
        if (!db) return;
        await db.insert(systemLogs).values({
            ...log,
            createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
        });
    } catch (error) {
        console.error("[SystemLogService] Failed to persist log:", error);
    }
}

/**
 * Standardized logger for server-side usage.
 */
export const sysLogger = {
    info: (category: string, message: string, metadata?: any, userId?: string) =>
        createLog({
            level: 'info',
            category,
            message,
            metadata: metadata ? JSON.stringify(metadata) : null,
            userId
        }),

    warn: (category: string, message: string, metadata?: any, userId?: string) =>
        createLog({
            level: 'warn',
            category,
            message,
            metadata: metadata ? JSON.stringify(metadata) : null,
            userId
        }),

    error: (category: string, message: string, metadata?: any, userId?: string) =>
        createLog({
            level: 'error',
            category,
            message,
            metadata: metadata ? JSON.stringify(metadata) : null,
            userId
        }),

    debug: (category: string, message: string, metadata?: any, userId?: string) =>
        createLog({
            level: 'debug',
            category,
            message,
            metadata: metadata ? JSON.stringify(metadata) : null,
            userId
        }),

    /**
     * Specifically for tracking database transitions and state changes.
     */
    mutation: (category: string, message: string, metadata?: any, userId?: string) =>
        createLog({
            level: 'info',
            category: `mutation:${category}`,
            message,
            metadata: metadata ? JSON.stringify(metadata) : null,
            userId
        }),
};
