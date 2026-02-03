
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function applyMigration() {
    let databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        console.error('DATABASE_URL not set');
        process.exit(1);
    }

    // Use createPool to match application behavior
    const pool = mysql.createPool({
        uri: databaseUrl,
        waitForConnections: true,
        connectionLimit: 1,
        queueLimit: 0
    });

    // Test connection
    const connection = await pool.getConnection();
    console.log("Connected via pool successfully.");

    const drizzleDir = path.resolve(__dirname, '../../drizzle');
    if (!fs.existsSync(drizzleDir)) {
        console.error(`Drizzle directory not found: ${drizzleDir}`);
        process.exit(1);
    }

    const migrationFiles = fs.readdirSync(drizzleDir)
        .filter(file => file.endsWith('.sql'))
        .sort(); // Ensure order by filename (0000, 0001, etc.)

    // console.log(`Found ${migrationFiles.length} migration files in ${drizzleDir}`);
    // Reuse the connection we got from the pool

    try {
        for (const file of migrationFiles) {
            console.log(`Processing ${file}...`);
            const filePath = path.join(drizzleDir, file);
            const sqlContent = fs.readFileSync(filePath, 'utf-8');
            const statements = sqlContent.includes('--> statement-breakpoint')
                ? sqlContent.split('--> statement-breakpoint')
                : sqlContent.split(';');

            for (const statement of statements) {
                const trimmed = statement.trim();
                if (trimmed.length > 0 && !trimmed.startsWith('--')) {
                    try {
                        await connection.query(trimmed);
                    } catch (e: any) {
                        if (
                            e.message.includes("already exists") ||
                            e.message.includes("Duplicate column") ||
                            e.code === 'ER_DUP_FIELDNAME' ||
                            e.code === 'ER_TABLE_EXISTS_ERROR' ||
                            e.code === 'ER_DUP_KEYNAME'
                        ) {
                            // Valid skip
                        } else {
                            console.error(`  Error in ${file}: ${e.message}`);
                        }
                    }
                }
            }
        }
        console.log('All migrations processed successfully.');
    } catch (error) {
        console.error('Fatal error during migration:', error);
        process.exit(1);
    } finally {
        connection.release();
        await pool.end();
    }
}

applyMigration();
