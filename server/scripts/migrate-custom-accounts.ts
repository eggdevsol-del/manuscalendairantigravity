/**
 * One-off migration: Add 'custom' to stripe_connect_account_type enum.
 *
 * Run: npx tsx server/scripts/migrate-custom-accounts.ts
 *
 * Idempotent — safe to run multiple times.
 */

import "dotenv/config";
import mysql from "mysql2/promise";

async function migrate() {
    const DATABASE_URL = process.env.DATABASE_URL;
    if (!DATABASE_URL) {
        console.error("[Migration] DATABASE_URL not set");
        process.exit(1);
    }

    const connection = await mysql.createConnection(DATABASE_URL);

    try {
        console.log("[Migration] Adding 'custom' to stripe_connect_account_type enum...");

        await connection.query(`
            ALTER TABLE \`artistSettings\`
            MODIFY COLUMN \`stripe_connect_account_type\`
            enum('standard','express','custom') DEFAULT 'standard'
        `);

        console.log("[Migration] ✓ Enum updated successfully.");
    } catch (error: any) {
        // If the column already has the enum value, MySQL may not error,
        // but handle gracefully regardless
        if (error.code === "ER_DUP_ENTRY" || error.message?.includes("already")) {
            console.log("[Migration] ✓ Enum already contains 'custom', skipping.");
        } else {
            console.error("[Migration] Error:", error.message);
            throw error;
        }
    } finally {
        await connection.end();
    }
}

migrate().catch((err) => {
    console.error("[Migration] Fatal error:", err);
    process.exit(1);
});
