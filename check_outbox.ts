import 'dotenv/config';
import { getDb } from './server/services/core';
import { notificationOutbox } from './drizzle/schema';
import { desc } from 'drizzle-orm';

import * as fs from 'fs';

async function checkOutbox() {
    const db = await getDb();
    if (!db) {
        console.error('Cannot connect to DB');
        process.exit(1);
    }

    const entries = await db.select()
        .from(notificationOutbox)
        .orderBy(desc(notificationOutbox.createdAt))
        .limit(10);

    fs.writeFileSync('outbox.json', JSON.stringify(entries, null, 2));
    console.log('Wrote to outbox.json');
    process.exit(0);
}

checkOutbox().catch(console.error);
