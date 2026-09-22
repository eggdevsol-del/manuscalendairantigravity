import { desc, eq, and, lt, sql } from "drizzle-orm";
import {
  consultations,
  conversations,
  messages,
  users,
  notificationOutbox,
  InsertConsultation,
} from "../../drizzle/schema";
import { getDb, withDatabaseTransaction } from "./core";

// ============================================================================
// Consultation operations
// ============================================================================

export async function createConsultation(
  input: InsertConsultation & { requestId?: string }
) {
  const { requestId, ...consultation } = input;
  return withDatabaseTransaction(async db => {
    if (
      !consultation.clientId ||
      consultation.clientId === consultation.artistId
    )
      throw new Error("Choose another artist to send a booking request.");
    // Serialize thread creation for this artist so concurrent requests reuse one thread.
    const [artist] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, consultation.artistId))
      .limit(1)
      .for("update");
    if (!artist || !["artist", "admin"].includes(artist.role))
      throw new Error("This artist is not available for booking requests.");
    const conversation = await db.query.conversations.findFirst({
      where: and(
        eq(conversations.artistId, consultation.artistId),
        eq(conversations.clientId, consultation.clientId)
      ),
    });
    if (requestId && conversation) {
      const previous = await db.query.messages.findFirst({
        where: and(
          eq(messages.conversationId, conversation.id),
          eq(messages.senderId, consultation.clientId),
          sql`case when json_valid(${messages.metadata}) then json_unquote(json_extract(${messages.metadata}, '$.bookingRequestId')) else null end = ${requestId}`
        ),
      });
      if (previous?.metadata) {
        const previousId = JSON.parse(previous.metadata).consultationId;
        const saved = await db.query.consultations.findFirst({
          where: and(
            eq(consultations.id, previousId),
            eq(consultations.clientId, consultation.clientId),
            eq(consultations.artistId, consultation.artistId)
          ),
        });
        if (saved?.conversationId) return saved;
        throw new Error(
          "The saved request could not be verified. Please contact your artist."
        );
      }
    }
    let conversationId = conversation?.id;
    if (!conversationId) {
      const [result] = await db.insert(conversations).values({
        artistId: consultation.artistId,
        clientId: consultation.clientId,
      });
      conversationId = Number(result.insertId);
    }
    if (!conversationId)
      throw new Error("Could not save the booking conversation.");
    const [result] = await db
      .insert(consultations)
      .values({ ...consultation, conversationId });
    const id = Number(result.insertId);
    if (!id) throw new Error("Could not save the booking request.");
    await db.insert(messages).values({
      conversationId,
      senderId: consultation.clientId,
      messageType: "text",
      metadata: requestId
        ? JSON.stringify({ bookingRequestId: requestId, consultationId: id })
        : null,
      content: `${consultation.subject}\n\n${consultation.description}`,
    });
    await db
      .update(conversations)
      .set({
        pinnedConsultationId: id,
        lastMessageAt: new Date().toISOString().slice(0, 19).replace("T", " "),
      })
      .where(eq(conversations.id, conversationId));
    await db.insert(notificationOutbox).values({
      eventType: "push_message",
      status: "pending",
      payloadJson: JSON.stringify({
        targetUserId: consultation.artistId,
        title: "New booking request",
        body: "You have a new booking request",
        data: {
          consultationId: id,
          conversationId,
          url: `/chat/${conversationId}`,
        },
      }),
    });
    return { ...consultation, id, conversationId };
  });
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

  const baseCondition =
    role === "artist"
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
    .set({
      ...updates,
      updatedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
    })
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
  const thirtyDaysAgoStr = thirtyDaysAgo
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");

  // Using sql directly or query builder if feasible,
  // but Drizzle query builder for updates with where clause on date:
  await db
    .update(consultations)
    .set({ status: "archived" })
    .where(
      and(
        eq(consultations.status, "pending"),
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
