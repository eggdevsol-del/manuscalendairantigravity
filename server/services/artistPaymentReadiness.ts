import { eq, gt, isNotNull, and, asc } from "drizzle-orm";
import { artistSettings } from "../../drizzle/schema";
import { getDb } from "./core";
import { getAccountStatus, type ConnectAccountStatus } from "./stripeConnect";

// Short, bounded per-process cache: database flags alone never authorise payment.
const cache = new Map<
  string,
  { until: number; status: ConnectAccountStatus }
>();
const pending = new Map<string, Promise<ConnectAccountStatus>>();
const TTL = 60_000;
export function invalidateArtistPaymentStatus(accountId: string) {
  cache.delete(accountId);
}
export async function getArtistPaymentStatus(
  accountId: string,
  force = false
): Promise<ConnectAccountStatus> {
  if (force) cache.delete(accountId);
  const running = pending.get(accountId);
  if (running) return running;
  const saved = cache.get(accountId);
  if (!force && saved && saved.until > Date.now()) return saved.status;
  const task = (async () => {
    const status = await getAccountStatus(accountId);
    // An outage must neither clear verified flags nor authorise a checkout.
    if (!status.statusAvailable)
      throw new Error(
        "Payment verification is temporarily unavailable. Please try again."
      );
    const db = await getDb();
    if (!db)
      throw new Error(
        "Payment verification could not be saved. Please try again."
      );
    await db
      .update(artistSettings)
      .set({
        stripeConnectOnboardingComplete: status.onboardingComplete ? 1 : 0,
        stripeConnectPayoutsEnabled: status.payoutsEnabled ? 1 : 0,
        stripeConnectDetailsSubmitted: status.detailsSubmitted ? 1 : 0,
        ...(status.stripeAccountType
          ? { stripeConnectAccountType: status.stripeAccountType }
          : {}),
      })
      .where(eq(artistSettings.stripeConnectAccountId, accountId));
    if (cache.size >= 1000) cache.delete(cache.keys().next().value!);
    cache.set(accountId, { until: Date.now() + TTL, status });
    return status;
  })();
  pending.set(accountId, task);
  try {
    return await task;
  } finally {
    pending.delete(accountId);
  }
}
export async function artistCanAcceptPayments(
  settings: { stripeConnectAccountId?: string | null } | null | undefined
) {
  if (!settings?.stripeConnectAccountId) return false;
  return (await getArtistPaymentStatus(settings.stripeConnectAccountId))
    .chargesEnabled;
}

// Recover missed webhooks in bounded batches, with no overlapping runs.
let reconciling = false;
let cursor = "";
export async function reconcileArtistPaymentStatuses() {
  if (reconciling) return;
  reconciling = true;
  try {
    const db = await getDb();
    if (!db) return;
    const rows = await db
      .select({
        userId: artistSettings.userId,
        accountId: artistSettings.stripeConnectAccountId,
      })
      .from(artistSettings)
      .where(
        and(
          isNotNull(artistSettings.stripeConnectAccountId),
          gt(artistSettings.userId, cursor)
        )
      )
      .orderBy(asc(artistSettings.userId))
      .limit(50);
    for (const row of rows) {
      try {
        await getArtistPaymentStatus(row.accountId!, true);
      } catch (error) {
        console.error(
          "[Stripe reconciliation] Account verification failed",
          error
        );
      }
      cursor = row.userId;
    }
    if (rows.length < 50) cursor = "";
  } finally {
    reconciling = false;
  }
}
export function startArtistPaymentReconciliation() {
  const timer = setInterval(() => {
    void reconcileArtistPaymentStatuses().catch(error =>
      console.error("[Stripe reconciliation]", error)
    );
  }, 60_000);
  timer.unref();
}
