/**
 * backfillTags.ts — Re-parse existing portfolio captions to populate tags
 * 
 * Run with: npx tsx server/scripts/backfillTags.ts
 */
import { getDb } from "../db";
import * as schema from "../../drizzle/schema";
import { isNotNull, sql, eq } from "drizzle-orm";
import { extractSmartTags } from "../config/tagConfig";

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("❌ No DB connection");
    process.exit(1);
  }

  // Get all portfolio items with captions (from Instagram import)
  const items = await db
    .select({
      id: schema.portfolios.id,
      caption: schema.portfolios.caption,
    })
    .from(schema.portfolios)
    .where(isNotNull(schema.portfolios.caption));

  console.log(`Found ${items.length} portfolio items with captions`);

  let updated = 0;
  let skipped = 0;

  for (const item of items) {
    const extracted = extractSmartTags(item.caption);
    const allTags = [...extracted.styleTags, ...extracted.locationTags];

    if (allTags.length === 0) {
      skipped++;
      continue;
    }

    await db
      .update(schema.portfolios)
      .set({ tags: JSON.stringify(allTags) })
      .where(eq(schema.portfolios.id, item.id));

    updated++;

    if (updated % 50 === 0) {
      console.log(`  Updated ${updated} items...`);
    }
  }

  console.log(`\n✅ Done! Updated: ${updated}, Skipped (no tags): ${skipped}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
