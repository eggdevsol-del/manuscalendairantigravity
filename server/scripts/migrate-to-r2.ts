/**
 * migrate-to-r2.ts — One-time migration of MySQL file_storage → Cloudflare R2
 * ──────────────────────────────────────────────────────────────────────────────
 * 1. Reads all rows from `file_storage` table
 * 2. Uploads each file to R2 with the same key
 * 3. Updates all DB columns that reference `/api/files/...` to R2 CDN URLs
 * 4. Updates `/api/files/*` route to redirect to R2
 *
 * Run: npx tsx server/scripts/migrate-to-r2.ts
 */
import "dotenv/config";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import mysql from "mysql2/promise";

// ── R2 Client (inline to avoid import path issues in standalone script) ──
import { S3Client } from "@aws-sdk/client-s3";

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const BUCKET_NAME = process.env.R2_BUCKET_NAME!;
const PUBLIC_URL = process.env.R2_PUBLIC_URL!.replace(/\/$/, "");

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
});

// ── Database connection ─────────────────────────────────────────────────
async function getConnection() {
  const pool = mysql.createPool({
    uri: process.env.DATABASE_URL!,
    waitForConnections: true,
    connectionLimit: 5,
  });
  return pool;
}

// ── Step 1: Upload all files from MySQL to R2 ───────────────────────────
async function migrateFilesToR2(db: mysql.Pool) {
  console.log("\n═══ STEP 1: Migrating files from MySQL → R2 ═══\n");

  const [rows] = await db.execute(
    "SELECT file_key, file_data, mime_type FROM file_storage"
  );

  const files = rows as Array<{
    file_key: string;
    file_data: string;
    mime_type: string;
  }>;

  console.log(`Found ${files.length} files in file_storage table.\n`);

  let success = 0;
  let failed = 0;

  for (const file of files) {
    try {
      const buffer = Buffer.from(file.file_data, "base64");

      await r2.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: file.file_key,
          Body: buffer,
          ContentType: file.mime_type,
        })
      );

      success++;
      console.log(`  ✓ ${file.file_key} (${(buffer.length / 1024).toFixed(1)}KB)`);
    } catch (err: any) {
      failed++;
      console.error(`  ✗ ${file.file_key}: ${err.message}`);
    }
  }

  console.log(`\n  Upload complete: ${success} succeeded, ${failed} failed.\n`);
  return files.length;
}

// ── Step 2: Update simple string columns ────────────────────────────────
async function updateSimpleColumns(db: mysql.Pool) {
  console.log("═══ STEP 2: Updating DB references ═══\n");

  const oldPrefix = "/api/files/";
  const newPrefix = `${PUBLIC_URL}/`;

  // All simple string columns that store direct URLs
  const updates: Array<{ table: string; column: string; condition?: string }> = [
    { table: "users", column: "avatar" },
    { table: "portfolios", column: "imageUrl" },
    { table: "artistSettings", column: "funnelBannerUrl" },
    { table: "artist_public_profile", column: "profileImageUrl" },
    { table: "artist_public_profile", column: "coverImageUrl" },
    { table: "moodboard_items", column: "imageUrl" },
    { table: "products", column: "imageUrl" },
    { table: "productVariants", column: "imageUrl" },
    { table: "productImages", column: "imageUrl" },
    { table: "studios", column: "logoUrl" },
    { table: "promotion_templates", column: "logoUrl" },
    { table: "promotion_templates", column: "backgroundImageUrl" },
    { table: "suppliers", column: "logoUrl" },
    { table: "supplierProducts", column: "imageUrl" },
    { table: "appointments", column: "paymentProof" },
    { table: "leads", column: "depositProof" },
    // Image messages: content IS the URL when messageType = 'image'
    {
      table: "messages",
      column: "content",
      condition: "AND messageType = 'image'",
    },
  ];

  let totalUpdated = 0;

  for (const { table, column, condition } of updates) {
    try {
      const sql = `UPDATE \`${table}\` SET \`${column}\` = REPLACE(\`${column}\`, ?, ?) WHERE \`${column}\` LIKE ? ${condition || ""}`;
      const [result] = await db.execute(sql, [
        oldPrefix,
        newPrefix,
        `${oldPrefix}%`,
      ]);
      const affected = (result as any).affectedRows || 0;
      if (affected > 0) {
        console.log(`  ✓ ${table}.${column}: ${affected} rows updated`);
        totalUpdated += affected;
      } else {
        console.log(`  · ${table}.${column}: no rows to update`);
      }
    } catch (err: any) {
      // Table might not exist in this DB
      console.log(`  · ${table}.${column}: skipped (${err.message.slice(0, 60)})`);
    }
  }

  return totalUpdated;
}

