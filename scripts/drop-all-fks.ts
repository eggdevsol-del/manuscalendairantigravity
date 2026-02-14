import mysql from 'mysql2/promise';
import 'dotenv/config';

async function main() {
    if (!process.env.DATABASE_URL) {
        console.error('DATABASE_URL not found');
        process.exit(1);
    }

    const connection = await mysql.createConnection(process.env.DATABASE_URL);
    console.log('Connected to database');

    const [rows]: any = await connection.execute(`
    SELECT TABLE_NAME, CONSTRAINT_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = (SELECT DATABASE())
    AND REFERENCED_TABLE_NAME IS NOT NULL
  `);

    console.log(`Found ${rows.length} foreign keys to drop.`);

    for (const row of rows) {
        try {
            console.log(`Dropping FK [${row.CONSTRAINT_NAME}] on table [${row.TABLE_NAME}]...`);
            await connection.execute(`ALTER TABLE \`${row.TABLE_NAME}\` DROP FOREIGN KEY \`${row.CONSTRAINT_NAME}\``);
            console.log('Success');
        } catch (e: any) {
            console.log(`Failed to drop ${row.CONSTRAINT_NAME}:`, e.message);
        }
    }

    console.log('All Foreign Keys dropped. Database is now in a "flat" state.');
    await connection.end();
}

main().catch(console.error);
