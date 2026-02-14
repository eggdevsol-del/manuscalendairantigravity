import mysql from 'mysql2/promise';
import 'dotenv/config';

async function main() {
    if (!process.env.DATABASE_URL) {
        console.error('DATABASE_URL not found');
        process.exit(1);
    }

    const connection = await mysql.createConnection(process.env.DATABASE_URL);
    console.log('Connected to database');

    const migrations = [
        { from: 'promotion_templates_backup', to: 'promotion_templates' },
        { from: 'issued_promotions_backup', to: 'issued_promotions' },
        { from: 'consultations_backup', to: 'consultations' },
        { from: 'active_tasks_backup', to: 'active_tasks' }
    ];

    for (const m of migrations) {
        try {
            console.log(`Migrating data from ${m.from} to ${m.to}...`);
            // Use INSERT IGNORE to prevent duplicates if any data was already added
            await connection.execute(`INSERT IGNORE INTO \`${m.to}\` SELECT * FROM \`${m.from}\``);
            const [rows]: any = await connection.execute(`SELECT COUNT(*) as count FROM \`${m.to}\``);
            console.log(`Success: ${rows[0].count} rows now in ${m.to}`);
        } catch (e: any) {
            console.log(`Failed for ${m.to}: ${e.message}`);
        }
    }

    await connection.end();
}

main().catch(console.error);
