import { getDb } from "../services/core";
import * as schema from "../../drizzle/schema";
import { eq, isNull } from "drizzle-orm";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("No DB connection");
    process.exit(1);
  }

  const convoId = 570;
  
  // Find messages without metadata (which render as raw text bubbles in the UI)
  const msgs = await db.query.messages.findMany({
      where: eq(schema.messages.conversationId, convoId)
  });

  const textMsgs = msgs.filter(m => !m.metadata);

  console.log(`Found ${textMsgs.length} messages without metadata (text bubbles). Deleting them now...`);

  for (const msg of textMsgs) {
      console.log(`Deleting ID ${msg.id}: ${msg.content.substring(0, 50)}...`);
      await db.delete(schema.messages).where(eq(schema.messages.id, msg.id));
  }
  
  console.log("Deleted successfully.");
  process.exit(0);
}
main();
