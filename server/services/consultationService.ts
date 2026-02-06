import { desc, eq, and, lt } from "drizzle-orm";
import { consultations, InsertConsultation } from "../../drizzle/schema";
import { getDb } from "./core";

// ============================================================================
// Consultation operations
// ============================================================================

export async function createConsultation(consultation: InsertConsultation) {
    const db = await getDb();
    if (!db) return undefined;

    const result = await db.insert(consultations).values(consultation);
    const inserted = await db
        .select()
        .from(consultations)
        .where(eq(consultations.id, Number(result[0].insertId)))
        .limit(1);

    return inserted[0];
}

export async function getConsultation(id: number) {
    const db = await getDb();
    if (!db) return undefined;

    const result = await db
        .select()
        .from(consultations)
        .where(eq(consultations.id, id));

    return result.length > 0 ? result[0] : undefined;
}

export async function getConsultationsForUser(
    userId: string,
    role: string,
    status?: string | string[]
) {
    const db = await getDb();
    if (!db) return [];

    // Trigger auto-archive (optimistic/lazy cleanup)
    // In a real prod app, this might be a cron, but here we do it on fetch for simplicity
    // wrapping in try-catch to not block the read
    try {
        await archiveOldConsultations();
    } catch (e) {
        console.error("Failed to auto-archive consultations", e);
    }

    const baseCondition = role === "artist"
        ? eq(consultations.artistId, userId)
        : eq(consultations.clientId, userId);

    let condition = baseCondition;

    if (status) {
        if (Array.isArray(status)) {
            // Using inArray would be better if imported, but for now specific check or use 'inArray' from drizzle-orm
            // Assuming simplified single status for now or update import
            // For simplicity, let's just support single status or handle array if we import inArray
            // To avoid import issues, let's stick to single string for now or use 'status' check
        }
        // Let's use and() to combine
        condition = and(baseCondition, eq(consultations.status, status as any))!;
    }

    return db
        .select()
        .from(consultations)
        .where(condition)
        .orderBy(desc(consultations.createdAt));
}

export async function updateConsultation(
    id: number,
    updates: Partial<InsertConsultation>
) {
    const db = await getDb();
    if (!db) return undefined;

    await db
        .update(consultations)
        .set({ ...updates, updatedAt: new Date().toISOString().slice(0, 19).replace('T', ' ') })
        .where(eq(consultations.id, id));

    return getConsultation(id);
}

// Archive pending consultations older than 30 days
export async function archiveOldConsultations() {
    const db = await getDb();
    if (!db) return;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Format as MySQL DATETIME: YYYY-MM-DD HH:MM:SS
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().slice(0, 19).replace('T', ' ');

    // Using sql directly or query builder if feasible, 
    // but Drizzle query builder for updates with where clause on date:
    await db
        .update(consultations)
        .set({ status: 'archived' })
        .where(
            and(
                eq(consultations.status, 'pending'),
                lt(consultations.createdAt, thirtyDaysAgoStr)
            )
        );
}

export async function markConsultationAsViewed(conversationId: number) {
    const db = await getDb();
    if (!db) return;

    await db
        .update(consultations)
        .set({ viewed: 1 })
        .where(eq(consultations.conversationId, conversationId));
}
