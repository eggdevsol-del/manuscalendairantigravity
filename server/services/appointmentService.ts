import { hasRescheduleHold } from "./rescheduleHolds";
import { offersEnabled } from "./offerAvailability";
import { cancelOfferBalance } from "./offerBalance";
import { restoreCancelledOfferCredit } from "./offerRestoration";
import { sittingFinancials } from "./sittingFinancials";
import { revisedBookingPrice } from "../domain/paymentState";
import {
  DEFAULT_CONSENT_TEMPLATE,
  DEFAULT_MEDICAL_TEMPLATE,
} from "../../shared/formTemplates";
import { withDatabaseTransaction } from "./core";
import {
  and,
  desc,
  eq,
  gte,
  lte,
  gt,
  lt,
  ne,
  sql,
  or,
  inArray,
  notInArray,
  isNull,
} from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { TRPCError } from "@trpc/server";
import * as schema from "../../drizzle/schema";
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
  aftercareTemplates,
  conversations,
  paymentLedger,
  paymentRequests,
  clientNotes,
  clientContent,
  clientOffers,
  consultations,
  sessionPlans,
  issuedVouchers,
  issuedPromotions,
  leads,
  orders,
  waitlistEntries,
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

  const financials = sittingFinancials(appt);

  return {
    ...appt,
    remainingBalanceCents: financials.remainingCents,
    totalExpectedAmountCents: financials.estimateCents,
    totalPaidAmountCents: financials.paidCents,
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
  return withDatabaseTransaction(async db => {
    await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, appointment.artistId))
      .for("update");
    const start = new Date(toISO(appointment.startTime));
    const end = new Date(toISO(appointment.endTime));
    if (!Number.isFinite(+start) || !(end > start))
      throw new Error("Invalid appointment interval");
    if (
      appointment.status !== "cancelled" &&
      (await checkAppointmentOverlap(appointment.artistId, start, end))
    )
      throw new Error("This time is already booked.");
    appointment = {
      ...appointment,
      startTime: toMySQL(start),
      endTime: toMySQL(end),
    };

    if (appointment.studioId === undefined) {
      const membership = await db.query.studioMembers.findFirst({
        where: and(
          eq(studioMembers.userId, appointment.artistId),
          eq(studioMembers.status, "active")
        ),
      });
      appointment.studioId = membership?.studioId || null;
    }
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
  });
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
  return withDatabaseTransaction(async db => {
    let oldAppt = await getAppointment(id);
    if (!oldAppt) throw new Error("Appointment not found");
    if (
      updates.startTime ||
      updates.endTime ||
      updates.status === "confirmed"
    ) {
      await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, oldAppt.artistId))
        .for("update");
      const start = new Date(toISO(updates.startTime || oldAppt.startTime));
      const end = new Date(toISO(updates.endTime || oldAppt.endTime));
      if (!Number.isFinite(+start) || !(end > start))
        throw new Error("Invalid appointment interval");
      if (await checkAppointmentOverlap(oldAppt.artistId, start, end, id))
        throw new Error("This time is already booked.");
    }

    if (updates.price !== undefined && updates.price !== null) {
      const [locked] = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, id))
        .for("update");
      if (!locked) throw new Error("Appointment not found");
      oldAppt = normalizeAppointment(locked);
      updates = { ...updates, ...revisedBookingPrice(locked, updates.price) };
    }

    if (updates.status === "completed" && !oldAppt.completedAt) {
      const template = await db.query.aftercareTemplates.findFirst({
        where: and(
          eq(aftercareTemplates.artistId, oldAppt.artistId),
          eq(aftercareTemplates.isDefault, 1)
        ),
      });
      updates = {
        ...updates,
        completedAt: toMySQL(new Date()),
        aftercareTemplateId: template?.id || oldAppt.aftercareTemplateId,
      };
    }

    if (
      updates.status === "cancelled" ||
      [
        "price",
        "totalExpectedAmountCents",
        "totalPaidAmountCents",
        "remainingBalanceCents",
        "paymentStatus",
        "depositPaid",
        "clientPaid",
        "depositAmount",
      ].some(key => (updates as any)[key] !== undefined)
    )
      await cancelOfferBalance(db, id);

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

    if (updates.status === "cancelled")
      await restoreCancelledOfferCredit(db, id);
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
  });
}