// ── Step 3: Update JSON array columns ───────────────────────────────────
async function updateJsonColumns(db: mysql.Pool) {
  console.log("\n═══ STEP 3: Updating JSON array columns ═══\n");

  const oldPrefix = "/api/files/";
  const newPrefix = `${PUBLIC_URL}/`;
  let totalUpdated = 0;

  const jsonColumns = [
    { table: "leads", column: "referenceImages" },
    { table: "leads", column: "bodyPlacementImages" },
  ];

  for (const { table, column } of jsonColumns) {
    try {
      const [rows] = await db.execute(
        `SELECT id, \`${column}\` FROM \`${table}\` WHERE \`${column}\` LIKE ?`,
        [`%${oldPrefix}%`]
      );

      const records = rows as Array<{ id: string; [key: string]: string }>;

      if (records.length === 0) {
        console.log(`  · ${table}.${column}: no rows to update`);
        continue;
      }

      for (const record of records) {
        try {
          const raw = record[column];
          if (!raw) continue;

          const parsed = JSON.parse(raw);
          let updated = false;

          if (Array.isArray(parsed)) {
            for (let i = 0; i < parsed.length; i++) {
              if (typeof parsed[i] === "string" && parsed[i].startsWith(oldPrefix)) {
                parsed[i] = parsed[i].replace(oldPrefix, newPrefix);
                updated = true;
              }
            }
          }

          if (updated) {
            await db.execute(
              `UPDATE \`${table}\` SET \`${column}\` = ? WHERE id = ?`,
              [JSON.stringify(parsed), record.id]
            );
            totalUpdated++;
          }
        } catch {
          // Skip malformed JSON
        }
      }

      console.log(`  ✓ ${table}.${column}: ${records.length} rows processed`);
    } catch (err: any) {
      console.log(`  · ${table}.${column}: skipped (${err.message.slice(0, 60)})`);
    }
  }

  return totalUpdated;
}

// ── Step 4: Update client_content fileKey ────────────────────────────────
async function updateClientContent(db: mysql.Pool) {
  console.log("\n═══ STEP 4: Updating client_content fileKey → full R2 URL ═══\n");

  try {
    // client_content.fileKey stores just the key (no /api/files/ prefix)
    // We need to replace it with the full R2 URL
    const [rows] = await db.execute(
      "SELECT id, fileKey FROM client_content WHERE fileKey IS NOT NULL AND fileKey != ''"
    );

    const records = rows as Array<{ id: string; fileKey: string }>;

    if (records.length === 0) {
      console.log("  · No client_content rows to update");
      return 0;
    }

    let updated = 0;
    for (const record of records) {
      // Only update if it doesn't already look like a full URL
      if (!record.fileKey.startsWith("http")) {
        await db.execute(
          "UPDATE client_content SET fileKey = ? WHERE id = ?",
          [`${PUBLIC_URL}/${record.fileKey}`, record.id]
        );
        updated++;
      }
    }

    console.log(`  ✓ client_content.fileKey: ${updated} rows updated`);
    return updated;
  } catch (err: any) {
    console.log(`  · client_content: skipped (${err.message.slice(0, 60)})`);
    return 0;
  }
}

// ── Main ────────────────────────────────────────────────────────────────
async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║  d.o.t.s — MySQL → R2 Media Migration           ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  if (!process.env.DATABASE_URL) {
    console.error("ERROR: DATABASE_URL not set");
    process.exit(1);
  }
  if (!process.env.R2_ACCOUNT_ID) {
    console.error("ERROR: R2 env vars not set");
    process.exit(1);
  }

  console.log(`R2 Bucket:  ${BUCKET_NAME}`);
  console.log(`R2 CDN URL: ${PUBLIC_URL}`);
  console.log(`Database:   ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":***@")}\n`);

  const db = await getConnection();

  try {
    // Step 1: Upload files to R2
    const fileCount = await migrateFilesToR2(db);

    // Step 2: Update simple URL columns
    const simpleUpdated = await updateSimpleColumns(db);

    // Step 3: Update JSON array columns
    const jsonUpdated = await updateJsonColumns(db);

    // Step 4: Update client_content
    const contentUpdated = await updateClientContent(db);

    // Summary
    console.log("\n╔══════════════════════════════════════════════════╗");
    console.log("║  MIGRATION COMPLETE                              ║");
    console.log("╠══════════════════════════════════════════════════╣");
    console.log(`║  Files uploaded to R2:    ${String(fileCount).padStart(6)}                ║`);
    console.log(`║  Simple columns updated:  ${String(simpleUpdated).padStart(6)}                ║`);
    console.log(`║  JSON columns updated:    ${String(jsonUpdated).padStart(6)}                ║`);
    console.log(`║  Content keys updated:    ${String(contentUpdated).padStart(6)}                ║`);
    console.log("╚══════════════════════════════════════════════════╝\n");
    console.log("Next steps:");
    console.log("  1. Verify R2 URLs load in browser");
    console.log("  2. Deploy the updated /api/files/* redirect route");
    console.log("  3. After confirming, DROP TABLE file_storage to reclaim DB space\n");
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
