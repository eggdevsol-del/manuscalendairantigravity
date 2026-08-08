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
      }
    }
  }

  // ── Portfolio columns for Instagram import ──
  const portfolioAlterations = [
    { name: "source", sql: "ALTER TABLE `portfolios` ADD COLUMN `source` VARCHAR(20) DEFAULT 'upload'" },
    { name: "mediaType", sql: "ALTER TABLE `portfolios` ADD COLUMN `mediaType` VARCHAR(20) DEFAULT 'image'" },
    { name: "externalMediaId", sql: "ALTER TABLE `portfolios` ADD COLUMN `externalMediaId` VARCHAR(64) DEFAULT NULL" },
    { name: "externalPermalink", sql: "ALTER TABLE `portfolios` ADD COLUMN `externalPermalink` TEXT DEFAULT NULL" },
    { name: "cdnUrl", sql: "ALTER TABLE `portfolios` ADD COLUMN `cdnUrl` TEXT DEFAULT NULL" },
    { name: "cdnUrlExpiresAt", sql: "ALTER TABLE `portfolios` ADD COLUMN `cdnUrlExpiresAt` TIMESTAMP DEFAULT NULL" },
    { name: "thumbnailUrl", sql: "ALTER TABLE `portfolios` ADD COLUMN `thumbnailUrl` TEXT DEFAULT NULL" },
    { name: "caption", sql: "ALTER TABLE `portfolios` ADD COLUMN `caption` TEXT DEFAULT NULL" },
    { name: "publishedAt", sql: "ALTER TABLE `portfolios` ADD COLUMN `publishedAt` TIMESTAMP DEFAULT NULL" },
    { name: "availabilityState", sql: "ALTER TABLE `portfolios` ADD COLUMN `availabilityState` VARCHAR(20) DEFAULT 'available'" },
    { name: "importBatchId", sql: "ALTER TABLE `portfolios` ADD COLUMN `importBatchId` INT DEFAULT NULL" },
  ];

  for (const alt of portfolioAlterations) {
    try {
      await connection.query(alt.sql);
      console.log(`[Migration] ✅ Added portfolio column: ${alt.name}`);
    } catch (e: any) {
      if (e.code === "ER_DUP_FIELDNAME") {
        console.log(`[Migration] ⏭️  Portfolio column already exists: ${alt.name}`);
      } else {
        console.error(`[Migration] ❌ Failed to add portfolio column ${alt.name}:`, e.message);
      }
    }
  }

  // ── Create instagram_imports table ──
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`instagram_imports\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`artistId\` VARCHAR(64) NOT NULL,
        \`instagramUsername\` VARCHAR(100) NOT NULL,
        \`status\` VARCHAR(20) DEFAULT 'in_progress',
        \`totalDiscovered\` INT DEFAULT 0,
        \`totalProcessed\` INT DEFAULT 0,
        \`totalAdded\` INT DEFAULT 0,
        \`totalSkipped\` INT DEFAULT 0,
        \`totalFailed\` INT DEFAULT 0,
        \`lastSyncCursor\` TEXT,
        \`errorMessage\` TEXT,
        \`createdAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (\`artistId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
      )
    `);
    console.log("[Migration] ✅ Created table: instagram_imports");
  } catch (e: any) {
    if (e.code === "ER_TABLE_EXISTS_ERROR") {
      console.log("[Migration] ⏭️  Table already exists: instagram_imports");
    } else {
      console.error("[Migration] ❌ Failed to create instagram_imports:", e.message);
    }
  }

  // ── Create portfolio_classifications table ──
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`portfolio_classifications\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`portfolioItemId\` INT NOT NULL,
        \`category\` VARCHAR(30) NOT NULL,
        \`value\` VARCHAR(100) NOT NULL,
        \`confidence\` DECIMAL(3,2),
        \`source\` VARCHAR(20) DEFAULT 'ai',
        \`status\` VARCHAR(20) DEFAULT 'suggested',
        \`createdAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (\`portfolioItemId\`) REFERENCES \`portfolios\`(\`id\`) ON DELETE CASCADE
      )
    `);
    console.log("[Migration] ✅ Created table: portfolio_classifications");
  } catch (e: any) {
    if (e.code === "ER_TABLE_EXISTS_ERROR") {
      console.log("[Migration] ⏭️  Table already exists: portfolio_classifications");
    } else {
      console.error("[Migration] ❌ Failed to create portfolio_classifications:", e.message);
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