export async function deleteAppointment(id: number, performedBy: string) {
  const db = await getDb();
  if (!db) return false;

  const oldAppt = await getAppointment(id);
  if (offersEnabled()) {
    const { offerApplications, offerBalanceCheckouts } =
      await import("../../drizzle/schema");
    const planCredit = oldAppt?.sessionPlanId
      ? await db.query.offerApplications.findFirst({
          where: eq(offerApplications.planId, oldAppt.sessionPlanId),
        })
      : null;
    const balanceCredit = await db.query.offerBalanceCheckouts.findFirst({
      where: eq(offerBalanceCheckouts.bookingId, id),
    });
    if (planCredit || balanceCredit) {
      await updateAppointment(id, { status: "cancelled" }, performedBy);
      return true;
    }
  }

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

export async function getArtistCalendar(
  artistId: string,
  startDate?: Date,
  endDate?: Date,
  excludeStatuses: string[] = ["cancelled"]
) {
  const db = await getDb();
  if (!db) return [];

  let conditions: any[] = [eq(appointments.artistId, artistId)];

  if (excludeStatuses.length > 0) {
    conditions.push(notInArray(appointments.status, excludeStatuses as any[]));
  }

  if (startDate)
    conditions.push(
      gte(
        appointments.startTime,
        startDate.toISOString().slice(0, 19).replace("T", " ")
      )
    );
  if (endDate)
    conditions.push(
      lte(
        appointments.startTime,
        endDate.toISOString().slice(0, 19).replace("T", " ")
      )
    );

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
      totalExpectedAmountCents: appointments.totalExpectedAmountCents,
      totalPaidAmountCents: appointments.totalPaidAmountCents,
      remainingBalanceCents: appointments.remainingBalanceCents,
      paymentStatus: appointments.paymentStatus,
      sessionPlanId: appointments.sessionPlanId,
      sessionIndex: appointments.sessionIndex,
      sessionTotal: appointments.sessionTotal,
      projectName: appointments.projectName,
      depositPaymentId: appointments.depositPaymentId,
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
      where: eq(artistSettings.userId, artistId),
    });

    if (settings?.appleCalendarUrl) {
      const events = await parseExternalCalendar(settings.appleCalendarUrl);
      const externalAppts = events
        .filter(e => {
          if (startDate && e.end < startDate) return false;
          if (endDate && e.start > endDate) return false;
          return true;
        })
        .map(e => ({
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

      mergedResults = [
        ...mergedResults,
        ...externalAppts.map(normalizeAppointment),
      ];

      // Ensure chronological ordering after merge
      mergedResults.sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
    }
  } catch (err) {
    console.warn(
      `[getArtistCalendar] Failed to fetch external calendar for ${artistId}:`,
      err
    );
  }

  return mergedResults;
}

export async function getClientCalendar(
  clientId: string,
  startDate?: Date,
  endDate?: Date,
  excludeStatuses: string[] = ["cancelled"]
) {
  const db = await getDb();
  if (!db) return [];

  let conditions: any[] = [eq(appointments.clientId, clientId)];

  if (excludeStatuses.length > 0) {
    conditions.push(notInArray(appointments.status, excludeStatuses as any[]));
  }

  if (startDate)
    conditions.push(
      gte(
        appointments.startTime,
        startDate.toISOString().slice(0, 19).replace("T", " ")
      )
    );
  if (endDate)
    conditions.push(
      lte(
        appointments.startTime,
        endDate.toISOString().slice(0, 19).replace("T", " ")
      )
    );

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
      totalExpectedAmountCents: appointments.totalExpectedAmountCents,
      totalPaidAmountCents: appointments.totalPaidAmountCents,
      remainingBalanceCents: appointments.remainingBalanceCents,
      paymentStatus: appointments.paymentStatus,
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

export async function getStudioCalendar(
  studioId: string,
  startDate?: Date,
  endDate?: Date,
  excludeStatuses: string[] = ["cancelled"]
) {
  const db = await getDb();
  if (!db) return [];

  const studioArtists = await db.query.studioMembers.findMany({
    where: and(
      eq(studioMembers.studioId, studioId),
      eq(studioMembers.status, "active")
    ),
  });
  const validArtistIds = studioArtists.map(a => a.userId);

  if (!validArtistIds.length) return [];
  const conditions: any[] = [
    eq(appointments.studioId, studioId),
    inArray(appointments.artistId, validArtistIds),
  ];

  if (excludeStatuses.length > 0) {
    conditions.push(notInArray(appointments.status, excludeStatuses as any[]));
  }

  if (startDate)
    conditions.push(
      gte(
        appointments.startTime,
        startDate.toISOString().slice(0, 19).replace("T", " ")
      )
    );
  if (endDate)
    conditions.push(
      lte(
        appointments.startTime,
        endDate.toISOString().slice(0, 19).replace("T", " ")
      )
    );

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
      totalExpectedAmountCents: appointments.totalExpectedAmountCents,
      totalPaidAmountCents: appointments.totalPaidAmountCents,
      remainingBalanceCents: appointments.remainingBalanceCents,
      paymentStatus: appointments.paymentStatus,
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
    depositPaid: 1,
    confirmationSent: 0, // Will be set to 1 after notification is sent
    updatedAt: new Date(),
    totalPaidAmountCents: sql`COALESCE(totalPaidAmountCents, 0) + (COALESCE(depositAmount, 0) * 100)`,
    remainingBalanceCents: sql`GREATEST(0, COALESCE(totalExpectedAmountCents, 0) - (COALESCE(totalPaidAmountCents, 0) + (COALESCE(depositAmount, 0) * 100)))`,
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
/** Ids an artist gives the people they add or import. Nobody signed up to get one. */
const ARTIST_MADE_CLIENT_ID = /^(client_|usr_imp_)/;

const mysqlNow = () => new Date().toISOString().slice(0, 19).replace("T", " ");

function chunks<T>(items: T[], size = 500): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size));
  return out;
}

