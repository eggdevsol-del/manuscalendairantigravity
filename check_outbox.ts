import "dotenv/config";
import { getDb } from "./server/services/core";
import { notificationOutbox } from "./drizzle/schema";
import { desc } from "drizzle-orm";

async function main() {
    console.log("Checking Outbox...");
    const db = await getDb();
    if (!db) {
        console.error("DB failed to load");
        process.exit(1);
    }
    const items = await db.select().from(notificationOutbox).orderBy(desc(notificationOutbox.createdAt)).limit(10);
    console.log("Latest Outbox Items:", items);
    process.exit(0);
}

main().catch(console.error);
