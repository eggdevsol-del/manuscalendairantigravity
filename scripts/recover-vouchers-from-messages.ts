import mysql from 'mysql2/promise';
import 'dotenv/config';

async function main() {
    if (!process.env.DATABASE_URL) {
        console.error('DATABASE_URL not found');
        process.exit(1);
    }

    const connection = await mysql.createConnection(process.env.DATABASE_URL);
    console.log('Connected to database');

    // Search for messages containing voucher/promotion info
    const [rows]: any = await connection.execute(`
    SELECT content, metadata, createdAt 
    FROM messages 
    WHERE content LIKE '%voucher%' 
       OR content LIKE '%promotion%' 
       OR content LIKE '%discount%'
       OR messageType = 'promotion'
    ORDER BY createdAt DESC
  `);

    console.log(`Found ${rows.length} relevant messages`);

    for (const row of rows) {
        console.log('---');
        console.log(`Date: ${row.createdAt}`);
        console.log(`Content: ${row.content}`);
        if (row.metadata) {
            console.log(`Metadata: ${row.metadata}`);
        }
    }

    await connection.end();
}

main().catch(console.error);
