import { getDb } from '../server/services/core';
import { eq } from 'drizzle-orm';
import * as schema from '../drizzle/schema';

async function checkInvites() {
    const db = await getDb();
    if (!db) {
        console.error("Database connection failed");
        process.exit(1);
    }

    // Dump studioMembers table
    const members = await db.query.studioMembers.findMany({
        where: eq(schema.studioMembers.id, 11)
    });
    console.log("=== Target Studio Member Invite 11 ===");
    console.log(JSON.stringify(members, null, 2));

    // Dump pending messages containing metadata
    const messages = await db.select().from(schema.messages).where(
        eq(schema.messages.messageType, 'studio_invite')
    );
    console.log("=== Studio Invite Messages ===");
    for (const msg of messages) {
        console.log(`Msg ID: ${msg.id}`);
        console.log(`Conv ID: ${msg.conversationId}`);
        console.log(`Sender ID: ${msg.senderId}`);
        console.log(`Metadata:`, msg.metadata);
        console.log("---");
    }

    process.exit(0);
}

checkInvites().catch(console.error);
