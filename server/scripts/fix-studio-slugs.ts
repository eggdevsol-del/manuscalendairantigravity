import { getDb } from '../db';
import { studios } from '../../drizzle/schema';
import { v4 as uuid } from 'uuid';
import { isNull, eq } from 'drizzle-orm';

async function fixSlugs() {
    const db = await getDb();
    if (!db) {
        console.error("Database connection failed");
        process.exit(1);
    }
    const invalidStudios = await db.query.studios.findMany({
        where: isNull(studios.publicSlug)
    });

    console.log(`Found ${invalidStudios.length} studios with null slugs`);

    for (const studio of invalidStudios) {
        await db.update(studios)
            .set({ publicSlug: `studio-${uuid().split('-')[0]}` })
            .where(eq(studios.id, studio.id));
        console.log(`Fixed studio ${studio.id}`);
    }

    console.log('Done!');
    process.exit(0);
}

fixSlugs().catch(console.error);
