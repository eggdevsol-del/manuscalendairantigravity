
import "dotenv/config";
import { getDb } from "../services/db";
import * as schema from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

async function main() {
    console.log("Checking leads...");
    const db = await getDb();
    if (!db) {
        console.error("No DB connection");
        return;
    }

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
            console.log(` - Lead #${l.id}: ${l.name} (${l.email}) - Status: ${l.status}, Source: ${l.source}`);
        });
    }
}

main().catch(console.error).finally(() => process.exit(0));
