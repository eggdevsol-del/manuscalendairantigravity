/**
 * Build-time migration: Add notification & automation columns to artistSettings.
 * 
 * Runs during `pnpm build` on Railway (before the new server starts).
 * Idempotent — silently skips columns that already exist.
 */
import "dotenv/config";
import mysql from "mysql2/promise";

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.log("[Migration] DATABASE_URL not set — skipping (local dev without DB)");
    process.exit(0);
  }

  console.log("[Migration] Connecting to database...");
  const connection = await mysql.createConnection(DATABASE_URL);

  const alterations = [
    {
      name: "notification_mode",
      sql: "ALTER TABLE `artistSettings` ADD COLUMN `notification_mode` ENUM('manual','automatic') DEFAULT 'manual'",
    },
    {
      name: "googlePlaceId",
      sql: "ALTER TABLE `artistSettings` ADD COLUMN `googlePlaceId` VARCHAR(255) DEFAULT NULL",
    },
    {
      name: "quietHoursEnabled",
      sql: "ALTER TABLE `artistSettings` ADD COLUMN `quietHoursEnabled` TINYINT DEFAULT 0",
    },
    {
      name: "quietHoursStart",
      sql: "ALTER TABLE `artistSettings` ADD COLUMN `quietHoursStart` INT DEFAULT 21",
    },
    {
      name: "quietHoursEnd",
      sql: "ALTER TABLE `artistSettings` ADD COLUMN `quietHoursEnd` INT DEFAULT 7",
    },
  ];

  for (const alt of alterations) {
    try {
      await connection.query(alt.sql);
      console.log(`[Migration] ✅ Added column: ${alt.name}`);
    } catch (e: any) {
      if (e.code === "ER_DUP_FIELDNAME") {
        console.log(`[Migration] ⏭️  Column already exists: ${alt.name}`);
      } else {
        console.error(`[Migration] ❌ Failed to add ${alt.name}:`, e.message);
        // Don't exit — try remaining columns
      }
    }
  }

  await connection.end();
  console.log("[Migration] Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[Migration] Fatal error:", err.message);
  process.exit(1);
});
