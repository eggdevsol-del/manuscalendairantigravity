import { getDb } from './server/services/core';
import { notificationOutbox } from './drizzle/schema';
import { desc } from 'drizzle-orm';

async function checkOutbox() {
    const db = await getDb();
    if (!db) {
        console.error('Cannot connect to DB');
        process.exit(1);
    }

    console.log('--- Last 10 Notification Outbox Entries ---');
    const entries = await db.select()
        .from(notificationOutbox)
        .orderBy(desc(notificationOutbox.createdAt))
        .limit(10);

    for (const e of entries) {
        console.log(`ID: ${e.id} | Type: ${e.eventType} | Status: ${e.status} | Attempts: ${e.attemptCount} | Created: ${e.createdAt}`);
        console.log(`Payload: ${e.payloadJson}`);
        if (e.lastError) console.log(`Error: ${e.lastError}`);
        console.log('-'.repeat(50));
    }

    process.exit(0);
}

checkOutbox().catch(console.error);
