import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { migrate } from "drizzle-orm/mysql2/migrator";
import dotenv from "dotenv";

dotenv.config();

async function runMigrations() {
  console.log("Starting database migrations...");

  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  const db = drizzle(connection);

  try {
    await migrate(db, { migrationsFolder: "./drizzle/migrations" });
    console.log("Migrations completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runMigrations();