type RemovalDb = MySql2Database<typeof schema>;

type RemovableAppointment = {
  id: number;
  conversationId: number | null;
  clientId: string;
  status: string;
  endTime: string;
  depositPaymentId: string | null;
  balancePaymentId: string | null;
  depositPaid: number | null;
  clientPaid: number | null;
  amountPaid: number | null;
  totalPaidAmountCents: number | null;
  paymentStatus: string | null;
};

/** Money has changed hands for this sitting, by card or recorded by the artist. */
export function appointmentIsPaid(appointment: RemovableAppointment) {
  return (
    !!appointment.depositPaymentId ||
    !!appointment.balancePaymentId ||
    !!appointment.depositPaid ||
    !!appointment.clientPaid ||
    (appointment.amountPaid ?? 0) > 0 ||
    (appointment.totalPaidAmountCents ?? 0) > 0 ||
    (!!appointment.paymentStatus &&
      appointment.paymentStatus !== "pending_deposit")
  );
}

/**
 * An artist's appointments (optionally with one client) sorted into what may be deleted and what
 * is a record that has to stay:
 * - `paid`: carries a Stripe payment id, a recorded payment, a paid payment request or
 *   payment_ledger rows;
 * - `openRequest`: has a payment request the client can still pay;
 * - `kept`: both of the above, plus sittings with a signed consent form or a procedure log.
 */
