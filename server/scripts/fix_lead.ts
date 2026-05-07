import "dotenv/config";
import { getDb } from "../db";
import { leads } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) { console.error("No DB"); return; }
  
  await db.update(leads).set({
    depositVerifiedAt: null,
    depositClaimedAt: null,
    status: "deposit_requested" as any
  }).where(eq(leads.id, 30));
  
  console.log("Lead 30 reset");
  process.exit(0);
}
main();
