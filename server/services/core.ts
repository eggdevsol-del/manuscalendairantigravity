import { drizzle, MySql2Database } from "drizzle-orm/mysql2";
import { ENV } from "../_core/env";
import * as schema from "../../drizzle/schema";
import mysql from "mysql2/promise";

let _db: MySql2Database<typeof schema> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      console.log("[Database] Initializing connection pool...");
      const pool = mysql.createPool({
        uri: process.env.DATABASE_URL,
        waitForConnections: true,
        connectionLimit: 5,
        queueLimit: 0,
      });
      _db = drizzle(pool, { mode: "default", schema });
      console.log("[Database] Pool initialized.");
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
