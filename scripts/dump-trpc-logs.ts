import "dotenv/config";
import { getDb } from "../server/services/core";
import { systemLogs } from "../drizzle/schema";
import { eq, and, like, desc } from "drizzle-orm";
import * as fs from "fs";

async function dumpTrpcLogs() {
    const db = await getDb();
    if (!db) return;

    const logs = await db.select().from(systemLogs)
        .where(like(systemLogs.category, 'trpc:%'))
        .orderBy(desc(systemLogs.createdAt))
        .limit(50);

    let output = "=== TRPC LOG DUMP ===\n";
    logs.forEach(l => {
        output += `[${l.createdAt}] [${l.level}] ${l.message}\n`;
        if (l.metadata) {
            output += `Metadata: ${l.metadata}\n`;
        }
        output += `-----------------------------------\n`;
    });

    fs.writeFileSync("scripts/trpc-logs.txt", output);
    console.log("Dumped to scripts/trpc-logs.txt");
}

dumpTrpcLogs().catch(console.error);
