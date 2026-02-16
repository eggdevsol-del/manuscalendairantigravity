import "dotenv/config";
import { getDb } from "../server/services/core";
import { systemLogs } from "../drizzle/schema";
import { desc } from "drizzle-orm";
import * as fs from "fs";

async function readLogs() {
    const db = await getDb();
    if (!db) return;

    const logs = await db.select().from(systemLogs).orderBy(desc(systemLogs.createdAt)).limit(50);

    let output = "=== RECENT SYSTEM LOGS ===\n";
    logs.forEach(l => {
        output += `[${l.createdAt}] [${l.level}] [${l.category}] ${l.message}\n`;
        if (l.metadata) {
            output += `Metadata: ${l.metadata}\n`;
        }
        output += `-----------------------------------\n`;
    });

    fs.writeFileSync("scripts/system-logs.txt", output);
    console.log("Written to scripts/system-logs.txt");
}

readLogs().catch(console.error);
