import { and, desc, eq, gte, lte, gt, lt, ne, sql, or, inArray } from "drizzle-orm";
import {
  appointments,
  InsertAppointment,
  users,
  appointmentLogs,
  InsertAppointmentLog,
  procedureLogs,
  artistSettings,
  consentForms,
  messages,
  studioMembers,
  conversations,
} from "../../drizzle/schema";
import { getDb } from "./core";
import { parseExternalCalendar } from "./icalParser";
// MySQL returns "YYYY-MM-DD HH:mm:ss", we need "YYYY-MM-DDTHH:mm:ssZ"
function toISO(dateStr: any): string {
  if (!dateStr) return dateStr as any;

  // Handle Date objects
  if (dateStr instanceof Date) return dateStr.toISOString();

  let s = String(dateStr);
  if (s.includes("T") && s.endsWith("Z")) return s;
  return s.replace(" ", "T") + "Z";
}

// Helper to ensure dates are MySQL formatted (UTC) for the DB
// Converts Date objects or ISO strings to "YYYY-MM-DD HH:mm:ss"
function toMySQL(date: any): string | any {
  if (!date) return date;

  let d: Date;
  if (date instanceof Date) {
    d = date;
  } else {
    const s = String(date);
    // If already in MySQL format, return as is
    if (!s.includes("T") && !s.includes("Z")) return s;
    d = new Date(s);
  }

  if (isNaN(d.getTime())) return date;

  return d.toISOString().slice(0, 19).replace("T", " ");
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
    action: "created",
    performedBy: appt.artistId, // For now assuming artist creates, but could be dynamic
    newValue: JSON.stringify(appt),
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

  // Sanitize any incoming date fields for MySQL
  const sanitizedUpdates: any = { ...updates };
  const dateFields = [
    "startTime",
    "endTime",
    "actualStartTime",
    "actualEndTime",
  ] as const;
  dateFields.forEach(field => {
    if (sanitizedUpdates[field]) {
      sanitizedUpdates[field] = toMySQL(sanitizedUpdates[field]);
    }
  });

  await db
    .update(appointments)
    .set({ ...sanitizedUpdates, updatedAt: toMySQL(new Date()) })
    .where(eq(appointments.id, id));

  const newAppt = await getAppointment(id);

  let action: any = "completed"; // default
  let shouldLogAction = false;

  if (updates.status && updates.status !== oldAppt.status) {
    const validActions = [
      "created",
      "rescheduled",
      "cancelled",
      "completed",
      "proposal_revoked",
      "no-show",
    ];
    if (validActions.includes(updates.status)) {
      action = updates.status;
      shouldLogAction = true;
    }
  }

  // Only log rescheduled if we aren't already logging a status change
  if (!shouldLogAction && (updates.startTime || updates.endTime)) {
    action = "rescheduled";
    shouldLogAction = true;
  }

  if (shouldLogAction) {
    await logAppointmentAction({
      appointmentId: id,
      action,
      performedBy,
      oldValue: JSON.stringify(oldAppt),
      newValue: JSON.stringify(newAppt),
    });
  }

  // Handle special outcome-based logic
  if (updates.status === "completed") {
    // QLD REGULATION: Auto-generate procedure log on completion
    await createProcedureLog(id);
  } else if (updates.status === "no-show") {
    // Ensure revenue is only deposit (revenue metrics usually sum amountPaid)
    // We calculate this in the analytics, but let's ensure the record is clean
    await db
      .update(appointments)
      .set({
        amountPaid: oldAppt.depositPaid ? oldAppt.depositAmount || 0 : 0,
        clientPaid: 0,
      })
      .where(eq(appointments.id, id));
  }

  // Trigger payment link message if paymentMethod was set but not yet paid
  if (
    updates.paymentMethod &&
    updates.clientPaid === 0 &&
    updates.status === "completed"
  ) {
    await db.insert(messages).values({
      conversationId: oldAppt.conversationId,
      senderId: oldAppt.artistId,
      content: `Session complete! Please pay the balance for "${oldAppt.title}" via ${updates.paymentMethod}.`,
      messageType: "text",
    });
  }

  return newAppt;
}

export async function deleteAppointment(id: number, performedBy: string) {
  const db = await getDb();
  if (!db) return false;

  const oldAppt = await getAppointment(id);

  await logAppointmentAction({
    appointmentId: id,
    action: "cancelled",
    performedBy,
    oldValue: JSON.stringify(oldAppt),
    newValue: null,
  });

  await db.delete(appointments).where(eq(appointments.id, id));
  return true;
}

