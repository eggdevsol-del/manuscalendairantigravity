import { drizzle } from "drizzle-orm/mysql2";
import { conversations, users } from "../drizzle/schema";

const db = drizzle(process.env.DATABASE_URL);

async function check() {
  const allConvos = await db.select().from(conversations);
  console.log("Conversations:", allConvos.length);
  allConvos.forEach(c => console.log("  -", c.id, c.artistId, c.clientId));

  const allUsers = await db.select().from(users);
  console.log("\nUsers:");
  allUsers.forEach(u => console.log("  -", u.id, u.name, u.role));

  console.log("\nOwner ID from env:", process.env.OWNER_OPEN_ID);
}

check().then(() => process.exit(0));