async function sortArtistAppointments(
  db: RemovalDb,
  artistId: string,
  clientId?: string
) {
  const rows: RemovableAppointment[] = await db
    .select({
      id: appointments.id,
      conversationId: appointments.conversationId,
      clientId: appointments.clientId,
      status: appointments.status,
      endTime: appointments.endTime,
      depositPaymentId: appointments.depositPaymentId,
      balancePaymentId: appointments.balancePaymentId,
      depositPaid: appointments.depositPaid,
      clientPaid: appointments.clientPaid,
      amountPaid: appointments.amountPaid,
      totalPaidAmountCents: appointments.totalPaidAmountCents,
      paymentStatus: appointments.paymentStatus,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.artistId, artistId),
        clientId ? eq(appointments.clientId, clientId) : undefined
      )
    );
  const paid = new Set(rows.filter(appointmentIsPaid).map(row => row.id));
  const openRequest = new Set<number>();
  const kept = new Set(paid);
  const now = mysqlNow();

  for (const ids of chunks(rows.map(row => row.id))) {
    const [ledger, requests, forms, logs] = await Promise.all([
      db
        .selectDistinct({ id: paymentLedger.bookingId })
        .from(paymentLedger)
        .where(inArray(paymentLedger.bookingId, ids)),
      db
        .select({
          id: paymentRequests.appointmentId,
          status: paymentRequests.status,
          expiresAt: paymentRequests.expiresAt,
        })
        .from(paymentRequests)
        .where(
          and(
            inArray(paymentRequests.appointmentId, ids),
            inArray(paymentRequests.status, ["pending", "paid"])
          )
        ),
      db
        .selectDistinct({ id: consentForms.appointmentId })
        .from(consentForms)
        .where(
          and(
            inArray(consentForms.appointmentId, ids),
            eq(consentForms.status, "signed")
          )
        ),
      db
        .selectDistinct({ id: procedureLogs.appointmentId })
        .from(procedureLogs)
        .where(inArray(procedureLogs.appointmentId, ids)),
    ]);
    for (const row of ledger) if (row.id !== null) paid.add(row.id);
    for (const row of requests) {
      if (row.status === "paid") paid.add(row.id);
      else if (!row.expiresAt || toMysqlTime(row.expiresAt) > now)
        openRequest.add(row.id);
    }
    for (const row of [...forms, ...logs])
      if (row.id !== null) kept.add(row.id);
  }
  paid.forEach(id => kept.add(id));
  openRequest.forEach(id => kept.add(id));

  const upcoming = rows.filter(
    row =>
      (row.status === "pending" || row.status === "confirmed") &&
      toMysqlTime(row.endTime) > now
  );
  return { rows, paid, openRequest, kept, upcoming };
}

const toMysqlTime = (value: string) =>
  String(value).replace("T", " ").slice(0, 19);

const OPEN_DEPOSIT_LEAD_STATUSES = ["deposit_requested", "deposit_pending"];
const CLOSED_LEAD_STATUSES = ["lost", "archived", "completed"];

/**
 * Deposits that live outside appointments and payment requests, and so are invisible to
 * sortArtistAppointments:
 * - a session plan has no sittings, payment request or ledger row until its deposit lands, and
 *   deleting its conversation cascades the plan away, leaving the payment with nothing to attach to;
 * - a proposal deposit is tracked on the lead (and its pending sittings) alone.
 *
 * `clientIds` / `conversationIds` / `leadIds` have to stay. `open` counts the ones a client has
 * been asked for or has started paying and that have not settled yet.
 */
