/**
 * seed-portfolio-images.ts
 * ─────────────────────────────────────────────────────────
 * Adds 5 portfolio images per mock artist using picsum.photos
 * (portrait aspect ratio ~4:5 to match the feed design)
 *
 * Run: pnpm tsx server/scripts/seed-portfolio-images.ts
 */

import "dotenv/config";
import { eq, and } from "drizzle-orm";
import { getDb } from "../services/core";
import { users, artistSettings, portfolios } from "../../drizzle/schema";

// Tattoo style descriptions for portfolio items
const DESCRIPTIONS = [
  "Full sleeve in progress — 3rd session complete",
  "Custom piece — client brought their own design",
  "Walk-in flash piece from last weekend",
  "Commission piece — took about 6 hours",
  "Fresh ink — healed photo coming soon",
  "Cover-up work — before and after in stories",
  "Small piece — perfect for a first tattoo",
  "Back piece progress — halfway there",
  "Matching set for a couple — love these ones",
  "Freehand design done live in the chair",
  "Detail shot from yesterday's session",
  "Colour piece — this one really pops in person",
  "Geometric piece with fine line details",
  "Custom lettering with floral elements",
  "Black and grey portrait — memorial piece",
];

async function main() {
  console.log("📸 Portfolio Image Seeder Starting...\n");

  const db = await getDb();
  if (!db) {
    console.error("❌ Database connection failed");
    process.exit(1);
  }

  // Get all mock artists (role = artist, has completed onboarding, has publicSlug)
  const artists = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      slug: artistSettings.publicSlug,
    })
    .from(users)
    .innerJoin(artistSettings, eq(users.id, artistSettings.userId))
    .where(
      and(
        eq(users.role, "artist"),
        eq(users.hasCompletedOnboarding, 1)
      )
    );

  if (artists.length === 0) {
    console.error("❌ No artists found. Run seed-mock-artists.ts first.");
    process.exit(1);
  }

  console.log(`Found ${artists.length} artists\n`);

  let totalInserted = 0;

  for (const artist of artists) {
    // Check if this artist already has portfolio items
    const existing = await db.query.portfolios.findMany({
      where: eq(portfolios.artistId, artist.userId),
    });

    if (existing.length >= 5) {
      console.log(`  ⏭️  ${artist.name} — already has ${existing.length} images, skipping`);
      continue;
    }

    // Generate 5 portfolio images using picsum.photos with unique seeds
    const slug = artist.slug || artist.email;
    const imagesToInsert = 5 - existing.length;

    for (let i = 0; i < imagesToInsert; i++) {
      const seed = `${slug}-portfolio-${i + existing.length}`;
      // 9:16 portrait aspect ratio — 450x800
      const imageUrl = `https://picsum.photos/seed/${seed}/450/800?grayscale`;
      const description = DESCRIPTIONS[(totalInserted + i) % DESCRIPTIONS.length];

      await db.insert(portfolios).values({
        artistId: artist.userId,
        imageUrl,
        description,
      });
    }

    totalInserted += imagesToInsert;
    console.log(`  ✅ ${artist.name} — added ${imagesToInsert} portfolio images`);
  }

  console.log(`\n✨ Seeding complete! Added ${totalInserted} portfolio images.\n`);
  process.exit(0);
}

main().catch(err => {
  console.error("❌ Seeder failed:", err);
  process.exit(1);
});
