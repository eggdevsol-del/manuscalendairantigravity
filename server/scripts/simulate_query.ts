
import 'dotenv/config';
import * as db from '../db';
import { getDb } from '../services/core';

async function simulate() {
    const userId = 'user_ce549c0b4b6f90aaafad0546a0928050'; // P mason tattoo artist
    const role = 'artist';

    console.log(`Simulating conversations.list for user: ${userId} (${role})`);

    try {
        const convos = await db.getConversationsForUser(userId, role);
        console.log(`Found ${convos.length} conversations.`);

        const enriched = await Promise.all(
            convos.map(async (conv) => {
                const otherUserId = role === "artist" ? conv.clientId : conv.artistId;
                console.log(`  Processing conv ${conv.id} with otherUser: ${otherUserId}`);

                const otherUser = await db.getUser(otherUserId);
                console.log(`    getUser result: ${otherUser ? 'Found' : 'NULL'}`);

                try {
                    const unreadCount = await db.getUnreadMessageCount(conv.id, userId);
                    console.log(`    unreadCount: ${unreadCount}`);
                    return { ...conv, otherUser, unreadCount };
                } catch (err: any) {
                    console.error(`    ERROR in getUnreadMessageCount: ${err.message}`);
                    return { ...conv, otherUser, unreadCount: -1 };
                }
            })
        );

        console.log("Enrichment complete.");
        console.log("First result:", enriched[0]);

    } catch (err: any) {
        console.error("CRITICAL ERROR:", err);
    }
}

simulate().catch(console.error);
