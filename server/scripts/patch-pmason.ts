/**
 * patch-pmason.ts
 * One-off script: enriches bookings@pmasontattoo.com's artistSettings
 * with Brisbane lat/lng, keywords, and displayName so they appear
 * in the Discover section and on the artist map.
 *
 * Run: pnpm tsx server/scripts/patch-pmason.ts
 */

import "dotenv/config";
import { getDb } from "../services/core";
import { users, artistSettings } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

async function main() {
  console.log("🔧 Patching P Mason Tattoo artistSettings...\n");

  const db = await getDb();
  if (!db) {
    console.error("❌ Database connection failed");
    process.exit(1);
  }

  // 1. Find the user
  const [artist] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.email, "bookings@pmasontattoo.com"))
    .limit(1);

  if (!artist) {
    console.error("❌ bookings@pmasontattoo.com not found in users table");
    process.exit(1);
  }

  console.log(`✅ Found artist: ${artist.name} (${artist.id})`);

  // 2. Check if artistSettings row exists
  const [existing] = await db
    .select({ userId: artistSettings.userId, lat: artistSettings.lat, lng: artistSettings.lng })
    .from(artistSettings)
    .where(eq(artistSettings.userId, artist.id))
    .limit(1);

  console.log(
    existing
      ? `📋 Existing artistSettings: lat=${existing.lat}, lng=${existing.lng}`
      : "📋 No artistSettings row — will insert"
  );

  // P Mason Tattoo is based in Brisbane — using Fortitude Valley coordinates
  const PMASON_PATCH = {
    displayName: "P Mason Tattoo Artist",
    businessName: "P Mason Tattoo",
    businessAddress: "Fortitude Valley, Brisbane QLD 4006",
    businessCountry: "AU",
    city: "Fortitude Valley",
    keywords: "Realism, Portrait, Black & Grey, Fine Line, Custom",
    lat: "-27.4567",
    lng: "153.0310",
    funnelEnabled: 1,
  };

  if (existing) {
    // Patch only the fields we care about — preserve everything else
    await db
      .update(artistSettings)
      .set(PMASON_PATCH)
      .where(eq(artistSettings.userId, artist.id));
    console.log("✅ Updated existing artistSettings with geo + keywords");
  } else {
    // Insert a fresh row
    await db.insert(artistSettings).values({
      userId: artist.id,
      ...PMASON_PATCH,
      workSchedule: JSON.stringify({}),
      services: JSON.stringify([]),
    });
    console.log("✅ Inserted new artistSettings row");
  }

  // 3. Also make sure the users.city is set
  await db
    .update(users)
    .set({ city: "Fortitude Valley" })
    .where(eq(users.id, artist.id));

  console.log("\n✨ P Mason patch complete!");
  console.log(`   displayName: ${PMASON_PATCH.displayName}`);
  console.log(`   keywords:    ${PMASON_PATCH.keywords}`);
  console.log(`   lat/lng:     ${PMASON_PATCH.lat}, ${PMASON_PATCH.lng}`);
  console.log(`   address:     ${PMASON_PATCH.businessAddress}`);

  process.exit(0);
}

main().catch(err => {
  console.error("❌ Script failed:", err);
  process.exit(1);
});
