
import 'dotenv/config';
import mysql from 'mysql2/promise';

async function verifyAndFix() {
    console.log('Connecting to Railway database...');

    const conn = await mysql.createConnection({
        uri: process.env.DATABASE_URL,
    });

    console.log('Connected! Checking for missing columns...\n');

    // 1. Check conversations.leadId
    try {
        const [cols] = await conn.query("SHOW COLUMNS FROM conversations LIKE 'leadId'");
        console.log(`conversations.leadId exists: ${(cols as any).length > 0}`);

        if ((cols as any).length === 0) {
            console.log("Adding leadId to conversations...");
            await conn.query("ALTER TABLE conversations ADD COLUMN leadId int DEFAULT NULL");
            console.log("✓ Added leadId to conversations");
        }
    } catch (err: any) {
        console.error("Error checking conversations:", err.message);
    }

    // 2. Check consultations.leadId
    try {
        const [cols] = await conn.query("SHOW COLUMNS FROM consultations LIKE 'leadId'");
        console.log(`consultations.leadId exists: ${(cols as any).length > 0}`);

        if ((cols as any).length === 0) {
            console.log("Adding leadId to consultations...");
            await conn.query("ALTER TABLE consultations ADD COLUMN leadId int DEFAULT NULL");
            console.log("✓ Added leadId to consultations");
        }
    } catch (err: any) {
        console.error("Error checking consultations:", err.message);
    }

    await conn.end();
    console.log('\nFix complete!');
}

verifyAndFix().catch(console.error);