async function depositHolds(
  db: RemovalDb,
  artistId: string,
  clientId?: string
) {
  const [plans, leadRows] = await Promise.all([
    db
      .select({
        clientId: sessionPlans.clientId,
        conversationId: sessionPlans.conversationId,
        status: sessionPlans.status,
        stripeSessionId: sessionPlans.stripeSessionId,
      })
      .from(sessionPlans)
      .where(
        and(
          eq(sessionPlans.artistId, artistId),
          clientId ? eq(sessionPlans.clientId, clientId) : undefined
        )
      ),
    db
      .select({
        id: leads.id,
        clientId: leads.clientId,
        conversationId: leads.conversationId,
        status: leads.status,
        stripeCheckoutSessionId: leads.stripeCheckoutSessionId,
        depositClaimedAt: leads.depositClaimedAt,
        depositVerifiedAt: leads.depositVerifiedAt,
        depositProof: leads.depositProof,
      })
      .from(leads)
      .where(
        and(
          eq(leads.artistId, artistId),
          clientId ? eq(leads.clientId, clientId) : undefined
        )
      ),
  ]);
  const clientIds = new Set<string>();
  const conversationIds = new Set<number>();
  const leadIds = new Set<number>();
  let open = 0;
  const hold = (row: {
    clientId: string | null;
    conversationId: number | null;
  }) => {
    if (row.clientId) clientIds.add(row.clientId);
    if (row.conversationId !== null && row.conversationId !== undefined)
      conversationIds.add(row.conversationId);
  };

  for (const plan of plans) {
    // Checkout started (whatever happened to the plan since), or money taken or returned.
    const held =
      !!plan.stripeSessionId ||
      plan.status === "accepted" ||
      plan.status === "refunded";
    if (!held) continue;
    hold(plan);
    if (plan.status === "pending") open++;
  }
  for (const lead of leadRows) {
    const asked = OPEN_DEPOSIT_LEAD_STATUSES.includes(lead.status);
    const held =
      asked ||
      lead.status === "deposit_verified" ||
      !!lead.stripeCheckoutSessionId ||
      !!lead.depositClaimedAt ||
      !!lead.depositVerifiedAt ||
      !!lead.depositProof;
    if (!held) continue;
    hold(lead);
    leadIds.add(lead.id);
    const unsettledCheckout =
      !!lead.stripeCheckoutSessionId &&
      !lead.depositVerifiedAt &&
      lead.status !== "deposit_verified" &&
      !CLOSED_LEAD_STATUSES.includes(lead.status);
    if (asked || unsettledCheckout) open++;
  }
  return { clientIds, conversationIds, leadIds, open };
}

type DepositHolds = Awaited<ReturnType<typeof depositHolds>>;

/**
 * The ids in `rows` that must not be deleted: `kept` from sortArtistAppointments, plus the pending
 * sittings of a client or conversation with a deposit hold (a proposal deposit confirms exactly
 * those sittings when it lands).
 */
function withDepositHolds(
  rows: RemovableAppointment[],
  kept: Set<number>,
  holds: DepositHolds
) {
  const all = new Set(kept);
  for (const row of rows)
    if (
      row.status === "pending" &&
      (holds.clientIds.has(row.clientId) ||
        (row.conversationId !== null &&
          holds.conversationIds.has(row.conversationId)))
    )
      all.add(row.id);
  return all;
}

async function deleteAppointmentRows(db: RemovalDb, ids: number[]) {
  for (const batch of chunks(ids))
    await db.delete(appointments).where(inArray(appointments.id, batch));
}

/**
 * Removes the artist-made client records in `clientIds` that nobody has signed in to and that no
 * artist holds anything for any more. A real account is never removed here: only its owner can
 * delete it, through accountDeletion.
 */
async function removeUnusedPlaceholderClients(
  db: RemovalDb,
  clientIds: string[]
) {
  let removed = 0;
  const artistMade = clientIds.filter(id => ARTIST_MADE_CLIENT_ID.test(id));
  for (const ids of chunks(artistMade)) {
    const people = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          inArray(users.id, ids),
          eq(users.role, "client"),
          isNull(users.password),
          isNull(users.clerkId),
          isNull(users.googleSub),
          or(isNull(users.loginMethod), eq(users.loginMethod, "imported"))
        )
      );
    const unused = new Set(people.map(person => person.id));
    if (unused.size === 0) continue;
    // Deleting a users row cascades into all of these, so one row anywhere keeps the record.
    const holders = [
      appointments,
      conversations,
      leads,
      consentForms,
      paymentLedger,
      paymentRequests,
      procedureLogs,
      clientNotes,
      clientContent,
      consultations,
      sessionPlans,
      issuedVouchers,
      issuedPromotions,
      clientOffers,
      orders,
      waitlistEntries,
    ];
    for (const table of holders) {
      if (unused.size === 0) break;
      const held: { clientId: string | null }[] = await db
        .selectDistinct({ clientId: table.clientId })
        .from(table as typeof appointments)
        .where(inArray(table.clientId, Array.from(unused)));
      for (const row of held) if (row.clientId) unused.delete(row.clientId);
    }
    if (unused.size === 0) continue;
    await db
      .delete(users)
      .where(
        and(
          inArray(users.id, Array.from(unused)),
          eq(users.role, "client"),
          isNull(users.password),
          isNull(users.clerkId),
          isNull(users.googleSub)
        )
      );
    removed += unused.size;
  }
  return removed;
}

