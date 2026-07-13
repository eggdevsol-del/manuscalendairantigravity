/**
 * update-portfolio-images.ts
 * ─────────────────────────────────────────────────────────
 * Updates all existing portfolio images to 9:16 aspect ratio (450x800).
 * Replaces any picsum.photos URLs with new 9:16 dimensions + grayscale.
 *
 * Run: npx tsx server/scripts/update-portfolio-images.ts
 */

import "dotenv/config";
import { sql } from "drizzle-orm";
import { getDb } from "../services/core";
import { portfolios } from "../../drizzle/schema";

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("No DB connection");
    process.exit(1);
  }

  // Get all portfolio images
  const allPortfolios = await db
    .select({ id: portfolios.id, imageUrl: portfolios.imageUrl })
    .from(portfolios);

  console.log(`Found ${allPortfolios.length} portfolio images to update`);

  let updated = 0;

  for (const item of allPortfolios) {
    // Replace picsum URLs with 9:16 dimensions
    if (item.imageUrl.includes("picsum.photos")) {
      // Extract the seed from the URL: https://picsum.photos/seed/SEED/W/H
      const seedMatch = item.imageUrl.match(/\/seed\/([^\/]+)\//);
      const seed = seedMatch ? seedMatch[1] : `port-${item.id}`;
      const newUrl = `https://picsum.photos/seed/${seed}/450/800?grayscale`;

      if (newUrl !== item.imageUrl) {
        await db
          .update(portfolios)
          .set({ imageUrl: newUrl })
          .where(sql`${portfolios.id} = ${item.id}`);
        updated++;
      }
    }
  }

  console.log(`\n✅ Updated ${updated} portfolio images to 9:16 (450x800) + grayscale`);
  console.log(`   ${allPortfolios.length - updated} images were already correct or non-picsum\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
