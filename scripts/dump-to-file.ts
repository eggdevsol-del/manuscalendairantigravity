import "dotenv/config";
import { getDb } from "../server/services/core";
import { messages } from "../drizzle/schema";
import { desc } from "drizzle-orm";
import * as fs from "fs";

async function dumpToFile() {
    const db = await getDb();
    if (!db) return;

    const all = await db.select().from(messages).orderBy(desc(messages.createdAt));
    const proposals = all.filter(m => {
        try {
            const meta = m.metadata ? JSON.parse(m.metadata) : {};
            return meta.type === 'project_proposal';
        } catch (e) {
            return false;
        }
    }).slice(0, 20);

    let output = "=== PROPOSAL METADATA DUMP ===\n";
    proposals.forEach(p => {
        output += `\n[ID: ${p.id}] Created: ${p.createdAt}\n`;
        output += `METADATA:\n${p.metadata}\n`;
        output += `-----------------------------------\n`;
    });

    fs.writeFileSync("scripts/proposal-dump.txt", output);
    console.log("Dumped to scripts/proposal-dump.txt");
}

dumpToFile().catch(console.error);
