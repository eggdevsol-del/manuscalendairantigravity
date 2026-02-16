import "dotenv/config";
import { getDb } from "../server/services/core";
import { messages } from "../drizzle/schema";
import { desc } from "drizzle-orm";

async function dump() {
    const db = await getDb();
    if (!db) return;

    const proposals = await db.select().from(messages).where(
        // We can't easily filter by JSON content in WHERE with some drivers, so we filter in JS
    ).orderBy(desc(messages.createdAt));

    const projectProposals = proposals.filter(m => {
        try {
            const meta = m.metadata ? JSON.parse(m.metadata) : {};
            return meta.type === 'project_proposal';
        } catch (e) {
            return false;
        }
    }).slice(0, 10);

    console.log(`--- RECENT 10 PROJECT PROPOSALS ---`);
    projectProposals.forEach(p => {
        console.log(`\n[ID: ${p.id}] Created: ${p.createdAt}`);
        console.log(`METADATA_START`);
        console.log(p.metadata);
        console.log(`METADATA_END`);
    });
}

dump().catch(console.error);
