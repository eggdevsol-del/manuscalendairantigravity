import mysql from 'mysql2/promise';
import 'dotenv/config';

async function main() {
    if (!process.env.DATABASE_URL) {
        console.error('DATABASE_URL not found');
        process.exit(1);
    }

    const connection = await mysql.createConnection(process.env.DATABASE_URL);
    console.log('Connected to database');

    const [tables]: any = await connection.execute('SHOW TABLES');
    console.log(`Found ${tables.length} tables`);

    for (const tableRow of tables) {
        const tableName = Object.values(tableRow)[0] as string;
        const [rows]: any = await connection.execute(`SELECT COUNT(*) as count FROM \`${tableName}\``);
        if (rows[0].count > 0) {
            console.log(`${tableName}: ${rows[0].count} rows`);
        } else {
            // Still log empty ones if they contain "promotion" or "voucher" or "backup"
            if (tableName.includes('promotion') || tableName.includes('voucher') || tableName.includes('backup')) {
                console.log(`${tableName}: 0 rows`);
            }
        }
    }

    await connection.end();
}

main().catch(console.error);
