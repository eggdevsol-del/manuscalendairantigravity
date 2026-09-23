// Read-only Railway pre-deploy gate; never applies migrations.
import mysql from "mysql2/promise";
import { is } from "drizzle-orm";
import { MySqlTable, getTableConfig } from "drizzle-orm/mysql-core";
import * as schema from "../../drizzle/schema";
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for the schema gate.");
const db = await mysql.createConnection(process.env.DATABASE_URL);
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
} finally {
  await db.end();
}
