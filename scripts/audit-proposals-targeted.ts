import "dotenv/config";
import { getDb } from "../server/services/core";
import { sysLogger } from "../server/services/systemLogService";
import { messages, appointments } from "../drizzle/schema";
import { eq, or, and } from "drizzle-orm";

async function audit() {
    try {
        const db = await getDb();
        if (!db) {
            console.error("Failed to get DB");
            return;
        }

        console.log("DB instance retrieved.");

        await sysLogger.info("audit", "Targeted audit for 3PM/4PM issue").catch(e => console.error("Logger failed:", e));

        console.log("=== TARGETED AUDIT ===");

        // Target appointments 219 and 220
        const targetAppts = await db.select().from(appointments).where(or(eq(appointments.id, 219), eq(appointments.id, 220)));

        console.log(`\nAppointments Found: ${targetAppts.length}`);
        targetAppts.forEach(a => {
            console.log(`ID: ${a.id}, Title: ${a.title}, Start: ${a.startTime}, Status: ${a.status}`);
        });

        // Find messages that might be related
        console.log("Fetching messages...");
        const allMessages = await db.select().from(messages);
        const relatedMessages = allMessages.filter(m => {
            if (!m.metadata) return false;
            try {
                const meta = JSON.parse(m.metadata);
                // Search for service name or specific date in proposedDates
                return meta.serviceName === '1 hour' || (meta.dates && meta.dates.some((d: string) => d.includes('2026-02-17')));
            } catch (e) {
                return false;
            }
        });

        console.log(`\nRelated Messages: ${relatedMessages.length}`);
        relatedMessages.forEach(m => {
            try {
                const meta = JSON.parse(m.metadata!);
                console.log(`\n[MSG ${m.id}]`);
                console.log(`Created: ${m.createdAt}`);
                console.log(`Status: ${meta.status}`);
                console.log(`Dates: ${JSON.stringify(meta.dates || meta.proposedDates)}`);
            } catch (e) {
                console.error(`Failed to parse metadata for MSG ${m.id}`, e);
            }
        });
    } catch (err) {
        console.error("CRASHED:", err);
    }
}

audit().catch(console.error);
