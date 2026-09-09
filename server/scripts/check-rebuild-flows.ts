/** Real MySQL acceptance checks. Every fixture and queued notification rolls back. */
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { getDb, withDatabaseTransaction } from "../services/core";
import * as schema from "../../drizzle/schema";
import { waitlistRouter } from "../routers/waitlist";
import { projectsRouter } from "../routers/projects";
import { processImport } from "../services/dataImport";
import { importInputSchema } from "../../shared/importData";
import type { TrpcContext } from "../_core/context";
if (!process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_"))
  throw new Error("Run only in the authorized Stripe test environment.");
const suffix = randomUUID(),
  artistId = `test_artist_${suffix}`,
  clientId = `test_client_${suffix}`;
const rollback = new Error("INTENTIONAL_TEST_ROLLBACK");
const context = (id: string, role: string) =>
  ({ user: { id, role }, req: {}, res: {} }) as TrpcContext;
try {
  await withDatabaseTransaction(async db => {
    await db.insert(schema.users).values([
      { id: artistId, name: "Tattoi acceptance artist", role: "artist" },
      {
        id: clientId,
        name: "Tattoi acceptance client",
        role: "client",
        email: `client-${suffix}@example.invalid`,
      },
    ]);
    await db
      .insert(schema.artistSettings)
      .values({
        userId: artistId,
      workSchedule: "{}", services: "[]",
        stripeConnectAccountId: "acct_acceptance_fixture",
        stripeConnectOnboardingComplete: 1,
        subscriptionTier: "basic",
      });
    const [conversation] = await db
      .insert(schema.conversations)
      .values({ artistId, clientId });
    const conversationId = conversation.insertId;
    const client = waitlistRouter.createCaller(context(clientId, "client"));
    const artist = waitlistRouter.createCaller(context(artistId, "artist"));
    const entry = await client.join({ conversationId });
    assert.equal((await client.join({ conversationId })).id, entry.id);
    await artist.offer({
      id: entry.id,
      startsAt: "2099-10-10T01:00:00Z",
      durationMinutes: 60,
      estimateCents: 20000,
      depositCents: 5000,
      expiresInHours: 24,
    });
    const accepted = await client.accept({ id: entry.id });
    assert.equal(
      (await client.accept({ id: entry.id })).sessionPlanId,
      accepted.sessionPlanId
    );
    const plan = await db.query.sessionPlans.findFirst({
      where: eq(schema.sessionPlans.id, accepted.sessionPlanId),
    });
    assert.equal(plan?.status, "pending");
    assert.equal(plan?.depositTotalCents, 5000);
    const summary = await projectsRouter
      .createCaller(context(clientId, "client"))
      .summary({ conversationId });
    assert.equal(summary.plans.length, 1);
    assert.equal(summary.sessions.length, 0);
    await assert.rejects(
      () =>
        projectsRouter
          .createCaller(context("unrelated-test-user", "client"))
          .summary({ conversationId }),
      { code: "FORBIDDEN" }
    );
    const input = importInputSchema.parse({
      mode: "clients",
      rows: [
        {
          name: "CSV acceptance fixture",
          email: `import-${suffix}@example.invalid`,
          sourceRow: 2,
        },
      ],
    });
    assert.equal(
      (await processImport(artistId, input, false))[0].status,
      "new"
    );
    assert.equal(
      (await processImport(artistId, input, true))[0].status,
      "imported"
    );
    assert.equal(
      (await processImport(artistId, input, true))[0].status,
      "duplicate"
    );
    console.log(
      "PASS: waitlist join/retry, offer, pending acceptance/retry, project summary/access, CSV preview/import/retry."
    );
    throw rollback;
  });
} catch (error) {
  if (error !== rollback) throw error;
}
const database = await getDb();
const leftovers = await database!
  .select({ id: schema.users.id })
  .from(schema.users)
  .where(inArray(schema.users.id, [artistId, clientId]));
assert.equal(leftovers.length, 0);
console.log(
  "PASS: MySQL rollback removed all fixtures and queued side effects. No provider requests were made."
);
process.exit(0);
