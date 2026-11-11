import { eq } from "drizzle-orm";
import { artistSettings } from "../../drizzle/schema";
import { getBusinessTimezone } from "../../shared/utils/timezone";
import { getDb } from "./core";

/** The zone an artist works in, from their Business details. */
export async function artistTimezone(artistId: string): Promise<string> {
  const db = await getDb();
  const row = await db?.query.artistSettings.findFirst({
    where: eq(artistSettings.userId, artistId),
    columns: { timeZone: true },
  });
  return getBusinessTimezone(row?.timeZone);
}
