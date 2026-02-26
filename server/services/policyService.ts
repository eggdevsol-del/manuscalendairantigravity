import { and, eq } from "drizzle-orm";
import { policies, InsertPolicy } from "../../drizzle/schema";
import { getDb } from "./core";

// ============================================================================
// Policy operations
// ============================================================================

export async function getPolicies(artistId: string) {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(policies).where(eq(policies.artistId, artistId));
}

export async function getPolicyByType(
  artistId: string,
  policyType: "deposit" | "design" | "reschedule" | "cancellation"
) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(policies)
    .where(
      and(eq(policies.artistId, artistId), eq(policies.policyType, policyType))
    )
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function upsertPolicy(policy: InsertPolicy) {
  const db = await getDb();
  if (!db) return undefined;

  const existing = await getPolicyByType(
    policy.artistId,
    policy.policyType as any
  );

  if (existing) {
    await db
      .update(policies)
      .set({ ...policy, updatedAt: new Date().toISOString().slice(0, 19).replace("T", " ") })
      .where(eq(policies.id, existing.id));
    return getPolicyByType(policy.artistId, policy.policyType as any);
  } else {
    const result = await db.insert(policies).values(policy);
    const inserted = await db
      .select()
      .from(policies)
      .where(eq(policies.id, Number(result[0].insertId)))
      .limit(1);
    return inserted[0];
  }
}

export async function deletePolicy(id: number) {
  const db = await getDb();
  if (!db) return false;

  await db.delete(policies).where(eq(policies.id, id));
  return true;
}