export type ClientRemovalResult = {
  success: true;
  deletedAppointments: number;
  /**
   * Paid bookings, bookings with an open payment request, sittings with signed forms, sittings
   * still coming up and sittings waiting on a deposit.
   */
  keptAppointments: number;
  /** Of those, pending or confirmed sittings still to come. The artist has to cancel them first. */
  upcomingSittings: number;
  /** A deposit or session plan payment with this client is on record or still in progress. */
  depositOnRecord: boolean;
  /** The artist's conversation, notes and requests for this client are gone. */
  clientRemoved: boolean;
};

/**
 * Deletes the artist's unpaid bookings with one client and, with `removeClient`, the artist's own
 * link to them: the conversation, notes and booking requests. Paid bookings, bookings with a
 * payment request still open and sittings with signed forms are never deleted, and while any exist
 * the conversation they belong to stays too (deleting it would cascade into them).
 *
 * Pending or confirmed sittings still to come are kept as well: the artist cancels those the
 * normal way, so the client is told and so this is not a quiet way around the checks that hold up
 * account deletion. A deposit in progress or on record (see depositHolds) keeps the conversation,
 * the lead and the sittings waiting on it.
 *
 * The client's account is not the artist's to delete. The only users row this can remove is a
 * record an artist added or imported that nobody signed in to and nobody holds anything for.
 */
export async function deleteAppointmentsForClient(
  artistId: string,
  clientId: string,
  removeClient?: boolean
): Promise<ClientRemovalResult> {
  return withDatabaseTransaction(async db => {
    if (offersEnabled()) {
      const credit = await db.query.clientOffers.findFirst({
        where: and(
          eq(clientOffers.artistId, artistId),
          eq(clientOffers.clientId, clientId)
        ),
      });
      if (credit)
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "This client has voucher or promotion history. Their bookings and records have to be kept, so nothing was deleted.",
        });
    }

    const sorted = await sortArtistAppointments(db, artistId, clientId);
    const holds = await depositHolds(db, artistId, clientId);
    const { rows, upcoming } = sorted;
    const kept = withDepositHolds(rows, sorted.kept, holds);
    for (const row of upcoming) kept.add(row.id);
    const depositOnRecord =
      holds.clientIds.size > 0 || holds.conversationIds.size > 0;
    const deletable = rows.filter(row => !kept.has(row.id)).map(row => row.id);
    await deleteAppointmentRows(db, deletable);

    const result: ClientRemovalResult = {
      success: true,
      deletedAppointments: deletable.length,
      keptAppointments: kept.size,
      upcomingSittings: upcoming.length,
      depositOnRecord,
      clientRemoved: false,
    };
    if (!removeClient || kept.size > 0 || depositOnRecord) return result;

    const mine = <T extends { artistId: unknown; clientId: unknown }>(
      table: T
    ) =>
      and(
        eq(table.artistId as typeof appointments.artistId, artistId),
        eq(table.clientId as typeof appointments.clientId, clientId)
      );
    await db.delete(conversations).where(mine(conversations));
    await db.delete(clientNotes).where(mine(clientNotes));
    await db.delete(leads).where(mine(leads));
    await removeUnusedPlaceholderClients(db, [clientId]);
    return { ...result, clientRemoved: true };
  });
}

export type ArtistWipeResult = {
  success: true;
  deletedAppointments: number;
  keptAppointments: number;
  removedClients: number;
  keptClients: number;
};