export async function getArtistCalendar(artistId: string, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];

  let conditions: any[] = [eq(appointments.artistId, artistId)];

  if (startDate) conditions.push(gte(appointments.startTime, startDate.toISOString().slice(0, 19).replace("T", " ")));
  if (endDate) conditions.push(lte(appointments.startTime, endDate.toISOString().slice(0, 19).replace("T", " ")));

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
      sessionNumber: sql<number>`(SELECT COUNT(*) FROM ${appointments} a2 WHERE a2.conversationId = ${appointments.conversationId} AND a2.startTime <= ${appointments.startTime})`,
      totalSessions: sql<number>`(SELECT COUNT(*) FROM ${appointments} a2 WHERE a2.conversationId = ${appointments.conversationId})`,
    })
    .from(appointments)
    .leftJoin(users, eq(appointments.clientId, users.id))
    .where(and(...conditions))
    .orderBy(appointments.startTime);

  let mergedResults = results.map(normalizeAppointment);

  // Attempt to fetch and overlay external calendar events
  try {
    const settings = await db.query.artistSettings.findFirst({
        where: eq(artistSettings.userId, artistId)
    });

    if (settings?.appleCalendarUrl) {
        const events = await parseExternalCalendar(settings.appleCalendarUrl);
        const externalAppts = events.filter(e => {
            if (startDate && e.end < startDate) return false;
            if (endDate && e.start > endDate) return false;
            return true;
        }).map(e => ({
            id: -Math.floor(Math.random() * 1000000), // Fake negative ID
            conversationId: 0,
            artistId,
            clientId: "external-sync",
            title: e.summary || "Busy",
            description: "External Calendar Block",
            startTime: e.start.toISOString().slice(0, 19).replace("T", " "), // MySQL format emulation
            endTime: e.end.toISOString().slice(0, 19).replace("T", " "),
            status: "confirmed",
            serviceName: "External Sync",
            price: 0,
            depositAmount: 0,
            depositPaid: true,
            confirmationSent: false,
            reminderSent: false,
            followUpSent: false,
            clientName: "External Event",
            clientEmail: null,
            sessionNumber: 1,
            totalSessions: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
        }));

        mergedResults = [...mergedResults, ...externalAppts.map(normalizeAppointment)];
        
        // Ensure chronological ordering after merge
        mergedResults.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    }
  } catch (err) {
      console.warn(`[getArtistCalendar] Failed to fetch external calendar for ${artistId}:`, err);
  }

  return mergedResults;
}

export async function getClientCalendar(clientId: string, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];

  let conditions: any[] = [eq(appointments.clientId, clientId)];

  if (startDate) conditions.push(gte(appointments.startTime, startDate.toISOString().slice(0, 19).replace("T", " ")));
  if (endDate) conditions.push(lte(appointments.startTime, endDate.toISOString().slice(0, 19).replace("T", " ")));

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
      sessionNumber: sql<number>`(SELECT COUNT(*) FROM ${appointments} a2 WHERE a2.conversationId = ${appointments.conversationId} AND a2.startTime <= ${appointments.startTime})`,
      totalSessions: sql<number>`(SELECT COUNT(*) FROM ${appointments} a2 WHERE a2.conversationId = ${appointments.conversationId})`,
    })
    .from(appointments)
    .leftJoin(users, eq(appointments.clientId, users.id))
    .where(and(...conditions))
    .orderBy(appointments.startTime);

  return results.map(normalizeAppointment);
}

export async function getStudioCalendar(studioId: string, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];

  const studioArtists = await db.query.studioMembers.findMany({
    where: and(
      eq(studioMembers.studioId, studioId),
      eq(studioMembers.status, "active")
    )
  });
  const validArtistIds = studioArtists.map(a => a.userId);

  let conditions: any[] = [];
  if (validArtistIds.length > 0) {
    conditions.push(or(
      eq(appointments.studioId, studioId),
      inArray(appointments.artistId, validArtistIds)
    ));
  } else {
    conditions.push(eq(appointments.studioId, studioId));
  }

  if (startDate) conditions.push(gte(appointments.startTime, startDate.toISOString().slice(0, 19).replace("T", " ")));
  if (endDate) conditions.push(lte(appointments.startTime, endDate.toISOString().slice(0, 19).replace("T", " ")));

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
      sessionNumber: sql<number>`(SELECT COUNT(*) FROM ${appointments} a2 WHERE a2.conversationId = ${appointments.conversationId} AND a2.startTime <= ${appointments.startTime})`,
      totalSessions: sql<number>`(SELECT COUNT(*) FROM ${appointments} a2 WHERE a2.conversationId = ${appointments.conversationId})`,
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

