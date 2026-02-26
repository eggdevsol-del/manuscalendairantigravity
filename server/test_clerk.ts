import "dotenv/config";
import { createClerkClient } from "@clerk/backend";

// We will use this to test the key
async function testKey() {
  console.log("Testing Clerk Secret Key...");
  if (!process.env.CLERK_SECRET_KEY) {
    console.error("CLERK_SECRET_KEY is missing from environment.");
    process.exit(1);
  }

  try {
    const clerk = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    const userList = await clerk.users.getUserList({ limit: 1 });
    console.log("Success! Connected to Clerk.");
  } catch (e) {
    console.error("Failed to connect:", e);
  }
}
// We don't actually run this yet, just checking imports
