/**
 * seedPortfolios.ts — One-time startup task
 * ─────────────────────────────────────────────────────────
 * Seeds 5 portfolio images per artist who has zero portfolio items.
 * Idempotent — skips artists who already have images.
 * Uses picsum.photos for placeholder tattoo-style images in portrait ratio.
 */

import { eq, and, sql } from "drizzle-orm";
import { getDb } from "../db";
import * as schema from "../../drizzle/schema";

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

export async function seedPortfolioImages() {
  const db = await getDb();
  if (!db) {
    console.log("[Seed] No DB connection, skipping portfolio seed");
    return;
  }

  // Get all artists with completed onboarding and a public slug
  const artists = await db
    .select({
      userId: schema.users.id,
      name: schema.users.name,
      slug: schema.artistSettings.publicSlug,
    })
    .from(schema.users)
    .innerJoin(
      schema.artistSettings,
      eq(schema.users.id, schema.artistSettings.userId)
    )
    .where(
      and(
        eq(schema.users.role, "artist"),
        eq(schema.users.hasCompletedOnboarding, 1)
      )
    );

  if (artists.length === 0) {
    console.log("[Seed] No artists found, skipping portfolio seed");
    return;
  }

  let totalSeeded = 0;

  for (const artist of artists) {
    // Check existing portfolio count
    const existing = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(schema.portfolios)
      .where(eq(schema.portfolios.artistId, artist.userId));

    const count = existing[0]?.count || 0;
    if (count >= 5) continue; // Already has enough images

    const toInsert = 5 - count;
    const slug = artist.slug || artist.userId;

    for (let i = 0; i < toInsert; i++) {
      const seed = `${slug}-port-${count + i}`;
      // Portrait aspect ratio (4:5) — 480x600
      const imageUrl = `https://picsum.photos/seed/${seed}/480/600`;
      const description = DESCRIPTIONS[(totalSeeded + i) % DESCRIPTIONS.length];

      await db.insert(schema.portfolios).values({
        artistId: artist.userId,
        imageUrl,
        description,
      });
    }

    totalSeeded += toInsert;
  }

  if (totalSeeded > 0) {
    console.log(
      `[Seed] Portfolio seeding complete — added ${totalSeeded} images across ${artists.length} artists`
    );
  } else {
    console.log("[Seed] All artists already have portfolio images, nothing to seed");
  }
}
