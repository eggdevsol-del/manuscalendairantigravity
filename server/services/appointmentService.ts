import { and, desc, eq, gte, lte, gt, lt, ne, sql } from "drizzle-orm";
import { appointments, InsertAppointment, users } from "../../drizzle/schema";
import { getDb } from "./core";

// Helper to ensure dates are ISO formatted (UTC) for the client
// MySQL returns "YYYY-MM-DD HH:mm:ss", we need "YYYY-MM-DDTHH:mm:ssZ"
function toISO(dateStr: string | null | undefined): string {
    if (!dateStr) return dateStr as any;
    // If it's already a Date object (shouldn't be with mode: string, but safety check)
    if (dateStr instanceof Date) return (dateStr as Date).toISOString();

    let s = String(dateStr);
    if (s.includes('T') && s.endsWith('Z')) return s;
    return s.replace(' ', 'T') + 'Z';
}

function normalizeAppointment(appt: any) {
    if (!appt) return appt;
    return {
        ...appt,
        startTime: toISO(appt.startTime),
        endTime: toISO(appt.endTime),
        actualStartTime: toISO(appt.actualStartTime),
        actualEndTime: toISO(appt.actualEndTime),
        createdAt: toISO(appt.createdAt),
        updatedAt: toISO(appt.updatedAt),
    };
}

// ============================================================================
// Appointment operations
// ============================================================================

export async function createAppointment(appointment: InsertAppointment) {
    const db = await getDb();
    if (!db) return undefined;

    const result = await db.insert(appointments).values(appointment);

    const inserted = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, Number(result[0].insertId)))
        .limit(1);

    return normalizeAppointment(inserted[0]);
}

export async function getAppointment(id: number) {
    const db = await getDb();
    if (!db) return undefined;

    const result = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, id))
        .limit(1);

    return result.length > 0 ? normalizeAppointment(result[0]) : undefined;
}

export async function updateAppointment(
    id: number,
    updates: Partial<InsertAppointment>
) {
    const db = await getDb();
    if (!db) return undefined;

    await db
        .update(appointments)
        .set({ ...updates, updatedAt: new Date().toISOString() })
        .where(eq(appointments.id, id));

    return getAppointment(id);
}

export async function deleteAppointment(id: number) {
    const db = await getDb();
    if (!db) return false;

    await db.delete(appointments).where(eq(appointments.id, id));
    return true;
}

export async function getAppointmentsForUser(
    userId: string,
    role: string,
    startDate?: Date,
    endDate?: Date
) {
    const db = await getDb();
    if (!db) return [];

    const conditions = [
        role === "artist"
            ? eq(appointments.artistId, userId)
            : eq(appointments.clientId, userId),
    ];

    if (startDate) {
        conditions.push(gte(appointments.startTime, startDate.toISOString()));
    }

    if (endDate) {
        conditions.push(lte(appointments.startTime, endDate.toISOString()));
    }

    // Join with users table to get client/artist names
    const results = await db
        .select({
            id: appointments.id,
            conversationId: appointments.conversationId,
            artistId: appointments.artistId,
            clientId: appointments.clientId,
            title: appointments.title,
            description: appointments.description,
            startTime: appointments.startTime,
            endTime: appointments.endTime,
            status: appointments.status,
            serviceName: appointments.serviceName,
            price: appointments.price,
            depositAmount: appointments.depositAmount,
            depositPaid: appointments.depositPaid,
            confirmationSent: appointments.confirmationSent,
            reminderSent: appointments.reminderSent,
            followUpSent: appointments.followUpSent,
            actualStartTime: appointments.actualStartTime,
            actualEndTime: appointments.actualEndTime,
            clientArrived: appointments.clientArrived,
            clientPaid: appointments.clientPaid,
            amountPaid: appointments.amountPaid,
            paymentMethod: appointments.paymentMethod,
            createdAt: appointments.createdAt,
            updatedAt: appointments.updatedAt,
            clientName: users.name,
            clientEmail: users.email,
            sessionNumber: sql<number>`(
                SELECT COUNT(*)
                FROM ${appointments} a2
                WHERE a2.conversationId = ${appointments.conversationId}
                AND a2.startTime <= ${appointments.startTime}
            )`,
            totalSessions: sql<number>`(
                SELECT COUNT(*)
                FROM ${appointments} a2
                WHERE a2.conversationId = ${appointments.conversationId}
            )`,
        })
        .from(appointments)
        .leftJoin(users, eq(appointments.clientId, users.id))
        .where(and(...conditions))
        .orderBy(appointments.startTime);

    return results.map(normalizeAppointment);
}

export async function getAppointmentsByConversation(conversationId: number) {
    const db = await getDb();
    if (!db) return [];

    const results = await db
        .select()
        .from(appointments)
        .where(eq(appointments.conversationId, conversationId))
        .orderBy(desc(appointments.startTime));

    return results.map(normalizeAppointment);
}

export async function getPendingAppointmentsByConversation(conversationId: number) {
    const db = await getDb();
    if (!db) return [];

    const results = await db
        .select()
        .from(appointments)
        .where(
            and(
                eq(appointments.conversationId, conversationId),
                eq(appointments.status, "pending")
            )
        );

    return results.map(normalizeAppointment);
}

export async function confirmAppointments(conversationId: number, paymentProof?: string) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const updateData: any = {
        status: "confirmed",
        depositPaid: true,
        confirmationSent: false, // Will be set to true after notification is sent
        updatedAt: new Date(),
    };

    if (paymentProof) {
        updateData.paymentProof = paymentProof;
    }

    return db
        .update(appointments)
        .set(updateData)
        .where(
            and(
                eq(appointments.conversationId, conversationId),
                eq(appointments.status, "pending")
            )
        );
}
export async function deleteAppointmentsForClient(artistId: string, clientId: string) {
    const db = await getDb();
    if (!db) return false;

    await db.delete(appointments).where(
        and(
            eq(appointments.artistId, artistId),
            eq(appointments.clientId, clientId)
        )
    );
    return true;
}

export async function checkAppointmentOverlap(
    artistId: string,
    startTime: Date,
    endTime: Date,
    excludeAppointmentId?: number
) {
    const db = await getDb();
    if (!db) return false;

    // Overlap logic: (StartA < EndB) and (EndA > StartB)
    // New appointment: startTime, endTime
    // Existing: appointments.startTime, appointments.endTime

    // Condition:
    // appointments.artistId === artistId
    // AND appointments.startTime < endTime
    // AND appointments.endTime > startTime
    // AND appointments.status != 'cancelled'

    // We use 'lt' and 'gt' which need to be imported
    const conditions = [
        eq(appointments.artistId, artistId),
        lt(appointments.startTime, endTime as unknown as string),
        gt(appointments.endTime, startTime as unknown as string),
        ne(appointments.status, "cancelled")
    ];

    if (excludeAppointmentId) {
        conditions.push(ne(appointments.id, excludeAppointmentId));
    }

    const conflicts = await db
        .select({ id: appointments.id })
        .from(appointments)
        .where(and(...conditions))
        .limit(1);

    return conflicts.length > 0;
}
