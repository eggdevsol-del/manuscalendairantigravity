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
    { name: "tags", sql: "ALTER TABLE `portfolios` ADD COLUMN `tags` TEXT DEFAULT NULL" },
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

  // ── Backfill tags from existing captions ──
  try {
    // Dynamic import to avoid issues if the module isn't available during initial build
    const { extractSmartTags } = await import("../server/config/tagConfig");
    
    const [rows] = await connection.query(
      "SELECT id, caption FROM portfolios WHERE caption IS NOT NULL AND (tags IS NULL OR tags = '')"
    ) as any;
    
    if (rows.length > 0) {
      console.log(`[Migration] Backfilling tags for ${rows.length} portfolio items...`);
      let updated = 0;
      for (const row of rows) {
        const extracted = extractSmartTags(row.caption);
        const allTags = [...extracted.styleTags, ...extracted.locationTags];
        if (allTags.length > 0) {
          await connection.query(
            "UPDATE portfolios SET tags = ? WHERE id = ?",
            [JSON.stringify(allTags), row.id]
          );
          updated++;
        }
      }
      console.log(`[Migration] ✅ Backfilled tags for ${updated} items`);
    } else {
      console.log("[Migration] ⏭️  No items need tag backfill");
    }
  } catch (e: any) {
    console.error("[Migration] ⚠️  Tag backfill skipped:", e.message);
  }

  // ── Payment Requests table ──────────────────────────────────
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`payment_requests\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`appointmentId\` int NOT NULL,
        \`artistId\` varchar(64) NOT NULL,
        \`clientId\` varchar(64) NOT NULL,
        \`amountCents\` int NOT NULL,
        \`status\` enum('pending','paid','expired','cancelled') NOT NULL DEFAULT 'pending',
        \`token\` varchar(255) NOT NULL,
        \`stripeCheckoutSessionId\` varchar(255),
        \`createdAt\` timestamp DEFAULT CURRENT_TIMESTAMP,
        \`expiresAt\` timestamp NULL,
        \`paidAt\` timestamp NULL,
        CONSTRAINT \`payment_requests_id\` PRIMARY KEY(\`id\`),
        KEY \`pr_appointment_idx\` (\`appointmentId\`),
        KEY \`pr_artist_idx\` (\`artistId\`),
        KEY \`pr_client_idx\` (\`clientId\`),
        KEY \`pr_token_idx\` (\`token\`),
        KEY \`pr_status_idx\` (\`status\`)
      )
    `);
    console.log("[Migration] ✅ payment_requests table ensured");
  } catch (e: any) {
    console.error("[Migration] ⚠️  payment_requests creation:", e.message);
  }

  // ── Session Plans tables ─────────────────────────────────────
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`sessionPlans\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`artistId\` varchar(64) NOT NULL,
        \`clientId\` varchar(64) NOT NULL,
        \`conversationId\` int,
        \`status\` enum('pending','accepted','declined','withdrawn','refunded') NOT NULL DEFAULT 'pending',
        \`totalEstimateCents\` int NOT NULL,
        \`depositTotalCents\` int NOT NULL,
        \`platformFeeCents\` int DEFAULT 0,
        \`stripeSessionId\` varchar(255),
        \`messageId\` int,
        \`acceptedAt\` timestamp NULL,
        \`createdAt\` timestamp DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT \`sessionPlans_id\` PRIMARY KEY(\`id\`),
        FOREIGN KEY (\`artistId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE,
        FOREIGN KEY (\`clientId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE,
        FOREIGN KEY (\`conversationId\`) REFERENCES \`conversations\`(\`id\`) ON DELETE CASCADE
      )
    `);
    console.log("[Migration] ✅ sessionPlans table ensured");
  } catch (e: any) {
    if (e.code !== "ER_TABLE_EXISTS_ERROR") console.error("[Migration] ⚠️  sessionPlans:", e.message);
    else console.log("[Migration] ⏭️  Table already exists: sessionPlans");
  }

  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`sessionPlanItems\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`sessionPlanId\` int NOT NULL,
        \`sessionIndex\` int NOT NULL,
        \`startsAt\` datetime NOT NULL,
        \`durationMinutes\` int NOT NULL,
        \`estimateCents\` int NOT NULL,
        \`depositCents\` int NOT NULL,
        \`appointmentId\` int,
        \`createdAt\` timestamp DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT \`sessionPlanItems_id\` PRIMARY KEY(\`id\`),
        FOREIGN KEY (\`sessionPlanId\`) REFERENCES \`sessionPlans\`(\`id\`) ON DELETE CASCADE,
        FOREIGN KEY (\`appointmentId\`) REFERENCES \`appointments\`(\`id\`) ON DELETE SET NULL
      )
    `);
    console.log("[Migration] ✅ sessionPlanItems table ensured");
  } catch (e: any) {
    if (e.code !== "ER_TABLE_EXISTS_ERROR") console.error("[Migration] ⚠️  sessionPlanItems:", e.message);
    else console.log("[Migration] ⏭️  Table already exists: sessionPlanItems");
  }

  // ── Aftercare Templates tables ──────────────────────────────
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`aftercareTemplates\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`artistId\` varchar(64) NOT NULL,
        \`name\` varchar(255) NOT NULL DEFAULT 'Default',
        \`totalDays\` int NOT NULL DEFAULT 42,
        \`isDefault\` tinyint DEFAULT 1,
        \`createdAt\` timestamp DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT \`aftercareTemplates_id\` PRIMARY KEY(\`id\`),
        FOREIGN KEY (\`artistId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
      )
    `);
    console.log("[Migration] ✅ aftercareTemplates table ensured");
  } catch (e: any) {
    if (e.code !== "ER_TABLE_EXISTS_ERROR") console.error("[Migration] ⚠️  aftercareTemplates:", e.message);
    else console.log("[Migration] ⏭️  Table already exists: aftercareTemplates");
  }

  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`aftercarePhases\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`templateId\` int NOT NULL,
        \`fromDay\` int NOT NULL,
        \`toDay\` int NOT NULL,
        \`label\` varchar(100) NOT NULL,
        \`instruction\` text NOT NULL,
        \`sortOrder\` int DEFAULT 0,
        CONSTRAINT \`aftercarePhases_id\` PRIMARY KEY(\`id\`),
        FOREIGN KEY (\`templateId\`) REFERENCES \`aftercareTemplates\`(\`id\`) ON DELETE CASCADE
      )
    `);
    console.log("[Migration] ✅ aftercarePhases table ensured");
  } catch (e: any) {
    if (e.code !== "ER_TABLE_EXISTS_ERROR") console.error("[Migration] ⚠️  aftercarePhases:", e.message);
    else console.log("[Migration] ⏭️  Table already exists: aftercarePhases");
  }

  // ── New appointment columns for session plan linking ────────
  const appointmentCols = [
    { name: "projectName", sql: "ALTER TABLE `appointments` ADD COLUMN `projectName` VARCHAR(255) DEFAULT NULL" },
    { name: "sessionIndex", sql: "ALTER TABLE `appointments` ADD COLUMN `sessionIndex` INT DEFAULT NULL" },
    { name: "sessionTotal", sql: "ALTER TABLE `appointments` ADD COLUMN `sessionTotal` INT DEFAULT NULL" },
    { name: "sessionPlanId", sql: "ALTER TABLE `appointments` ADD COLUMN `sessionPlanId` INT DEFAULT NULL" },
    { name: "completedAt", sql: "ALTER TABLE `appointments` ADD COLUMN `completedAt` TIMESTAMP NULL DEFAULT NULL" },
    { name: "aftercareTemplateId", sql: "ALTER TABLE `appointments` ADD COLUMN `aftercareTemplateId` INT DEFAULT NULL" },
  ];

  for (const alt of appointmentCols) {
    try {
      await connection.query(alt.sql);
      console.log(`[Migration] ✅ Added appointment column: ${alt.name}`);
    } catch (e: any) {
      if (e.code === "ER_DUP_FIELDNAME") {
        console.log(`[Migration] ⏭️  Appointment column already exists: ${alt.name}`);
      } else {
        console.error(`[Migration] ❌ Failed to add appointment column ${alt.name}:`, e.message);
      }
    }
  }

  // ── Update messages messageType enum ────────────────────────
  try {
    await connection.query(`
      ALTER TABLE \`messages\` MODIFY COLUMN \`messageType\` ENUM(
        'text','system','appointment_request','appointment_confirmed',
        'image','video','studio_invite',
        'session_plan','session_plan_accepted','touchup_request','balance_paid',
        'studio_referral','settlement_received'
      ) NOT NULL DEFAULT 'text'
    `);
    console.log("[Migration] ✅ Updated messages.messageType enum");
  } catch (e: any) {
    console.error("[Migration] ⚠️  messages.messageType enum update:", e.message);
  }

  // ── Studio Tables ──────────────────────────────────────────
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`studios\` (
        \`id\` VARCHAR(64) PRIMARY KEY,
        \`name\` VARCHAR(255) NOT NULL,
        \`ownerId\` VARCHAR(64) NOT NULL,
        \`publicSlug\` VARCHAR(255) NOT NULL UNIQUE,
        \`brandLine\` VARCHAR(255) DEFAULT 'STUDIO BY THE DEPT OF TATTOO SERVICES',
        \`address\` TEXT,
        \`instagramHandle\` VARCHAR(100),
        \`stripeConnectAccountId\` VARCHAR(255),
        \`balanceCents\` INT NOT NULL DEFAULT 0,
        \`defaultCommission\` INT DEFAULT 30,
        \`defaultChairRentCents\` INT DEFAULT 35000,
        \`moneyPasscodeHash\` VARCHAR(255),
        \`autoBriefEnabled\` TINYINT DEFAULT 1,
        \`subscriptionTier\` VARCHAR(50) DEFAULT 'studio',
        \`createdAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (\`ownerId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
      )
    `);
    console.log("[Migration] ✅ Created table: studios");
  } catch (e: any) {
    console.error("[Migration] ⚠️  studios table:", e.message);
  }

  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`studio_members\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`studioId\` VARCHAR(64) NOT NULL,
        \`userId\` VARCHAR(64) NOT NULL,
        \`role\` ENUM('owner', 'manager', 'artist', 'apprentice') NOT NULL DEFAULT 'artist',
        \`paymentModel\` ENUM('commission', 'rent', 'dynamic', 'none') NOT NULL DEFAULT 'commission',
        \`commissionPct\` INT DEFAULT 30,
        \`weeklyChairRentCents\` INT DEFAULT 35000,
        \`dynamicStartingPct\` INT DEFAULT 35,
        \`status\` ENUM('active', 'pending_invite', 'declined', 'removed') NOT NULL DEFAULT 'active',
        \`inviteEmail\` VARCHAR(255),
        \`inviteToken\` VARCHAR(255),
        \`inviteSentAt\` TIMESTAMP NULL,
        \`joinedAt\` TIMESTAMP NULL,
        \`createdAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY \`unique_studio_member\` (\`studioId\`, \`userId\`),
        FOREIGN KEY (\`studioId\`) REFERENCES \`studios\`(\`id\`) ON DELETE CASCADE,
        FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
      )
    `);
    console.log("[Migration] ✅ Created table: studio_members");
  } catch (e: any) {
    console.error("[Migration] ⚠️  studio_members table:", e.message);
  }

  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`studio_transactions\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`studioId\` VARCHAR(64) NOT NULL,
        \`artistId\` VARCHAR(64) NULL,
        \`type\` ENUM('artist_settlement_credit', 'studio_withdrawal_debit', 'refund_clawback_debit', 'adjustment') NOT NULL,
        \`amountCents\` INT NOT NULL,
        \`grossAmountCents\` INT NULL,
        \`stripeFeeCents\` INT DEFAULT 0,
        \`platformFeeCents\` INT DEFAULT 0,
        \`netAmountCents\` INT NOT NULL,
        \`paymentModel\` VARCHAR(50),
        \`payoutSchedule\` VARCHAR(20),
        \`stripeTransferId\` VARCHAR(255),
        \`stripePayoutId\` VARCHAR(255),
        \`description\` TEXT,
        \`createdAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (\`studioId\`) REFERENCES \`studios\`(\`id\`) ON DELETE CASCADE,
        FOREIGN KEY (\`artistId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL
      )
    `);
    console.log("[Migration] ✅ Created table: studio_transactions");
  } catch (e: any) {
    console.error("[Migration] ⚠️  studio_transactions table:", e.message);
  }

  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`studio_arrears\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`studioId\` VARCHAR(64) NOT NULL,
        \`artistId\` VARCHAR(64) NOT NULL,
        \`amountCents\` INT NOT NULL,
        \`reason\` VARCHAR(255) NOT NULL,
        \`status\` ENUM('pending', 'deducted', 'waived') NOT NULL DEFAULT 'pending',
        \`deductedTransactionId\` INT NULL,
        \`createdAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`resolvedAt\` TIMESTAMP NULL,
        FOREIGN KEY (\`studioId\`) REFERENCES \`studios\`(\`id\`) ON DELETE CASCADE,
        FOREIGN KEY (\`artistId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
      )
    `);
    console.log("[Migration] ✅ Created table: studio_arrears");
  } catch (e: any) {
    console.error("[Migration] ⚠️  studio_arrears table:", e.message);
  }

  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`rcti_invoices\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`invoiceNumber\` VARCHAR(50) NOT NULL UNIQUE,
        \`studioId\` VARCHAR(64) NOT NULL,
        \`artistId\` VARCHAR(64) NOT NULL,
        \`periodStart\` DATETIME NOT NULL,
        \`periodEnd\` DATETIME NOT NULL,
        \`grossAmountCents\` INT NOT NULL,
        \`gstAmountCents\` INT NOT NULL DEFAULT 0,
        \`settlementAmountCents\` INT NOT NULL,
        \`paymentModel\` VARCHAR(50) NOT NULL,
        \`pdfUrl\` TEXT,
        \`createdAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (\`studioId\`) REFERENCES \`studios\`(\`id\`) ON DELETE CASCADE,
        FOREIGN KEY (\`artistId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
      )
    `);
    console.log("[Migration] ✅ Created table: rcti_invoices");
  } catch (e: any) {
    console.error("[Migration] ⚠️  rcti_invoices table:", e.message);
  }

  // ── Sync studio_members columns and enums ────────────────────
  const studioMemberAlterations = [
    { name: "role enum", sql: "ALTER TABLE `studio_members` MODIFY COLUMN `role` ENUM('owner', 'manager', 'artist', 'apprentice') NOT NULL DEFAULT 'artist'" },
    { name: "paymentModel enum", sql: "ALTER TABLE `studio_members` MODIFY COLUMN `paymentModel` ENUM('commission', 'rent', 'dynamic', 'none') NOT NULL DEFAULT 'commission'" },
    { name: "status enum", sql: "ALTER TABLE `studio_members` MODIFY COLUMN `status` ENUM('active', 'pending_invite', 'declined', 'removed') NOT NULL DEFAULT 'active'" },
    { name: "commissionPct", sql: "ALTER TABLE `studio_members` ADD COLUMN `commissionPct` INT DEFAULT 30" },
    { name: "weeklyChairRentCents", sql: "ALTER TABLE `studio_members` ADD COLUMN `weeklyChairRentCents` INT DEFAULT 35000" },
    { name: "dynamicStartingPct", sql: "ALTER TABLE `studio_members` ADD COLUMN `dynamicStartingPct` INT DEFAULT 35" },
    { name: "inviteEmail", sql: "ALTER TABLE `studio_members` ADD COLUMN `inviteEmail` VARCHAR(255) DEFAULT NULL" },
    { name: "inviteToken", sql: "ALTER TABLE `studio_members` ADD COLUMN `inviteToken` VARCHAR(255) DEFAULT NULL" },
    { name: "inviteSentAt", sql: "ALTER TABLE `studio_members` ADD COLUMN `inviteSentAt` TIMESTAMP NULL DEFAULT NULL" },
    { name: "joinedAt", sql: "ALTER TABLE `studio_members` ADD COLUMN `joinedAt` TIMESTAMP NULL DEFAULT NULL" },
  ];

  for (const alt of studioMemberAlterations) {
    try {
      await connection.query(alt.sql);
      console.log(`[Migration] ✅ Synced studio_members: ${alt.name}`);
    } catch (e: any) {
      if (e.code === "ER_DUP_FIELDNAME") {
        console.log(`[Migration] ⏭️  studio_members column already exists: ${alt.name}`);
      } else {
        console.log(`[Migration] ℹ️  studio_members ${alt.name}:`, e.message);
      }
    }
  }

  // ── Sync studios columns ────────────────────────────────────
  const studiosAlterations = [
    { name: "brandLine", sql: "ALTER TABLE `studios` ADD COLUMN `brandLine` VARCHAR(255) DEFAULT 'STUDIO BY THE DEPT OF TATTOO SERVICES'" },
    { name: "address", sql: "ALTER TABLE `studios` ADD COLUMN `address` TEXT DEFAULT NULL" },
    { name: "instagramHandle", sql: "ALTER TABLE `studios` ADD COLUMN `instagramHandle` VARCHAR(100) DEFAULT NULL" },
    { name: "stripeConnectAccountId", sql: "ALTER TABLE `studios` ADD COLUMN `stripeConnectAccountId` VARCHAR(255) DEFAULT NULL" },
    { name: "balanceCents", sql: "ALTER TABLE `studios` ADD COLUMN `balanceCents` INT NOT NULL DEFAULT 0" },
    { name: "defaultCommission", sql: "ALTER TABLE `studios` ADD COLUMN `defaultCommission` INT DEFAULT 30" },
    { name: "defaultChairRentCents", sql: "ALTER TABLE `studios` ADD COLUMN `defaultChairRentCents` INT DEFAULT 35000" },
    { name: "moneyPasscodeHash", sql: "ALTER TABLE `studios` ADD COLUMN `moneyPasscodeHash` VARCHAR(255) DEFAULT NULL" },
    { name: "autoBriefEnabled", sql: "ALTER TABLE `studios` ADD COLUMN `autoBriefEnabled` TINYINT DEFAULT 1" },
    { name: "subscriptionTier", sql: "ALTER TABLE `studios` ADD COLUMN `subscriptionTier` VARCHAR(50) DEFAULT 'studio'" },
  ];

  for (const alt of studiosAlterations) {
    try {
      await connection.query(alt.sql);
      console.log(`[Migration] ✅ Synced studios: ${alt.name}`);
    } catch (e: any) {
      if (e.code === "ER_DUP_FIELDNAME") {
        console.log(`[Migration] ⏭️  studios column already exists: ${alt.name}`);
      } else {
        console.log(`[Migration] ℹ️  studios ${alt.name}:`, e.message);
      }
    }
  }

  // ── Appointment isStudioReferral column ─────────────────────
  try {
    await connection.query("ALTER TABLE `appointments` ADD COLUMN `isStudioReferral` TINYINT DEFAULT 0");
    console.log("[Migration] ✅ Added column: appointments.isStudioReferral");
  } catch (e: any) {
    if (e.code === "ER_DUP_FIELDNAME") {
      console.log("[Migration] ⏭️  Column already exists: appointments.isStudioReferral");
    } else {
      console.error("[Migration] ❌ Failed to add appointments.isStudioReferral:", e.message);
    }
  }

  // ── Seed default aftercare template for existing artists ────
  try {
    const [artists] = await connection.query(
      "SELECT DISTINCT a.userId FROM artistSettings a LEFT JOIN aftercareTemplates t ON a.userId = t.artistId WHERE t.id IS NULL"
    ) as any;

    if (artists.length > 0) {
      console.log(`[Migration] Seeding aftercare templates for ${artists.length} artists...`);
      const defaultPhases = [
        { fromDay: 1, toDay: 2, label: "Initial care", instruction: "Keep the wrap on 4 hours. Wash with unscented soap, pat dry, no cream yet.", sortOrder: 0 },
        { fromDay: 3, toDay: 6, label: "Healing", instruction: "Thin layer of ointment twice daily. Expect plasma and tightness — do not pick.", sortOrder: 1 },
        { fromDay: 7, toDay: 14, label: "Peeling", instruction: "Peeling and itch. Switch to fragrance-free moisturiser. No pools, saunas or gym chalk.", sortOrder: 2 },
        { fromDay: 15, toDay: 28, label: "Settling", instruction: "Milky, cloudy look is normal — the top layer is still settling. Moisturise once daily.", sortOrder: 3 },
        { fromDay: 29, toDay: 42, label: "Healed", instruction: "Colour clears. SPF 50 on it any time it's in the sun, permanently.", sortOrder: 4 },
      ];

      for (const artist of artists) {
        const [result] = await connection.query(
          "INSERT INTO aftercareTemplates (artistId, name, totalDays, isDefault) VALUES (?, 'Default', 42, 1)",
          [artist.userId]
        ) as any;
        const templateId = result.insertId;

        for (const phase of defaultPhases) {
          await connection.query(
            "INSERT INTO aftercarePhases (templateId, fromDay, toDay, label, instruction, sortOrder) VALUES (?, ?, ?, ?, ?, ?)",
            [templateId, phase.fromDay, phase.toDay, phase.label, phase.instruction, phase.sortOrder]
          );
        }
      }
      console.log(`[Migration] ✅ Seeded aftercare templates for ${artists.length} artists`);
    } else {
      console.log("[Migration] ⏭️  All artists already have aftercare templates");
    }
  } catch (e: any) {
    console.error("[Migration] ⚠️  Aftercare seed:", e.message);
  }

  await connection.end();
  console.log("[Migration] Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[Migration] Fatal error:", err.message);
  process.exit(1);
});
