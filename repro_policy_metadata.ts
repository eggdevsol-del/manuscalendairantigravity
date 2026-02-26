import "dotenv/config";
import { getDb } from "./server/services/core";
import {
  users,
  artistSettings,
  conversations,
  policies,
  messages,
} from "./drizzle/schema";
import { eq } from "drizzle-orm";

async function main() {
  console.log("Starting policy metadata repro...");
  const db = await getDb();
  if (!db) {
    console.error("Failed to connect to DB");
    process.exit(1);
  }

  // cleaning up
  try {
    await db.delete(messages);
    await db.delete(policies);
    await db.delete(conversations);
    await db.delete(users);
  } catch (e) {
    console.log("Cleanup failed (might be empty):", e);
  }

  // 1. Create Artist
  const artistId = "test-artist-" + Date.now();
  await db.insert(users).values({
    id: artistId,
    name: "Test Artist",
    email: "artist@test.com",
    role: "artist",
  });

  // 2. Create Client
  const clientId = "test-client-" + Date.now();
  await db.insert(users).values({
    id: clientId,
    name: "Test Client",
    email: "client@test.com",
    role: "client",
  });

  // 3. Create Conversation
  const convResult = await db.insert(conversations).values({
    artistId,
    clientId,
  });
  const convId = Number(convResult[0].insertId);

  // 4. Create Policies
  // Enabled policy
  await db.insert(policies).values({
    artistId,
    policyType: "deposit",
    title: "Deposit Policy",
    content: "Pay 50%",
    enabled: true,
  });
  // Disabled policy
  await db.insert(policies).values({
    artistId,
    policyType: "cancellation",
    title: "Cancel Policy",
    content: "No refunds",
    enabled: false,
  });

  // --- REPLICATE LOGIC FROM booking.ts ---

  // Fetch policies
  const fetchedPolicies = await db
    .select()
    .from(policies)
    .where(eq(policies.artistId, artistId));

  const enabledPolicies = fetchedPolicies.filter(p => p.enabled);

  console.log("Total Policies:", fetchedPolicies.length);
  console.log("Enabled Policies:", enabledPolicies.length);

  const proposalMetadata = JSON.stringify({
    serviceName: "Test Service",
    totalCost: 100,
    sittings: 1,
    dates: [new Date()],
    status: "pending",
    policies: enabledPolicies,
  });

  console.log("Metadata:", proposalMetadata);

  if (!proposalMetadata.includes("Deposit Policy")) {
    throw new Error("Metadata missing Deposit Policy");
  }
  if (proposalMetadata.includes("Cancel Policy")) {
    throw new Error("Metadata includes disabled Cancel Policy");
  }

  console.log("SUCCESS: Metadata contains correct policies.");
  process.exit(0);
}

main().catch(console.error);
