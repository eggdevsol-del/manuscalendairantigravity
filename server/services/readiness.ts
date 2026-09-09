import { sql } from "drizzle-orm";
import { getDb } from "./core";
let cached: { at: number; ready: boolean } | undefined;
export async function databaseReady(): Promise<boolean> {
  if (cached && Date.now() - cached.at < 15000) return cached.ready;
  let ready = false;
  try {
    const db = await getDb();
    if (db) {
      // A read-only projection validates the columns needed by the rebuilt critical flows.
      await db.execute(
        sql`SELECT id, processedAt FROM stripe_webhook_events LIMIT 0`
      );
      await db.execute(
        sql`SELECT id, status, expiresAt, sessionPlanId FROM waitlist_entries LIMIT 0`
      );
      await db.execute(
        sql`SELECT id, totalExpectedAmountCents, totalPaidAmountCents, remainingBalanceCents FROM appointments LIMIT 0`
      );
      await db.execute(
        sql`SELECT id, stripeSessionId, depositTotalCents FROM sessionPlans LIMIT 0`
      );
      ready = true;
    }
  } catch {
    ready = false;
  }
  cached = { at: Date.now(), ready };
  return ready;
}
