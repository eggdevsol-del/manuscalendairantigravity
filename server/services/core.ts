import { drizzle, MySql2Database } from "drizzle-orm/mysql2";
import { ENV } from "../_core/env";
import * as schema from "../../drizzle/schema";
import mysql from "mysql2/promise";

let _db: MySql2Database<typeof schema> | null = null;
let _migrated = false;

async function ensureTables(pool: mysql.Pool) {
  if (_migrated) return;
  _migrated = true;
  try {
    // Drop first in case it was created with wrong column names
    // (previous schema used mysqlEnum("payment_request_status",...) which
    // created column 'payment_request_status' instead of 'status')
    await pool.query(`DROP TABLE IF EXISTS \`payment_requests\``);
    await pool.query(`
      CREATE TABLE \`payment_requests\` (
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
    console.log("[Database] ✅ payment_requests table created");
  } catch (e: any) {
    console.warn("[Database] ⚠️ payment_requests migration:", e.message);
  }
}

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      console.log("[Database] Initializing connection pool...");
      const pool = mysql.createPool({
        uri: process.env.DATABASE_URL,
        waitForConnections: true,
        connectionLimit: 15,
        queueLimit: 0,
      });
      _db = drizzle(pool, { mode: "default", schema });
      console.log("[Database] Pool initialized.");
      await ensureTables(pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
