/**
 * instagramImportWorker.ts — Processes Instagram portfolio imports
 * 
 * Handles paginated fetching, thumbnail generation via R2,
 * dedup checking, and real-time progress tracking.
 */

import * as schema from "../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { getInstagramProvider, type InstagramMedia } from "./instagramProvider";
import { r2Client, BUCKET_NAME } from "../lib/r2";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL || "").replace(/\/$/, "");

// ── Thumbnail helpers ──────────────────────────────

/**
 * Download an image from a URL and upload a compressed version to R2.
 * Returns the R2 public URL.
 */
async function downloadAndUploadThumbnail(
  imageUrl: string,
  artistId: string
): Promise<string | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    const key = `instagram-thumbs/${artistId}/${randomUUID()}.jpg`;

    await r2Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: "image/jpeg",
      })
    );

    return `${R2_PUBLIC_URL}/${key}`;
  } catch (err) {
    console.error("[IG Import] Failed to upload thumbnail:", err);
    return null;
  }
}

// ── Import processor ───────────────────────────────

export async function processInstagramImport(
  db: MySql2Database<typeof schema>,
  importId: number,
  artistId: string,
  username: string
): Promise<void> {
  const provider = getInstagramProvider();

  console.log(`[IG Import] Starting import for @${username} (import #${importId})`);

  let cursor: string | undefined;
  let totalDiscovered = 0;
  let totalProcessed = 0;
  let totalAdded = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  try {
    // Fetch existing externalMediaIds for this artist (dedup)
    const existingItems = await db.query.portfolios.findMany({
      where: and(
        eq(schema.portfolios.artistId, artistId),
        eq(schema.portfolios.source, "instagram")
      ),
      columns: { externalMediaId: true },
    });
    const existingIds = new Set(existingItems.map((i) => i.externalMediaId).filter(Boolean));

    // Paginate through all posts
    do {
      const result = await provider.fetchUserMedia(username, cursor);
      const { media, nextCursor, totalEstimate } = result;

      if (totalDiscovered === 0 && totalEstimate) {
        totalDiscovered = totalEstimate;
        await db
          .update(schema.instagramImports)
          .set({ totalDiscovered })
          .where(eq(schema.instagramImports.id, importId));
      }

      // If first page gives us the count directly from items
      if (totalDiscovered === 0) {
        totalDiscovered = media.length;
      }

      // Track if this page had any new items (for infinite loop prevention)
      let pageHadNewItems = false;

      for (const item of media) {
        totalProcessed++;

        // Dedup check
        if (existingIds.has(item.mediaId)) {
          totalSkipped++;
          await updateProgress(db, importId, { totalProcessed, totalSkipped });
          continue;
        }

        pageHadNewItems = true;

        try {
          // Download thumbnail to R2
          const thumbSource = item.thumbnailUrl || item.imageUrl;
          const thumbnailUrl = thumbSource
            ? await downloadAndUploadThumbnail(thumbSource, artistId)
            : null;

          // Insert portfolio item
          await db.insert(schema.portfolios).values({
            artistId,
            imageUrl: thumbnailUrl || item.imageUrl || "placeholder",
            description: item.caption?.slice(0, 500) || null,
            source: "instagram",
            mediaType: item.mediaType,
            externalMediaId: item.mediaId,
            externalPermalink: item.permalink,
            cdnUrl: item.mediaType === "video" ? (item.videoUrl || item.imageUrl) : item.imageUrl,
            thumbnailUrl,
            caption: item.caption || null,
            publishedAt: item.publishedAt.toISOString().slice(0, 19).replace("T", " "),
            availabilityState: "available",
            importBatchId: importId,
          });

          existingIds.add(item.mediaId);
          totalAdded++;
        } catch (err) {
          console.error(`[IG Import] Failed to process item ${item.mediaId}:`, err);
          totalFailed++;
        }

        // Update progress every item
        await updateProgress(db, importId, {
          totalProcessed,
          totalAdded,
          totalSkipped,
          totalFailed,
        });
      }

      cursor = nextCursor || undefined;

      // Stop if the entire page was duplicates or empty (prevents infinite loop with fallback pagination)
      if (media.length > 0 && !pageHadNewItems) {
        console.log(`[IG Import] Entire page was duplicates — stopping pagination`);
        cursor = undefined;
      }

      // Also stop if we got an empty page
      if (media.length === 0) {
        cursor = undefined;
      }

      // Update total discovered if we keep finding more pages
      if (cursor) {
        totalDiscovered = Math.max(totalDiscovered, totalProcessed + 12); // Estimate next page
      }
    } while (cursor);

    // Set accurate total discovered count
    totalDiscovered = totalProcessed;

    // Mark as completed
    await db
      .update(schema.instagramImports)
      .set({
        status: "completed",
        totalDiscovered,
        totalProcessed,
        totalAdded,
        totalSkipped,
        totalFailed,
        updatedAt: sql`NOW()`,
      })
      .where(eq(schema.instagramImports.id, importId));

    console.log(
      `[IG Import] Completed import for @${username}: ${totalAdded} added, ${totalSkipped} skipped, ${totalFailed} failed`
    );
  } catch (err: any) {
    console.error(`[IG Import] Import failed for @${username}:`, err);
    await db
      .update(schema.instagramImports)
      .set({
        status: "failed",
        errorMessage: err.message || "Unknown error",
        totalProcessed,
        totalAdded,
        totalSkipped,
        totalFailed,
        updatedAt: sql`NOW()`,
      })
      .where(eq(schema.instagramImports.id, importId));
  }
}

async function updateProgress(
  db: MySql2Database<typeof schema>,
  importId: number,
  data: Partial<{
    totalProcessed: number;
    totalAdded: number;
    totalSkipped: number;
    totalFailed: number;
  }>
) {
  await db
    .update(schema.instagramImports)
    .set({ ...data, updatedAt: sql`NOW()` })
    .where(eq(schema.instagramImports.id, importId));
}
