import "dotenv/config";
import { getDb } from "./server/services/core";
import { users, clients } from "./drizzle/schema";
import { eq } from "drizzle-orm";

async function main() {
    console.log("Checking DB for user ID: user_ce549c0b4b6f90aaafad0546a0928050");
    const db = await getDb();
    if (!db) return process.exit(1);

    const userMatch = await db.select().from(users).where(eq(users.id, "user_ce549c0b4b6f90aaafad0546a0928050"));
    console.log("Found in users table?", userMatch.length > 0 ? userMatch[0].name : "NO");

    const clientMatch = await db.select().from(clients).where(eq(clients.id, "user_ce549c0b4b6f90aaafad0546a0928050"));
    console.log("Found in clients table?", clientMatch.length > 0 ? clientMatch[0].name : "NO");

    process.exit(0);
}

main().catch(console.error);
