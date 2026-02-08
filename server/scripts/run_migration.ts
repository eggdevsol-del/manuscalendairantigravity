
import 'dotenv/config';
import mysql from 'mysql2/promise';

async function runMigration() {
    console.log('Connecting to Railway database...');

    const conn = await mysql.createConnection({
        uri: process.env.DATABASE_URL,
    });

    console.log('Connected! Running migrations...\n');

    const migrations = [
        {
            name: 'Add originalAmount to promotion_redemptions',
            sql: `ALTER TABLE promotion_redemptions ADD COLUMN IF NOT EXISTS originalAmount int NOT NULL DEFAULT 0`
        },
        {
            name: 'Add finalAmount to promotion_redemptions',
            sql: `ALTER TABLE promotion_redemptions ADD COLUMN IF NOT EXISTS finalAmount int NOT NULL DEFAULT 0`
        },
        {
            name: 'Create pushSubscriptions table',
            sql: `CREATE TABLE IF NOT EXISTS pushSubscriptions (
        id int NOT NULL AUTO_INCREMENT,
        userId varchar(64) NOT NULL,
        endpoint varchar(500) NOT NULL,
        \`keys\` text NOT NULL,
        userAgent varchar(255) DEFAULT NULL,
        createdAt timestamp DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY user_id_idx (userId)
      )`
        }
    ];

    for (const migration of migrations) {
        try {
            console.log(`Running: ${migration.name}...`);
            await conn.execute(migration.sql);
            console.log(`  ✓ Success\n`);
        } catch (err: any) {
            if (err.code === 'ER_DUP_FIELDNAME' || err.code === 'ER_TABLE_EXISTS_ERROR') {
                console.log(`  ⊘ Already exists, skipping\n`);
            } else {
                console.error(`  ✗ Error: ${err.message}\n`);
            }
        }
    }

    // Check if push_subscriptions exists and migrate data
    try {
        const [tables] = await conn.query(`SHOW TABLES LIKE 'push_subscriptions'`);
        if (Array.isArray(tables) && tables.length > 0) {
            console.log('Found old push_subscriptions table, migrating data...');
            await conn.execute(`INSERT IGNORE INTO pushSubscriptions SELECT * FROM push_subscriptions`);
            await conn.execute(`DROP TABLE push_subscriptions`);
            console.log('  ✓ Migrated and dropped old table\n');
        }
    } catch (err: any) {
        console.log(`  Note: ${err.message}\n`);
    }

    console.log('Migration complete! Verifying schema...\n');

    // Verify tables
    const [convCols] = await conn.query(`SHOW COLUMNS FROM conversations LIKE 'leadId'`);
    const [consCols] = await conn.query(`SHOW COLUMNS FROM consultations LIKE 'leadId'`);

    console.log(`conversations.leadId: ${Array.isArray(convCols) && convCols.length > 0 ? '✓' : '✗'}`);
    console.log(`consultations.leadId: ${Array.isArray(consCols) && consCols.length > 0 ? '✓' : '✗'}`);

    await conn.end();
    console.log('\nDone! You can now restart your app.');
}

runMigration().catch(console.error);
