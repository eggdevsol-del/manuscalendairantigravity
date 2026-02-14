import { and, desc, eq, gte, lte, gt, lt, ne, sql } from "drizzle-orm";
import { appointments, InsertAppointment, users, appointmentLogs, InsertAppointmentLog, procedureLogs, artistSettings, consentForms } from "../../drizzle/schema";
import { getDb } from "./core";

// Helper to ensure dates are ISO formatted (UTC) for the client
// MySQL returns "YYYY-MM-DD HH:mm:ss", we need "YYYY-MM-DDTHH:mm:ssZ"
function toISO(dateStr: any): string {
    if (!dateStr) return dateStr as any;

    // Handle Date objects
    if (dateStr instanceof Date) return dateStr.toISOString();

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
    const appointmentId = Number(result[0].insertId);

    const inserted = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, appointmentId))
        .limit(1);

    const appt = normalizeAppointment(inserted[0]);

    // Log the creation
    await logAppointmentAction({
        appointmentId,
        action: 'created',
        performedBy: appt.artistId, // For now assuming artist creates, but could be dynamic
        newValue: JSON.stringify(appt)
    });

    return appt;
}

export async function logAppointmentAction(log: InsertAppointmentLog) {
    const db = await getDb();
    if (!db) return;
    await db.insert(appointmentLogs).values(log);
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
    updates: Partial<InsertAppointment>,
    performedBy: string
) {
    const db = await getDb();
    if (!db) return undefined;

    const oldAppt = await getAppointment(id);

    await db
        .update(appointments)
        .set({ ...updates, updatedAt: new Date().toISOString() })
        .where(eq(appointments.id, id));

    const newAppt = await getAppointment(id);

    // Determine action - rescheduled if time changed, else status change, etc.
    let action: any = 'completed'; // default
    if (updates.status) {
        action = updates.status;
    } else if (updates.startTime || updates.endTime) {
        action = 'rescheduled';
    }

    await logAppointmentAction({
        appointmentId: id,
        action,
        performedBy,
        oldValue: JSON.stringify(oldAppt),
        newValue: JSON.stringify(newAppt)
    });

    // QLD REGULATION: Auto-generate procedure log on completion
    if (updates.status === 'completed') {
        await createProcedureLog(id);
    }

    return newAppt;
}

export async function deleteAppointment(id: number, performedBy: string) {
    const db = await getDb();
    if (!db) return false;

    const oldAppt = await getAppointment(id);

    await logAppointmentAction({
        appointmentId: id,
        action: 'cancelled',
        performedBy,
        oldValue: JSON.stringify(oldAppt),
        newValue: null
    });

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

    // Get the IDs of appointments being confirmed to trigger form generation
    const dbInst = await getDb();
    if (!dbInst) throw new Error("Database not available");

    const pendingAppts = await dbInst
        .select({ id: appointments.id })
        .from(appointments)
        .where(
            and(
                eq(appointments.conversationId, conversationId),
                eq(appointments.status, "pending")
            )
        );

    const result = await db
        .update(appointments)
        .set(updateData)
        .where(
            and(
                eq(appointments.conversationId, conversationId),
                eq(appointments.status, "pending")
            )
        );

    // Trigger form generation for each confirmed appointment
    for (const appt of pendingAppts) {
        await generateRequiredForms(appt.id);
    }

    return result;
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

/**
 * QLD Form 9 Procedure Log Automation
 * Snapshots current data into procedure_logs table
 */
export async function createProcedureLog(appointmentId: number) {
    const db = await getDb();
    if (!db) return;

    const appt = await db.query.appointments.findFirst({
        where: eq(appointments.id, appointmentId),
        with: {
            client: true,
            artist: true
        }
    });

    if (!appt) return;

    // Get artist settings for license
    const settings = await db.query.artistSettings.findFirst({
        where: eq(artistSettings.userId, appt.artistId)
    });

    await db.insert(procedureLogs).values({
        appointmentId,
        artistId: appt.artistId,
        clientId: appt.clientId,
        date: appt.actualStartTime || appt.startTime,
        clientName: appt.client?.name || 'Unknown',
        clientDob: appt.client?.birthday,
        artistLicenceNumber: settings?.licenceNumber || "000000000",
        amountPaid: appt.amountPaid || appt.price || 0,
        paymentMethod: appt.paymentMethod || 'cash'
    });
}

/**
 * Auto-generate required forms for a newly confirmed appointment
 */
export async function generateRequiredForms(appointmentId: number) {
    const db = await getDb();
    if (!db) return;

    const appt = await getAppointment(appointmentId);
    if (!appt) return;

    const settings = await db.query.artistSettings.findFirst({
        where: eq(artistSettings.userId, appt.artistId)
    });

    if (!settings) return;

    const forms = [];

    // Procedure Consent
    forms.push({
        appointmentId,
        clientId: appt.clientId,
        artistId: appt.artistId,
        formType: 'procedure_consent' as const,
        title: 'Tattoo Procedure Consent',
        content: settings.consentTemplate || "I consent to the tattoo procedure...",
        status: 'pending' as const
    });

    // Medical Release
    forms.push({
        appointmentId,
        clientId: appt.clientId,
        artistId: appt.artistId,
        formType: 'medical_release' as const,
        title: 'Medical History & Release',
        content: settings.medicalTemplate || "I confirm I have no medical conditions...",
        status: 'pending' as const
    });

    await db.insert(consentForms).values(forms);
}
