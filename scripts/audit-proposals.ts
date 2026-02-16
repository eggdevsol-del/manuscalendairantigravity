import "dotenv/config";
import { getDb } from "../server/services/core";
import { sysLogger } from "../server/services/systemLogService";
import { messages, appointments } from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

async function audit() {
    const db = await getDb();
    if (!db) return;

    await sysLogger.info("audit", "Running proposal audit to investigate status issue");

    console.log("--- AUDIT: PROPOSALS & APPOINTMENTS ---");

    // Get all project proposal messages
    const allMessages = await db.select().from(messages).orderBy(desc(messages.createdAt));
    const proposals = allMessages.filter(m => {
        try {
            const meta = m.metadata ? JSON.parse(m.metadata) : {};
            return meta.type === 'project_proposal';
        } catch (e) {
            return false;
        }
    });

    console.log(`Found ${proposals.length} proposal messages.`);

    proposals.forEach(p => {
        const meta = JSON.parse(p.metadata!);
        console.log(`\n[MESSAGE ${p.id}]`);
        console.log(`Created: ${p.createdAt}`);
        console.log(`Status in Metadata: ${meta.status}`);
        console.log(`Service: ${meta.serviceName}`);
        console.log(`Cost: ${meta.totalCost}`);
        console.log(`Dates: ${JSON.stringify(meta.dates)}`);
    });

    // Get all appointments
    const allAppts = await db.select().from(appointments).orderBy(desc(appointments.startTime));
    console.log(`\nFound ${allAppts.length} appointments.`);

    allAppts.forEach(a => {
        console.log(`\n[APPOINTMENT ${a.id}]`);
        console.log(`Title: ${a.title}`);
        console.log(`Start: ${a.startTime}`);
        console.log(`Status: ${a.status}`);
        console.log(`Service: ${a.serviceName}`);
    });
}

audit().catch(console.error);
