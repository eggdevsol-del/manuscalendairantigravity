import { AsyncLocalStorage } from "node:async_hooks";
import { drizzle, MySql2Database } from "drizzle-orm/mysql2";
import { ENV } from "../_core/env";
import * as schema from "../../drizzle/schema";
import mysql from "mysql2/promise";

const transactionScope = new AsyncLocalStorage<MySql2Database<typeof schema>>();

let _db: MySql2Database<typeof schema> | null = null;
export async function getDb() {
  const current = transactionScope.getStore();
  if (current) return current;
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
      // Schema changes run only through explicit, versioned migrations.
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

/** Legacy service calls join the same transaction through async request context. */
export async function withDatabaseTransaction<T>(
  work: (db: MySql2Database<typeof schema>) => Promise<T>
): Promise<T> {
  const current = transactionScope.getStore();
  if (current) return work(current);
  const database = await getDb();
  if (!database) throw new Error("Database connection failed");
  return database.transaction(tx =>
    transactionScope.run(tx as unknown as MySql2Database<typeof schema>, () =>
      work(tx as unknown as MySql2Database<typeof schema>)
    )
  );
}

/** Roll back a failed job's database writes without losing its retry record. */
export async function withDatabaseSavepoint<T>(
  work: (db: MySql2Database<typeof schema>) => Promise<T>
): Promise<T> {
  const database = await getDb();
  if (!database) throw new Error("Database connection failed");
  return database.transaction(tx =>
    transactionScope.run(tx as unknown as MySql2Database<typeof schema>, () =>
      work(tx as unknown as MySql2Database<typeof schema>)
    )
  );
}
