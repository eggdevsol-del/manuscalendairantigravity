import { and, desc, eq, not, sql } from "drizzle-orm";
import {
    conversations,
    InsertConversation,
    messages,
    InsertMessage,
    socialMessageSync,
    InsertSocialMessageSync,
} from "../../drizzle/schema";
import { getDb } from "./core";

// ============================================================================
// Conversation operations
// ============================================================================

export async function getConversation(artistId: string, clientId: string) {
    const db = await getDb();
    if (!db) return undefined;

    const result = await db
        .select()
        .from(conversations)
        .where(
            and(
                eq(conversations.artistId, artistId),
                eq(conversations.clientId, clientId)
            )
        )
        .limit(1);

    return result.length > 0 ? result[0] : undefined;
}

export async function getConversationById(id: number) {
    const db = await getDb();
    if (!db) return undefined;

    const result = await db
        .select()
        .from(conversations)
        .where(eq(conversations.id, id))
        .limit(1);

    return result.length > 0 ? result[0] : undefined;
}

export async function createConversation(conv: InsertConversation) {
    const db = await getDb();
    if (!db) return undefined;

    const result = await db.insert(conversations).values(conv);
    return getConversationById(Number(result[0].insertId));
}

export async function getConversationsForUser(userId: string, role: string) {
    const db = await getDb();
    if (!db) return [];

    const condition =
        role === "artist"
            ? eq(conversations.artistId, userId)
            : eq(conversations.clientId, userId);

    const convs = await db
        .select()
        .from(conversations)
        .where(condition)
        .orderBy(desc(conversations.lastMessageAt));

    // Also get the latest message for each conversation
    const enrichedConvs = await Promise.all(
        convs.map(async (conv) => {
            const lastMessageResult = await db
                .select()
                .from(messages)
                .where(eq(messages.conversationId, conv.id))
                .orderBy(desc(messages.createdAt))
                .limit(1);

            return {
                ...conv,
                lastMessage: lastMessageResult.length > 0 ? lastMessageResult[0] : null
            };
        })
    );

    return enrichedConvs;
}

export async function updateConversationTimestamp(conversationId: number) {
    const db = await getDb();
    if (!db) return;

    await db
        .update(conversations)
        .set({ lastMessageAt: sql`NOW()` })
        .where(eq(conversations.id, conversationId));
}

// Pin a consultation to a conversation
export async function pinConsultation(conversationId: number, consultationId: number | null) {
    const db = await getDb();
    if (!db) return;

    await db
        .update(conversations)
        .set({ pinnedConsultationId: consultationId })
        .where(eq(conversations.id, conversationId));
}

// ============================================================================
// Message operations
// ============================================================================

export async function createMessage(message: InsertMessage) {
    const db = await getDb();
    if (!db) return undefined;

    const result = await db.insert(messages).values(message);
    await updateConversationTimestamp(message.conversationId);

    const inserted = await db
        .select()
        .from(messages)
        .where(eq(messages.id, Number(result[0].insertId)))
        .limit(1);

    return inserted[0];
}

export async function getMessages(conversationId: number, limit = 100) {
    const db = await getDb();
    if (!db) return [];

    return db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(desc(messages.createdAt))
        .limit(limit);
}

export async function getMessageById(messageId: number) {
    const db = await getDb();
    if (!db) return undefined;

    const result = await db
        .select()
        .from(messages)
        .where(eq(messages.id, messageId))
        .limit(1);

    return result[0];
}

export async function updateMessageMetadata(messageId: number, metadata: string) {
    const db = await getDb();
    if (!db) return;

    await db
        .update(messages)
        .set({ metadata })
        .where(eq(messages.id, messageId));
}

export async function getUnreadMessageCount(conversationId: number, userId: string) {
    const db = await getDb();
    if (!db) return 0;

    const allMessages = await db
        .select()
        .from(messages)
        .where(
            and(
                eq(messages.conversationId, conversationId),
                not(eq(messages.senderId, userId))
            )
        );

    // Count messages not read by this user
    const unreadCount = allMessages.filter(msg => {
        if (!msg.readBy) return true;
        try {
            const readByList = JSON.parse(msg.readBy);
            return !readByList.includes(userId);
        } catch {
            return true;
        }
    }).length;

    return unreadCount;
}

export async function markMessagesAsRead(conversationId: number, userId: string) {
    const db = await getDb();
    if (!db) return;

    const allMessages = await db
        .select()
        .from(messages)
        .where(
            and(
                eq(messages.conversationId, conversationId),
                not(eq(messages.senderId, userId))
            )
        );

    for (const msg of allMessages) {
        let readByList: string[] = [];
        if (msg.readBy) {
            try {
                readByList = JSON.parse(msg.readBy);
            } catch {
                readByList = [];
            }
        }

        if (!readByList.includes(userId)) {
            readByList.push(userId);
            await db
                .update(messages)
                .set({ readBy: JSON.stringify(readByList) })
                .where(eq(messages.id, msg.id));
        }
    }
}

// ============================================================================
// Social Message Sync operations
// ============================================================================

export async function getSocialMessageSync(
    artistId: string,
    platform: "instagram" | "facebook"
) {
    const db = await getDb();
    if (!db) return undefined;

    const result = await db
        .select()
        .from(socialMessageSync)
        .where(
            and(
                eq(socialMessageSync.artistId, artistId),
                eq(socialMessageSync.platform, platform)
            )
        )
        .limit(1);

    return result.length > 0 ? result[0] : undefined;
}

export async function upsertSocialMessageSync(
    sync: InsertSocialMessageSync
) {
    const db = await getDb();
    if (!db) return undefined;

    const existing = await getSocialMessageSync(
        sync.artistId,
        sync.platform as any
    );

    if (existing) {
        await db
            .update(socialMessageSync)
            .set({ ...sync, updatedAt: sql`NOW()` })
            .where(eq(socialMessageSync.id, existing.id));
        return getSocialMessageSync(sync.artistId, sync.platform as any);
    } else {
        const result = await db.insert(socialMessageSync).values(sync);
        const inserted = await db
            .select()
            .from(socialMessageSync)
            .where(eq(socialMessageSync.id, Number(result[0].insertId)))
            .limit(1);
        return inserted[0];
    }
}

export async function getAllSocialMessageSyncs(artistId: string) {
    const db = await getDb();
    if (!db) return [];

    return db
        .select()
        .from(socialMessageSync)
        .where(eq(socialMessageSync.artistId, artistId));
}
