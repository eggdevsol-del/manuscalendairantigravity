import "dotenv/config";
import { getDb } from "../server/services/core";
import { messages } from "../drizzle/schema";
import { eq } from "drizzle-orm";

async function inspect() {
    const db = await getDb();
    if (!db) return;

    const msg = await db.select().from(messages).where(eq(messages.id, 283)).limit(1);
    if (msg.length > 0) {
        console.log(`[MSG 283]`);
        console.log(`Metadata: ${msg[0].metadata}`);
    } else {
        console.log("Message 283 not found");
    }
}

inspect().catch(console.error);
