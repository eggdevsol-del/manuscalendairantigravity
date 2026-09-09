import "dotenv/config";
import mysql from "mysql2/promise";
import { is } from "drizzle-orm";
import { MySqlTable, getTableConfig } from "drizzle-orm/mysql-core";
import * as schema from "../../drizzle/schema";
const required = [
  "DATABASE_URL",
  "APP_URL",
  "JWT_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "EMAIL_FROM",
];
const missing = required.filter(key => !process.env[key]);
if (missing.length) {
  console.error("Missing configuration:", missing.join(", "));
  process.exit(1);
}
if (process.env.JWT_SECRET!.length < 32)
  throw new Error("JWT_SECRET must have at least 32 characters.");
if (new URL(process.env.APP_URL!).protocol !== "https:")
  throw new Error("APP_URL must use HTTPS.");
const paymentMode = process.env.STRIPE_SECRET_KEY!.startsWith("sk_test_")
  ? "test"
  : process.env.STRIPE_SECRET_KEY!.startsWith("sk_live_")
    ? "live"
    : "unknown";
console.log("Stripe configuration mode:", paymentMode);
if (process.env.REQUIRE_STRIPE_TEST_MODE === "true" && paymentMode !== "test")
  throw new Error("This test deployment requires a Stripe test-mode secret.");
const db = await mysql.createConnection(process.env.DATABASE_URL!);
try {
  const [columns] = await db.query<mysql.RowDataPacket[]>(
    "SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()"
  );
  const existing = new Set(
    columns.map(row => `${row.TABLE_NAME}.${row.COLUMN_NAME}`)
  );
  const absent: string[] = [];
  for (const value of Object.values(schema)) {
    if (!is(value, MySqlTable)) continue;
    const config = getTableConfig(value);
    for (const column of config.columns)
      if (!existing.has(`${config.name}.${column.name}`))
        absent.push(`${config.name}.${column.name}`);
  }
  if (absent.length) {
    console.error(
      "Missing database columns (no changes were made):\n" + absent.join("\n")
    );
    process.exitCode = 1;
  } else
    console.log(
      "All schema tables/columns are present. This check does not validate column types, constraints or external integrations."
    );
  const [fk] = await db.query<mysql.RowDataPacket[]>(
    "SELECT CONSTRAINT_NAME FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='procedure_logs' AND DELETE_RULE='CASCADE'"
  );
  if (fk.length) {
    console.error(
      "Procedure snapshots still have cascading foreign keys. Review migration 0024."
    );
    process.exitCode = 1;
  }
} finally {
  await db.end();
}
