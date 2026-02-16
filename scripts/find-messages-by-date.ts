import "dotenv/config";
import { getDb } from "../server/services/core";
import { messages } from "../drizzle/schema";

async function findMessages() {
    const db = await getDb();
    if (!db) return;

    const all = await db.select().from(messages);
    console.log(`Searching ${all.length} messages...`);

    const result = all.filter(m => {
        if (!m.metadata) return false;
        return m.metadata.includes('2026-02-17');
    });

    console.log(`Found ${result.length} matching messages.`);

    result.forEach(m => {
        console.log(`\n[MSG ${m.id}]`);
        console.log(`Created: ${m.createdAt}`);
        console.log(`Metadata: ${m.metadata}`);
    });
}

findMessages().catch(console.error);
