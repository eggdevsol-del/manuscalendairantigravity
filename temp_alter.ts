import { getDb } from "./server/db";
import { sql } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("No DB connection");
    process.exit(1);
  }

  const alterations = [
    {
      name: "notificationMode",
      sql: sql`ALTER TABLE artistSettings ADD COLUMN notification_mode ENUM('manual','automatic') DEFAULT 'manual'`,
    },
    {
      name: "googlePlaceId",
      sql: sql`ALTER TABLE artistSettings ADD COLUMN googlePlaceId VARCHAR(255) DEFAULT NULL`,
    },
    {
      name: "quietHoursEnabled",
      sql: sql`ALTER TABLE artistSettings ADD COLUMN quietHoursEnabled TINYINT DEFAULT 0`,
    },
    {
      name: "quietHoursStart",
      sql: sql`ALTER TABLE artistSettings ADD COLUMN quietHoursStart INT DEFAULT 21`,
    },
    {
      name: "quietHoursEnd",
      sql: sql`ALTER TABLE artistSettings ADD COLUMN quietHoursEnd INT DEFAULT 7`,
    },
  ];

  for (const alt of alterations) {
    try {
      await db.execute(alt.sql);
      console.log(`✅ Added column: ${alt.name}`);
    } catch (e: any) {
      if (e.message.includes("Duplicate column")) {
        console.log(`⏭️  Column already exists: ${alt.name}`);
      } else {
        console.error(`❌ Failed to add ${alt.name}:`, e.message);
      }
    }
  }

  console.log("\nDone — verifying artistSettings columns...");

  try {
    const [rows] = await db.execute(sql`DESCRIBE artistSettings`);
    console.log("Current columns:", JSON.stringify(rows, null, 2));
  } catch (e: any) {
    console.log("Could not DESCRIBE table:", e.message);
  }

  process.exit(0);
}

main();
