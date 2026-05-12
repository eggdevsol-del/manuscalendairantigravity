import { getDb } from "./server/db";
import { sql } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("No DB connection");
    process.exit(1);
  }

  try {
    await db.execute(sql`ALTER TABLE payment_ledger MODIFY COLUMN ledger_transaction_type ENUM('deposit','balance','refund','dispute','payout','store_order') NOT NULL`);
    console.log("Updated payment_ledger transactionType enum");
  } catch (e: any) {
    console.log("payment_ledger enum error:", e.message);
  }

  console.log("Done");
  process.exit(0);
}

main();