const countOf = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/**
 * Why an artist cannot bulk delete right now. These are the same things that hold up account
 * deletion, so wiping must not be a way to make them disappear.
 */
export function artistWipeBlockers(counts: {
  upcomingSittings: number;
  paidBookings: number;
  openPaymentRequests: number;
  /** Proposal or session plan deposits a client has been asked for or has started paying. */
  openDeposits?: number;
}) {
  const reasons: string[] = [];
  const openDeposits = counts.openDeposits ?? 0;
  if (counts.upcomingSittings > 0)
    reasons.push(
      `You have ${countOf(counts.upcomingSittings, "upcoming sitting", "upcoming sittings")} still pending or confirmed. Cancel or complete ${counts.upcomingSittings === 1 ? "it" : "them"} first so your clients are told.`
    );
  if (counts.openPaymentRequests > 0)
    reasons.push(
      `You have ${countOf(counts.openPaymentRequests, "payment request", "payment requests")} a client can still pay. Wait for payment or cancel ${counts.openPaymentRequests === 1 ? "it" : "them"} first.`
    );
  if (openDeposits > 0)
    reasons.push(
      `You have ${countOf(openDeposits, "deposit", "deposits")} a client has been asked for or has started paying. Wait for the payment to finish or withdraw the request first.`
    );
  if (counts.paidBookings > 0)
    reasons.push(
      `You have ${countOf(counts.paidBookings, "paid booking", "paid bookings")}. Paid bookings are payment records and have to be kept, so delete unpaid bookings one client at a time from your client list instead.`
    );
  return reasons;
}

async function sortForWipe(db: RemovalDb, artistId: string) {
  const sorted = await sortArtistAppointments(db, artistId);
  const holds = await depositHolds(db, artistId);
  const blockers = artistWipeBlockers({
    upcomingSittings: sorted.upcoming.length,
    paidBookings: sorted.paid.size,
    openPaymentRequests: sorted.openRequest.size,
    openDeposits: holds.open,
  });
  if (blockers.length > 0)
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: [
        "Nothing was deleted:",
        ...blockers.map(reason => `• ${reason}`),
      ].join("\n"),
    });
  return {
    rows: sorted.rows,
    kept: withDepositHolds(sorted.rows, sorted.kept, holds),
    holds,
  };
}

/** The "delete all appointments" danger-zone action. Refuses rather than delete around records. */
export async function deleteAllAppointmentsForArtist(
  artistId: string
): Promise<ArtistWipeResult> {
  return withDatabaseTransaction(async db => {
    const { rows, kept } = await sortForWipe(db, artistId);
    const deletable = rows.filter(row => !kept.has(row.id)).map(row => row.id);
    await deleteAppointmentRows(db, deletable);
    return {
      success: true,
      deletedAppointments: deletable.length,
      keptAppointments: kept.size,
      removedClients: 0,
      keptClients: 0,
    };
  });
}

/**
 * The "delete all clients" danger-zone action: the artist's unpaid bookings, and their
 * conversation, notes and requests for every client who has no record that must be kept.
 * Client accounts themselves are left alone (see deleteAppointmentsForClient).
 */
