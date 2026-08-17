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

  // ── Supplier Checkout Migration ──────────────────────────────
  try {
    // Add currency column to suppliers (idempotent)
    await pool.query(`
      ALTER TABLE \`suppliers\` ADD COLUMN IF NOT EXISTS \`currency\` varchar(10) DEFAULT 'AUD'
    `).catch(() => {});

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`supplierOrders\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`artistId\` varchar(64) NOT NULL,
        \`supplierId\` int NOT NULL,
        \`subtotalCents\` int NOT NULL DEFAULT 0,
        \`platformFeeCents\` int NOT NULL DEFAULT 0,
        \`shippingCents\` int NOT NULL DEFAULT 0,
        \`totalCents\` int NOT NULL DEFAULT 0,
        \`currency\` varchar(10) NOT NULL DEFAULT 'AUD',
        \`status\` varchar(32) NOT NULL DEFAULT 'pending',
        \`stripePaymentIntentId\` varchar(255),
        \`stripeCheckoutSessionId\` varchar(255),
        \`shopifyDraftOrderId\` varchar(255),
        \`shopifyDraftOrderName\` varchar(255),
        \`shippingAddress\` text,
        \`shippingName\` varchar(255),
        \`createdAt\` timestamp DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT \`supplierOrders_id\` PRIMARY KEY(\`id\`),
        KEY \`so_artist_idx\` (\`artistId\`),
        KEY \`so_supplier_idx\` (\`supplierId\`)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`supplierOrderItems\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`orderId\` int NOT NULL,
        \`supplierProductId\` int,
        \`variantId\` int,
        \`productTitle\` varchar(255) NOT NULL,
        \`variantTitle\` varchar(255),
        \`quantity\` int NOT NULL DEFAULT 1,
        \`priceCents\` int NOT NULL DEFAULT 0,
        \`shopifyVariantId\` varchar(255),
        CONSTRAINT \`supplierOrderItems_id\` PRIMARY KEY(\`id\`),
        KEY \`soi_order_idx\` (\`orderId\`)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`supplierShippingZones\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`supplierId\` int NOT NULL,
        \`name\` varchar(255) NOT NULL,
        \`countryCodes\` text,
        CONSTRAINT \`supplierShippingZones_id\` PRIMARY KEY(\`id\`),
        KEY \`ssz_supplier_idx\` (\`supplierId\`)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`supplierShippingRates\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`zoneId\` int NOT NULL,
        \`name\` varchar(255) NOT NULL,
        \`priceCents\` int NOT NULL DEFAULT 0,
        \`currency\` varchar(10) DEFAULT 'AUD',
        \`minOrderSubtotalCents\` int,
        \`maxOrderSubtotalCents\` int,
        CONSTRAINT \`supplierShippingRates_id\` PRIMARY KEY(\`id\`),
        KEY \`ssr_zone_idx\` (\`zoneId\`)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`exchangeRateCache\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`fromCurrency\` varchar(10) NOT NULL,
        \`toCurrency\` varchar(10) NOT NULL,
        \`rate\` double NOT NULL,
        \`fetchedAt\` timestamp DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT \`exchangeRateCache_id\` PRIMARY KEY(\`id\`),
        UNIQUE KEY \`erc_pair_idx\` (\`fromCurrency\`, \`toCurrency\`)
      )
    `);

    // Add stripeCustomerId to artistSettings (idempotent)
    await pool.query(`
      ALTER TABLE \`artistSettings\` ADD COLUMN IF NOT EXISTS \`stripeCustomerId\` varchar(255)
    `).catch(() => {});

    console.log("[Database] ✅ supplier checkout tables migrated");
  } catch (e: any) {
    console.warn("[Database] ⚠️ supplier checkout migration:", e.message);
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
