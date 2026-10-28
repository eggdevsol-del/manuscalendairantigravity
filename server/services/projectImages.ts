import { desc, inArray } from "drizzle-orm";
import * as schema from "../../drizzle/schema";
import { getDb } from "./core";

/** The first usable image in a stored list: JSON text of URLs or `{ url }` objects. Inline `data:` images
 *  are skipped so list responses stay small. */
export function firstStoredImage(...values: (string | null | undefined)[]) {
  for (const value of values) {
    if (!value) continue;
    let list: unknown;
    try {
      list = JSON.parse(value);
    } catch {
      list = [value];
    }
    for (const item of Array.isArray(list) ? list : [list]) {
      const url =
        typeof item === "string"
          ? item
          : item && typeof item === "object" && "url" in item
            ? String((item as { url: unknown }).url)
            : "";
      if (url && !url.startsWith("data:")) return url;
    }
  }
  return null;
}

/** Each conversation's project image: the first reference (or placement) photo from its booking request,
 *  newest request first. Used to put the client's idea on calendar and landing cards. */
export async function projectImages(conversationIds: (number | null | undefined)[]) {
  const ids = [...new Set(conversationIds.filter((id): id is number => !!id))];
  const images = new Map<number, string>();
  if (!ids.length) return images;
  const db = await getDb();
  if (!db) return images;
  const rows = await db
    .select({
      conversationId: schema.leads.conversationId,
      referenceImages: schema.leads.referenceImages,
      bodyPlacementImages: schema.leads.bodyPlacementImages,
    })
    .from(schema.leads)
    .where(inArray(schema.leads.conversationId, ids))
    .orderBy(desc(schema.leads.createdAt));
  for (const row of rows) {
    if (!row.conversationId || images.has(row.conversationId)) continue;
    const url = firstStoredImage(row.referenceImages, row.bodyPlacementImages);
    if (url) images.set(row.conversationId, url);
  }
  return images;
}

/** Adds `imageUrl` to each item from its conversation's project image. Images never block the data. */
export async function withProjectImages<T extends { conversationId?: number | null }>(items: T[]) {
  const images = await projectImages(items.map(i => i.conversationId)).catch(
    () => new Map<number, string>()
  );
  return items.map(i => ({
    ...i,
    imageUrl: (i.conversationId && images.get(i.conversationId)) || null,
  }));
}