export async function deleteAllClientsForArtist(
  artistId: string
): Promise<ArtistWipeResult> {
  return withDatabaseTransaction(async db => {
    const { rows, kept, holds } = await sortForWipe(db, artistId);
    const keptRows = rows.filter(row => kept.has(row.id));
    const keptClientIds = new Set(keptRows.map(row => row.clientId));
    const keptConversationIds = new Set(
      keptRows.map(row => row.conversationId)
    );
    // Settled deposits and session plans are records too; deleting the conversation would
    // cascade a plan away and orphan the lead a deposit is tracked on.
    holds.clientIds.forEach(id => keptClientIds.add(id));
    holds.conversationIds.forEach(id => keptConversationIds.add(id));
    if (offersEnabled()) {
      const credited = await db
        .selectDistinct({ clientId: clientOffers.clientId })
        .from(clientOffers)
        .where(eq(clientOffers.artistId, artistId));
      for (const row of credited) keptClientIds.add(row.clientId);
    }

    const deletable = rows.filter(row => !kept.has(row.id)).map(row => row.id);
    await deleteAppointmentRows(db, deletable);

    const threads = await db
      .select({ id: conversations.id, clientId: conversations.clientId })
      .from(conversations)
      .where(eq(conversations.artistId, artistId));
    const removable = threads.filter(
      thread =>
        !keptConversationIds.has(thread.id) &&
        !(thread.clientId && keptClientIds.has(thread.clientId))
    );
    for (const ids of chunks(removable.map(thread => thread.id)))
      await db.delete(conversations).where(inArray(conversations.id, ids));

    // Someone with a second conversation that stays is still a client of this artist.
    const removableIds = new Set(removable.map(thread => thread.id));
    const stillClients = new Set(
      threads
        .filter(thread => !removableIds.has(thread.id))
        .map(thread => thread.clientId)
    );
    const removedClientIds = Array.from(
      new Set(
        removable
          .map(thread => thread.clientId)
          .filter((id): id is string => !!id && !stillClients.has(id))
      )
    );
    for (const ids of chunks(removedClientIds)) {
      await db
        .delete(clientNotes)
        .where(
          and(
            eq(clientNotes.artistId, artistId),
            inArray(clientNotes.clientId, ids)
          )
        );
      await db
        .delete(leads)
        .where(and(eq(leads.artistId, artistId), inArray(leads.clientId, ids)));
    }
    await removeUnusedPlaceholderClients(db, removedClientIds);

    return {
      success: true,
      deletedAppointments: deletable.length,
      keptAppointments: kept.size,
      removedClients: removable.length,
      keptClients: threads.length - removable.length,
    };
  });
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
    lt(appointments.startTime, toMySQL(endTime)),
    gt(appointments.endTime, toMySQL(startTime)),
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

  if (conflicts.length) return true;
  return hasRescheduleHold(
    db,
    artistId,
    startTime,
    endTime,
    excludeAppointmentId
  );
}

/**
 * QLD Form 9 Procedure Log Automation
 * Snapshots current data into procedure_logs table
 */
export async function createProcedureLog(appointmentId: number) {
  return withDatabaseTransaction(async db => {
    await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(eq(appointments.id, appointmentId))
      .for("update");

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

    const existing = await db.query.procedureLogs.findFirst({
      where: eq(procedureLogs.appointmentId, appointmentId),
    });
    if (existing) return;
    await db.insert(procedureLogs).values({
      appointmentId,
      artistId: appt.artistId,
      clientId: appt.clientId,
      date: appt.actualStartTime || appt.startTime,
      clientName: appt.client?.name || "Unknown",
      clientDob: appt.client?.birthday,
      artistLicenceNumber: settings?.licenceNumber || "Not recorded",
      amountPaid: appt.totalPaidAmountCents ?? (appt.amountPaid || 0) * 100,
      paymentMethod: appt.paymentMethod || "Not recorded",
    });
  });
}

/**
 * Auto-generate required forms for a newly confirmed appointment
 */
export async function generateRequiredForms(
  appointmentId: number,
  transaction?: any
) {
  const db = transaction || (await getDb());
  if (!db) return;

  const appt = await db.query.appointments.findFirst({
    where: eq(appointments.id, appointmentId),
  });
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
    content: settings.consentTemplate || DEFAULT_CONSENT_TEMPLATE,
    status: "pending" as const,
  });

  // Medical Release
  forms.push({
    appointmentId,
    clientId: appt.clientId,
    artistId: appt.artistId,
    formType: "medical_release" as const,
    title: "Medical History & Release",
    content: settings.medicalTemplate || DEFAULT_MEDICAL_TEMPLATE,
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

    await db
      .update(appointments)
      .set({
        serviceName: mappedServiceName,
        title: mappedServiceName,
        price: mappedPrice,
        endTime: newEndTime,
      })
      .where(eq(appointments.id, appt.id));
  }
}
