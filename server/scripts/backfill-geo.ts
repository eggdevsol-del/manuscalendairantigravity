/**
 * backfill-geo.ts
 * One-off script: geocodes all artistSettings rows that have a
 * businessAddress but no lat/lng, using OpenStreetMap Nominatim.
 *
 * Nominatim requires ≤1 request/second — this script respects that.
 *
 * Run: pnpm tsx server/scripts/backfill-geo.ts
 */

import "dotenv/config";
import { getDb } from "../services/core";
import { artistSettings } from "../../drizzle/schema";
import { isNull, or, and, isNotNull } from "drizzle-orm";
import { geocodeAddress } from "../services/geocode";
import { eq } from "drizzle-orm";

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log("🌍 Geo Backfill Starting...\n");

  const db = await getDb();
  if (!db) {
    console.error("❌ Database connection failed");
    process.exit(1);
  }

  // Find all artistSettings with an address but missing lat or lng
  const rows = await db
    .select({
      userId: artistSettings.userId,
      businessAddress: artistSettings.businessAddress,
      lat: artistSettings.lat,
      lng: artistSettings.lng,
    })
    .from(artistSettings)
    .where(isNotNull(artistSettings.businessAddress));

  const toGeocode = rows.filter(
    r => r.businessAddress && (!r.lat || !r.lng)
  );

  console.log(`📋 ${rows.length} artists with an address`);
  console.log(`🔍 ${toGeocode.length} need geocoding (missing lat/lng)\n`);

  if (toGeocode.length === 0) {
    console.log("✅ Nothing to do — all addresses already have coordinates.");
    process.exit(0);
  }

  let success = 0;
  let failed = 0;

  for (const row of toGeocode) {
    const address = row.businessAddress!;
    const coords = await geocodeAddress(address);

    if (coords) {
      await db
        .update(artistSettings)
        .set({ lat: coords.lat, lng: coords.lng })
        .where(eq(artistSettings.userId, row.userId));
      success++;
    } else {
      console.warn(`  ⚠️  Could not geocode: ${address}`);
      failed++;
    }

    // Nominatim rate limit: 1 request per second
    await sleep(1100);
  }

  console.log(`\n✨ Backfill complete!`);
  console.log(`   ✅ Geocoded: ${success}`);
  console.log(`   ⚠️  Failed:  ${failed}`);

  process.exit(0);
}

main().catch(err => {
  console.error("❌ Script failed:", err);
  process.exit(1);
});
