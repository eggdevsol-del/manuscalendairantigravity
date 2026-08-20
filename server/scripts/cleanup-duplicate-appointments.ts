/**
 * cleanup-duplicate-appointments.ts
 * ─────────────────────────────────
 * Finds and deletes duplicate appointments created by webhook retries.
 * Keeps the OLDEST (lowest ID) appointment for each sessionPlanId + sessionIndex combo.
 *
 * Run: pnpm tsx server/scripts/cleanup-duplicate-appointments.ts
 */

import "dotenv/config";
import { eq, and, sql } from "drizzle-orm";
import { getDb } from "../services/core";
import * as schema from "../../drizzle/schema";

async function main() {
  console.log("🔍 Scanning for duplicate appointments...\n");

  const db = await getDb();
  if (!db) {
    console.error("❌ Database connection failed");
    process.exit(1);
  }

  // Find all appointments that belong to a session plan
  const allPlanAppts = await db.query.appointments.findMany({
    where: sql`${schema.appointments.sessionPlanId} IS NOT NULL`,
    orderBy: (appointments, { asc }) => [asc(appointments.id)],
  });

  console.log(`📊 Found ${allPlanAppts.length} session plan appointments total\n`);

  // Group by sessionPlanId + sessionIndex
  const groups = new Map<string, typeof allPlanAppts>();
  for (const appt of allPlanAppts) {
    const key = `plan:${appt.sessionPlanId}_session:${appt.sessionIndex}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(appt);
  }

  let totalDeleted = 0;
  const deletedIds: number[] = [];

  for (const [key, appts] of groups) {
    if (appts.length <= 1) continue; // No duplicates

    // Keep the first (lowest ID), delete the rest
    const [keep, ...dupes] = appts;
    console.log(`  🔄 ${key}: keeping ID ${keep.id}, deleting ${dupes.length} dupes (IDs: ${dupes.map(d => d.id).join(", ")})`);

    for (const dupe of dupes) {
      await db.delete(schema.appointments).where(eq(schema.appointments.id, dupe.id));
      deletedIds.push(dupe.id);
      totalDeleted++;
    }
  }

  // Also check for non-session-plan duplicates (same conversationId + same startTime + same title)
  const allAppts = await db.query.appointments.findMany({
    where: sql`${schema.appointments.sessionPlanId} IS NULL`,
    orderBy: (appointments, { asc }) => [asc(appointments.id)],
  });

  const nonPlanGroups = new Map<string, typeof allAppts>();
  for (const appt of allAppts) {
    const key = `conv:${appt.conversationId}_start:${appt.startTime}_title:${appt.title}`;
    if (!nonPlanGroups.has(key)) nonPlanGroups.set(key, []);
    nonPlanGroups.get(key)!.push(appt);
  }

  for (const [key, appts] of nonPlanGroups) {
    if (appts.length <= 1) continue;

    const [keep, ...dupes] = appts;
    console.log(`  🔄 ${key}: keeping ID ${keep.id}, deleting ${dupes.length} dupes`);

    for (const dupe of dupes) {
      await db.delete(schema.appointments).where(eq(schema.appointments.id, dupe.id));
      deletedIds.push(dupe.id);
      totalDeleted++;
    }
  }

  console.log(`\n${"═".repeat(50)}`);
  console.log(`  ✅ Cleanup complete: ${totalDeleted} duplicate appointments deleted`);
  if (deletedIds.length > 0) {
    console.log(`  🗑️  Deleted IDs: ${deletedIds.join(", ")}`);
  } else {
    console.log(`  ℹ️  No duplicates found — database is clean!`);
  }
  console.log(`${"═".repeat(50)}\n`);

  process.exit(0);
}

main().catch(err => {
  console.error("❌ Cleanup failed:", err);
  process.exit(1);
});
