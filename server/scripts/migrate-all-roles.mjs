// Explicit additive migration with targeted backups. Never runs on app startup.
import mysql from "mysql2/promise";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
if (!process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_"))
  throw new Error("Authorized test environment required.");
const apply = process.argv.includes("--apply");
const file = await readFile("drizzle/0026_stable_catalogue_ids.sql", "utf8");
const db = await mysql.createConnection(process.env.DATABASE_URL);
const tables = [
  "products",
  "productVariants",
  "orderItems",
  "orders",
  "studios",
  "__drizzle_migrations",
];
try {
  const [journal] = await db.query(
    "SELECT hash,created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1"
  );
  const hash = createHash("sha256").update(file).digest("hex");
  if (Number(journal[0]?.created_at) === 1788948000000) {
    if (journal[0].hash !== hash) throw new Error("Migration hash differs.");
    console.log("Migration 0026 already applied.");
  } else {
    if (Number(journal[0]?.created_at) !== 1788912000002)
      throw new Error("Expected audited migration 0025 baseline.");
    const [columns] = await db.query(
      "SELECT TABLE_NAME,COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()"
    );
    const have = new Set(columns.map(r => `${r.TABLE_NAME}.${r.COLUMN_NAME}`));
    const [indices] = await db.query(
      "SELECT TABLE_NAME,INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE()"
    );
    const indexes = new Set(
      indices.map(r => `${r.TABLE_NAME}.${r.INDEX_NAME}`)
    );
    const statements = file
      .split("--> statement-breakpoint")
      .map(q => q.trim())
      .filter(Boolean)
      .filter(q => {
        const column = q.match(/ALTER TABLE `([^`]+)` ADD `([^`]+)`/);
        if (column) return !have.has(`${column[1]}.${column[2]}`);
        const constraint = q.match(
          /ALTER TABLE `([^`]+)` ADD CONSTRAINT `([^`]+)`/
        );
        if (constraint)
          return !indexes.has(`${constraint[1]}.${constraint[2]}`);
        throw new Error("Unrecognized migration statement.");
      });
    console.log(
      "Migration 0026 pending additive statements:",
      statements.length
    );
    if (apply) {
      await db.query(
        "CREATE TABLE IF NOT EXISTS _tattoi_212_backup_manifest (tableName varchar(100) PRIMARY KEY,createSql longtext NOT NULL,backedUpAt timestamp DEFAULT CURRENT_TIMESTAMP)"
      );
      for (const table of tables) {
        const [record] = await db.query(
          "SELECT tableName FROM _tattoi_212_backup_manifest WHERE tableName=?",
          [table]
        );
        if (record.length) continue;
        const [count] = await db.query(`SELECT COUNT(*) n FROM \`${table}\``);
        if (count[0].n > 50000)
          throw new Error("Managed backup required for large table.");
        const [ddl] = await db.query(`SHOW CREATE TABLE \`${table}\``);
        await db.query(
          `CREATE TABLE IF NOT EXISTS \`_tattoi_212_backup_${table}\` LIKE \`${table}\``
        );
        await db.beginTransaction();
        try {
          await db.query(
            `INSERT IGNORE INTO \`_tattoi_212_backup_${table}\` SELECT * FROM \`${table}\``
          );
          const [saved] = await db.query(
            `SELECT COUNT(*) n FROM \`_tattoi_212_backup_${table}\``
          );
          if (saved[0].n !== count[0].n)
            throw new Error("Backup count mismatch.");
          await db.query(
            "INSERT INTO _tattoi_212_backup_manifest (tableName,createSql) VALUES (?,?)",
            [table, ddl[0]["Create Table"]]
          );
          await db.commit();
        } catch (error) {
          await db.rollback();
          throw error;
        }
      }
      for (const statement of statements) await db.query(statement);
      await db.query(
        "INSERT INTO __drizzle_migrations (hash,created_at) VALUES (?,?)",
        [hash, 1788948000000]
      );
      console.log(
        "PASS: migration 0026 applied; six table backups and original DDL retained in _tattoi_212_backup_*."
      );
    }
  }
} finally {
  await db.end();
}
