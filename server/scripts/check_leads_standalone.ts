
import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

async function main() {
    console.log("Checking leads (Standalone)...");

    if (!process.env.DATABASE_URL) {
        console.error("DATABASE_URL not set");
        return;
    }

    const connection = await mysql.createConnection({
        uri: process.env.DATABASE_URL,
    });
    const db = drizzle(connection, { schema, mode: "default" });

    // Get all artists
    const artists = await db.query.users.findMany({
        where: eq(schema.users.role, 'artist'),
    });

    console.log(`Found ${artists.length} artists`);

    for (const artist of artists) {
        console.log(`\nArtist: ${artist.displayName || artist.username} (ID: ${artist.id})`);

        const leads = await db.query.leads.findMany({
            where: eq(schema.leads.artistId, artist.id),
            orderBy: [desc(schema.leads.createdAt)],
        });

        console.log(`Total Leads: ${leads.length}`);
        leads.forEach(l => {
            console.log(` - Lead #${l.id}: ${l.name} (${l.email}) - Status: '${l.status}'`);
        });

        // Also check unread conversations
        const convos = await db.query.conversations.findMany({
            where: eq(schema.conversations.artistId, artist.id),
        });
        console.log(`Total Conversations: ${convos.length}`);
    }

    await connection.end();
}

main().catch(console.error);