export async function getPendingAppointmentsByConversation(
  conversationId: number
) {
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

export async function confirmAppointments(
  conversationId: number,
  paymentProof?: string
) {
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
export async function deleteAppointmentsForClient(
  artistId: string,
  clientId: string,
  deleteProfile?: boolean
) {
  const db = await getDb();
  if (!db) return false;

  await db
    .delete(appointments)
    .where(
      and(
        eq(appointments.artistId, artistId),
        eq(appointments.clientId, clientId)
      )
    );

  if (deleteProfile) {
    // Drop the conversation binding this client and artist together
    await db
      .delete(conversations)
      .where(
        and(
          eq(conversations.artistId, artistId),
          eq(conversations.clientId, clientId)
        )
      );

    // Drop the actual user profile IF they are specifically a generic 'client'
    // (We ensure we never accidentally drop an artist who happened to book an appointment)
    await db
      .delete(users)
      .where(
        and(
          eq(users.id, clientId),
          eq(users.role, "client")
        )
      );
  }

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
    ne(appointments.status, "cancelled"),
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
      artist: true,
    },
  });

  if (!appt) return;

  // Get artist settings for license
  const settings = await db.query.artistSettings.findFirst({
    where: eq(artistSettings.userId, appt.artistId),
  });

  await db.insert(procedureLogs).values({
    appointmentId,
    artistId: appt.artistId,
    clientId: appt.clientId,
    date: appt.actualStartTime || appt.startTime,
    clientName: appt.client?.name || "Unknown",
    clientDob: appt.client?.birthday,
    artistLicenceNumber: settings?.licenceNumber || "000000000",
    amountPaid: appt.amountPaid || appt.price || 0,
    paymentMethod: appt.paymentMethod || "cash",
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
    where: eq(artistSettings.userId, appt.artistId),
  });

  if (!settings) return;

  const forms = [];

  // Procedure Consent
  forms.push({
    appointmentId,
    clientId: appt.clientId,
    artistId: appt.artistId,
    formType: "procedure_consent" as const,
    title: "Tattoo Procedure Consent",
    content:
      settings.consentTemplate ||
      "**TATTOO PROCEDURE CONSENT FORM**\nBy signing this form, I acknowledge and agree to the following:\n\n1. I am over the age of 18 and consent to receiving a tattoo.\n2. I have been informed of the nature of the tattoo procedure, the anticipated results, and the potential risks, including but not limited to infection, scarring, allergic reactions, and variations in color or design.\n3. I understand that a tattoo is an irreversible modification to my body.\n4. I have received, read, and understand the aftercare instructions provided to me.\n5. I release the artist and the studio from any liability arising from the procedure or my failure to follow aftercare instructions.\n6. I grant the artist the right to photograph my tattoo and use the images for promotional purposes.",
    status: "pending" as const,
  });

  // Medical Release
  forms.push({
    appointmentId,
    clientId: appt.clientId,
    artistId: appt.artistId,
    formType: "medical_release" as const,
    title: "Medical History & Release",
    content:
      settings.medicalTemplate ||
      "**MEDICAL RELEASE AND QUESTIONNAIRE**\nPlease review and answer the following questions to ensure your safety during the tattoo procedure.\n\n1. Do you have any heart conditions, epilepsy, or diabetes?\n2. Are you currently taking any blood-thinning medication?\n3. Do you have any communicable diseases or infections?\n4. Are you pregnant or nursing?\n5. Do you have any allergies (e.g., to latex, specific metals, or soaps)?\n\nI confirm that the information provided is accurate and true to the best of my knowledge. I understand that withholding medical information may pose risks to my health and the tattoo process.",
    status: "pending" as const,
  });

  await db.insert(consentForms).values(forms);
}

/**
 * Resolves imported mystery strings for a given client across all their appointments
 */
export async function resolveMysteryAppointments(
  artistId: string,
  clientId: string,
  mysteryServiceName: string,
  mappedServiceName: string,
  mappedPrice: number,
  mappedDuration: number
) {
  const db = await getDb();
  if (!db) return;

  const rawMystery = mysteryServiceName.trim();

  // Find all appointments that have the mystery title OR serviceName
  const apptsToUpdate = await db.query.appointments.findMany({
    where: and(
      eq(appointments.artistId, artistId),
      or(
        eq(appointments.serviceName, rawMystery),
        eq(appointments.title, rawMystery)
      )
    ),
  });

  // Execute manual updates to force new durations and titles
  for (const appt of apptsToUpdate) {
    const start = new Date(appt.startTime);
    start.setMinutes(start.getMinutes() + mappedDuration);
    const newEndTime = toMySQL(start);

    await db.update(appointments)
      .set({
        serviceName: mappedServiceName,
        title: mappedServiceName,
        price: mappedPrice,
        endTime: newEndTime,
      })
      .where(eq(appointments.id, appt.id));
  }
}
