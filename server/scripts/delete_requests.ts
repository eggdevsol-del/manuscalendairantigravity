import "dotenv/config";
import { getDb } from "../services/core";
import { consultations } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

async function main() {
  console.log("Deleting all pending consultation requests...");
  const db = await getDb();
  if (!db) {
    console.error("No DB connection");
    process.exit(1);
  }

  try {
    await db.delete(consultations).where(eq(consultations.status, "pending"));
    console.log(`Deleted pending consultations.`);
  } catch (error) {
    console.error("Error deleting consultations:", error);
  }

  process.exit(0);
}

main();
