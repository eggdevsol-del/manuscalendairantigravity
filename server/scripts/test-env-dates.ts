import "dotenv/config";
import { appointments, users } from "../../drizzle/schema";
import { getDb } from "../db";
import { desc, asc, eq } from "drizzle-orm";

(async () => {
    const db = await getDb();
    if (!db) process.exit(1);

    const appsEarliest = await db.select({ start: appointments.startTime })
        .from(appointments)
        .leftJoin(users, eq(appointments.clientId, users.id))
        .where(eq(users.loginMethod, "imported"))
        .orderBy(asc(appointments.startTime))
        .limit(1);

    const appsLatest = await db.select({ start: appointments.startTime })
        .from(appointments)
        .leftJoin(users, eq(appointments.clientId, users.id))
        .where(eq(users.loginMethod, "imported"))
        .orderBy(desc(appointments.startTime))
        .limit(1);

    console.log("== IMPORTED DATE BOUNDS ==");
    console.log("Earliest:", appsEarliest[0]?.start);
    console.log("Latest:", appsLatest[0]?.start);

    // Also let's just see a random sample to confirm the spread.
    const sample = await db.select({ start: appointments.startTime })
        .from(appointments)
        .leftJoin(users, eq(appointments.clientId, users.id))
        .where(eq(users.loginMethod, "imported"))
        .limit(20);
    console.log("Sample Set:", sample.map(s => s.start).join(", "));

    process.exit(0);
})();
