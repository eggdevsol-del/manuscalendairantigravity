import "dotenv/config";
import { getDb } from "../services/core";
import { sql } from "drizzle-orm";

async function run() {
  const db = await getDb();
  if (!db) {
    console.error("Failed to connect to DB");
    process.exit(1);
  }

  try {
    console.log("Adding 'viewed' column to 'consultations' table...");
    await db.execute(sql`
            ALTER TABLE consultations 
            ADD COLUMN viewed TINYINT DEFAULT 0;
        `);
    console.log("Column added successfully or already exists.");
  } catch (error: any) {
    if (error.code === "ER_DUP_FIELDNAME") {
      console.log("Column 'viewed' already exists.");
    } else {
      console.error("Error updating schema:", error);
    }
  }

  process.exit(0);
}

run();
