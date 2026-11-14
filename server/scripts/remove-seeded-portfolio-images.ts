/**
 * remove-seeded-portfolio-images.ts
 * ─────────────────────────────────
 * Removes the placeholder stock images (https://picsum.photos/...) that an old
 * startup task inserted into artists' portfolios.
 *
 * Dry run (default, changes nothing): pnpm tsx server/scripts/remove-seeded-portfolio-images.ts
 * Delete the listed rows:             pnpm tsx server/scripts/remove-seeded-portfolio-images.ts --apply
 */

import "dotenv/config";
import { inArray, like } from "drizzle-orm";
import { getDb } from "../services/core";
import * as schema from "../../drizzle/schema";

const SEEDED_PREFIX = "https://picsum.photos/";

async function main() {
  const apply = process.argv.includes("--apply");

  const db = await getDb();
  if (!db) {
    console.error("Could not connect to database");
    process.exit(1);
  }

  const rows = (
    await db
      .select({
        id: schema.portfolios.id,
        artistId: schema.portfolios.artistId,
        imageUrl: schema.portfolios.imageUrl,
      })
      .from(schema.portfolios)
      .where(like(schema.portfolios.imageUrl, `${SEEDED_PREFIX}%`))
  ).filter(row => row.imageUrl.startsWith(SEEDED_PREFIX));

  const artists = new Set(rows.map(row => row.artistId));
  console.log(
    `Found ${rows.length} seeded portfolio image(s) across ${artists.size} artist(s):`
  );
  for (const row of rows) {
    console.log(`  ID ${row.id}  artist ${row.artistId}  ${row.imageUrl}`);
  }

  if (rows.length === 0) {
    console.log("Nothing to clean up.");
    process.exit(0);
  }

  if (!apply) {
    console.log("\nDry run: nothing was deleted. Re-run with --apply to delete these rows.");
    process.exit(0);
  }

  // Delete exactly the rows listed above, by id
  const ids = rows.map(row => row.id);
  for (let i = 0; i < ids.length; i += 500) {
    await db
      .delete(schema.portfolios)
      .where(inArray(schema.portfolios.id, ids.slice(i, i + 500)));
  }

  console.log(`\nDeleted ${rows.length} seeded portfolio image(s).`);
  process.exit(0);
}

main().catch(err => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
