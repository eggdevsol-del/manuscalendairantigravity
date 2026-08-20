/**
 * instagramImportWorker.ts — Processes Instagram portfolio imports
 * 
 * Handles paginated fetching, thumbnail generation via R2,
 * dedup checking, cancellation, and real-time progress tracking.
 * 
 * Videos use embed-safe proxy URLs (streamed, not hosted).
 * Thumbnails are downloaded and re-hosted on R2.
 */

import * as schema from "../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { getInstagramProvider, type InstagramMedia } from "./instagramProvider";
import { r2Client, BUCKET_NAME } from "../lib/r2";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { extractSmartTags } from "../config/tagConfig";

const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL || "").replace(/\/$/, "");

// ── R2 upload helpers ──────────────────────────────

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

/**
 * Download a video from a URL and upload to R2.
 * Returns the R2 public URL. Falls back to source URL on failure.
 */
async function downloadAndUploadVideo(
  videoUrl: string,
  artistId: string
): Promise<string | null> {
  try {
    const response = await fetch(videoUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TattoiApp/1.0)" },
    });
    if (!response.ok) {
      console.warn(`[IG Import] Video download failed: ${response.status}`);
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    // Skip if video is too large (>100MB) to avoid memory issues
    if (buffer.byteLength > 100 * 1024 * 1024) {
      console.warn(`[IG Import] Video too large (${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB), skipping R2 upload`);
      return null;
    }

    const contentType = response.headers.get("content-type") || "video/mp4";
    const ext = contentType.includes("mp4") ? "mp4" : "mov";
    const key = `instagram-videos/${artistId}/${randomUUID()}.${ext}`;

    await r2Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );

    console.log(`[IG Import] Video uploaded to R2: ${key} (${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB)`);
    return `${R2_PUBLIC_URL}/${key}`;
  } catch (err) {
    console.error("[IG Import] Failed to upload video to R2:", err);
    return null;
  }
}

// ── Cancellation check ─────────────────────────────

/**
 * Check if the import has been cancelled (status changed to "cancelled" in DB).
 */
async function isCancelled(
  db: MySql2Database<typeof schema>,
  importId: number
): Promise<boolean> {
  const record = await db.query.instagramImports.findFirst({
    where: eq(schema.instagramImports.id, importId),
    columns: { status: true },
  });
  return record?.status === "cancelled";
}

// ── Import processor ───────────────────────────────

export async function processInstagramImport(
  db: MySql2Database<typeof schema>,
  importId: number,
  artistId: string,
  username: string,
  /** Optional cap on total items to import (0 = unlimited) */
  maxItems: number = 0
): Promise<void> {
  const provider = getInstagramProvider();

  console.log(`[IG Import] Starting import for @${username} (import #${importId})${maxItems ? ` [max: ${maxItems}]` : ""}`);

  let cursor: string | undefined;
  let totalDiscovered = 0;
  let totalProcessed = 0;
  let totalAdded = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  try {
    // Get the actual media count from the user profile
    try {
      const userInfo = await provider.getUserInfo(username);
      if (userInfo.mediaCount > 0) {
        totalDiscovered = userInfo.mediaCount;
        await db
          .update(schema.instagramImports)
          .set({ totalDiscovered })
          .where(eq(schema.instagramImports.id, importId));
        console.log(`[IG Import] User @${username} has ${totalDiscovered} total posts`);
      }
    } catch (err) {
      console.warn("[IG Import] Could not fetch user info for total count:", err);
    }

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
      // Check for cancellation before each page
      if (await isCancelled(db, importId)) {
        console.log(`[IG Import] Import #${importId} cancelled by user`);
        await db
          .update(schema.instagramImports)
          .set({
            status: "cancelled",
            totalDiscovered,
            totalProcessed,
            totalAdded,
            totalSkipped,
            totalFailed,
            updatedAt: sql`NOW()`,
          })
          .where(eq(schema.instagramImports.id, importId));
        return;
      }

      const result = await provider.fetchUserMedia(username, cursor);
      const { media, nextCursor, totalEstimate } = result;

      // Update totalDiscovered if we get a better estimate from the API
      if (totalDiscovered === 0 && totalEstimate && totalEstimate > 0) {
        totalDiscovered = totalEstimate;
      }

      // If we still don't have a total, estimate from items on this page
      if (totalDiscovered === 0) {
        totalDiscovered = media.length;
      }

      // Write totalDiscovered to DB so the client can show progress
      await updateProgress(db, importId, { totalDiscovered });

      // Track if this page had any new items (for infinite loop prevention)
      let pageHadNewItems = false;

      for (const item of media) {
        // Stop if we've hit the maxItems cap
        if (maxItems > 0 && totalAdded >= maxItems) {
          console.log(`[IG Import] Reached maxItems cap (${maxItems}) — stopping`);
          cursor = undefined;
          break;
        }

        // Check for cancellation every 10 items
        if (totalProcessed > 0 && totalProcessed % 10 === 0) {
          if (await isCancelled(db, importId)) {
            console.log(`[IG Import] Import #${importId} cancelled by user (mid-page)`);
            await db
              .update(schema.instagramImports)
              .set({
                status: "cancelled",
                totalDiscovered: totalProcessed,
                totalProcessed,
                totalAdded,
                totalSkipped,
                totalFailed,
                updatedAt: sql`NOW()`,
              })
              .where(eq(schema.instagramImports.id, importId));
            return;
          }
        }

        totalProcessed++;

        // Dedup check
        if (existingIds.has(item.mediaId)) {
          totalSkipped++;
          await updateProgress(db, importId, { totalProcessed, totalSkipped, totalDiscovered });
          continue;
        }

        pageHadNewItems = true;

        try {
          // Download thumbnail to R2 (images are small, permanent, CORS-safe)
          const thumbSource = item.thumbnailUrl || item.imageUrl;
          const thumbnailUrl = thumbSource
            ? await downloadAndUploadThumbnail(thumbSource, artistId)
            : null;

          // For videos: download and upload to R2 for permanent hosting
          // Falls back to original URL if R2 upload fails
          let videoR2Url: string | null = null;
          if (item.mediaType === "video" && item.videoUrl) {
            videoR2Url = await downloadAndUploadVideo(item.videoUrl, artistId);
          }
          const videoUrl = videoR2Url || (item.mediaType === "video" ? item.videoUrl : undefined);

          // Extract smart tags from caption
          const extracted = extractSmartTags(item.caption);
          const allTags = [...extracted.styleTags, ...extracted.locationTags];

          // Insert portfolio item
          await db.insert(schema.portfolios).values({
            artistId,
            imageUrl: thumbnailUrl || item.imageUrl || "placeholder",
            description: item.caption?.slice(0, 500) || null,
            source: "instagram",
            mediaType: item.mediaType,
            externalMediaId: item.mediaId,
            externalPermalink: item.permalink,
            cdnUrl: videoUrl || thumbnailUrl || item.imageUrl,
            thumbnailUrl,
            caption: item.caption || null,
            publishedAt: item.publishedAt.toISOString().slice(0, 19).replace("T", " "),
            availabilityState: "available",
            importBatchId: importId,
            tags: allTags.length > 0 ? JSON.stringify(allTags) : null,
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
          totalDiscovered,
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
        await updateProgress(db, importId, { totalDiscovered });
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
    totalDiscovered: number;
  }>
) {
  await db
    .update(schema.instagramImports)
    .set({ ...data, updatedAt: sql`NOW()` })
    .where(eq(schema.instagramImports.id, importId));
}
