/**
 * One-shot cleanup: Delete messages containing localhost URLs.
 * These are legacy messages sent before the localhost purge in v1.0.622.
 *
 * Run: npx tsx server/scripts/cleanup_localhost_messages.ts
 */
import { getDb } from "../services/core";
import * as schema from "../../drizzle/schema";
import { like } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("Could not connect to database");
    process.exit(1);
  }

  // Find all messages containing localhost
  const messages = await db
    .select({ id: schema.messages.id, content: schema.messages.content })
    .from(schema.messages)
    .where(like(schema.messages.content, "%localhost%"));

  console.log(`Found ${messages.length} message(s) containing 'localhost':`);
  for (const msg of messages) {
    console.log(`  ID ${msg.id}: ${msg.content?.slice(0, 100)}...`);
  }

  if (messages.length === 0) {
    console.log("Nothing to clean up.");
    process.exit(0);
  }

  // Delete them
  const result = await db
    .delete(schema.messages)
    .where(like(schema.messages.content, "%localhost%"));

  console.log(`Deleted ${messages.length} legacy message(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
