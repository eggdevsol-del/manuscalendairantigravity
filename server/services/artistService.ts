import { eq } from "drizzle-orm";
import { format } from "date-fns";
import {
    artistSettings,
    InsertArtistSettings,
    quickActionButtons,
    InsertQuickActionButton,
    notificationTemplates,
    InsertNotificationTemplate,
} from "../../drizzle/schema";
import { getDb } from "./core";

// ============================================================================
// Artist Settings operations
// ============================================================================

export async function getArtistSettings(userId: string) {
    try {
        const db = await getDb();
        if (!db) {
            console.error("[getArtistSettings] Database connection unavailable");
            return undefined;
        }

        const result = await db
            .select()
            .from(artistSettings)
            .where(eq(artistSettings.userId, userId))
            .limit(1);

        return result.length > 0 ? result[0] : undefined;
    } catch (error: any) {
        console.error("[getArtistSettings] Failed to fetch settings:", error);
        // Log SQL if available in the error object (common in mysql2/drizzle)
        if (error.sql) console.error("[getArtistSettings] SQL:", error.sql);
        throw new Error(`Failed query: ${error.message}`);
    }
}

export async function upsertArtistSettings(settings: InsertArtistSettings) {
    const db = await getDb();
    if (!db) return undefined;

    const existing = await getArtistSettings(settings.userId);

    if (existing) {
        await db
            .update(artistSettings)
            .set({ ...settings, updatedAt: format(new Date(), 'yyyy-MM-dd HH:mm:ss') })
            .where(eq(artistSettings.userId, settings.userId));
    } else {
        await db.insert(artistSettings).values({ ...settings, createdAt: format(new Date(), 'yyyy-MM-dd HH:mm:ss'), updatedAt: format(new Date(), 'yyyy-MM-dd HH:mm:ss') });
    }

    return getArtistSettings(settings.userId);
}

// ============================================================================
// Quick Action Button operations
// ============================================================================

export async function getQuickActionButtons(userId: string) {
    const db = await getDb();
    if (!db) return [];

    return db
        .select()
        .from(quickActionButtons)
        .where(eq(quickActionButtons.userId, userId))
        .orderBy(quickActionButtons.position);
}

export async function createQuickActionButton(button: InsertQuickActionButton) {
    const db = await getDb();
    if (!db) return undefined;

    const result = await db.insert(quickActionButtons).values(button);

    const inserted = await db
        .select()
        .from(quickActionButtons)
        .where(eq(quickActionButtons.id, Number(result[0].insertId)))
        .limit(1);

    return inserted[0];
}

export async function updateQuickActionButton(
    id: number,
    updates: Partial<InsertQuickActionButton>
) {
    const db = await getDb();
    if (!db) return undefined;

    await db
        .update(quickActionButtons)
        .set({ ...updates, updatedAt: format(new Date(), 'yyyy-MM-dd HH:mm:ss') })
        .where(eq(quickActionButtons.id, id));

    const updated = await db
        .select()
        .from(quickActionButtons)
        .where(eq(quickActionButtons.id, id))
        .limit(1);

    return updated[0];
}

export async function deleteQuickActionButton(id: number) {
    const db = await getDb();
    if (!db) return false;

    await db.delete(quickActionButtons).where(eq(quickActionButtons.id, id));
    return true;
}

// ============================================================================
// Notification Template operations
// ============================================================================

export async function getNotificationTemplates(userId: string) {
    const db = await getDb();
    if (!db) return [];

    return db
        .select()
        .from(notificationTemplates)
        .where(eq(notificationTemplates.userId, userId));
}

export async function createNotificationTemplate(
    template: InsertNotificationTemplate
) {
    const db = await getDb();
    if (!db) return undefined;

    const result = await db.insert(notificationTemplates).values(template);

    const inserted = await db
        .select()
        .from(notificationTemplates)
        .where(eq(notificationTemplates.id, Number(result[0].insertId)))
        .limit(1);

    return inserted[0];
}

export async function updateNotificationTemplate(
    id: number,
    updates: Partial<InsertNotificationTemplate>
) {
    const db = await getDb();
    if (!db) return undefined;

    await db
        .update(notificationTemplates)
        .set({ ...updates, updatedAt: format(new Date(), 'yyyy-MM-dd HH:mm:ss') })
        .where(eq(notificationTemplates.id, id));

    const updated = await db
        .select()
        .from(notificationTemplates)
        .where(eq(notificationTemplates.id, id))
        .limit(1);

    return updated[0];
}

export async function deleteNotificationTemplate(id: number) {
    const db = await getDb();
    if (!db) return false;

    await db
        .delete(notificationTemplates)
        .where(eq(notificationTemplates.id, id));
    return true;
}
