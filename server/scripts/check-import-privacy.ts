/**
 * Real MySQL check: importing a contact that belongs to someone else's record
 * never writes onto that record. Every fixture rolls back.
 * Run: tsx server/scripts/check-import-privacy.ts
 */
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { getDb, withDatabaseTransaction } from "../services/core";
import * as schema from "../../drizzle/schema";
import { importedEmailNoteId, processImport } from "../services/dataImport";
import { importInputSchema } from "../../shared/importData";
if (!process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_"))
  throw new Error("Run only in the authorized Stripe test environment.");
const suffix = randomUUID(),
  artistId = `test_artist_${suffix}`,
  otherArtistId = `test_artist_b_${suffix}`,
  accountId = `test_account_${suffix}`,
  walkInId = `usr_imp_${suffix}`,
  accountEmail = `account-${suffix}@example.invalid`,
  walkInEmail = `walkin-${suffix}@example.invalid`;
const rollback = new Error("INTENTIONAL_TEST_ROLLBACK");
const clients = (name: string, email: string, phone?: string) =>
  importInputSchema.parse({
    mode: "clients",
    rows: [{ name, email, ...(phone ? { phone } : {}), sourceRow: 2 }],
  });
try {
  await withDatabaseTransaction(async db => {
    await db.insert(schema.users).values([
      { id: artistId, name: "Import privacy artist", role: "artist" },
      { id: otherArtistId, name: "Import privacy artist B", role: "artist" },
      {
        // A real account the importing artist has never dealt with.
        id: accountId,
        name: "Import privacy account",
        role: "client",
        email: accountEmail,
        password: "not-a-real-hash",
        loginMethod: "email",
      },
      {
        // Another artist's imported walk-in nobody has signed in to.
        id: walkInId,
        name: "Import privacy walk-in",
        role: "client",
        email: walkInEmail,
        loginMethod: "imported",
      },
    ]);
    await db.insert(schema.artistSettings).values({
      userId: artistId,
      workSchedule: "{}",
      services: "[]",
    });
    await db
      .insert(schema.conversations)
      .values({ artistId: otherArtistId, clientId: walkInId });

    const untouched = async (clientId: string) => {
      const threads = await db
        .select({ id: schema.conversations.id })
        .from(schema.conversations)
        .where(
          and(
            eq(schema.conversations.artistId, artistId),
            eq(schema.conversations.clientId, clientId)
          )
        );
      const sittings = await db
        .select({ id: schema.appointments.id })
        .from(schema.appointments)
        .where(
          and(
            eq(schema.appointments.artistId, artistId),
            eq(schema.appointments.clientId, clientId)
          )
        );
      assert.equal(threads.length, 0);
      assert.equal(sittings.length, 0);
    };
    const placeholder = async (email: string) => {
      const [note] = await db
        .select()
        .from(schema.clientNotes)
        .where(eq(schema.clientNotes.id, importedEmailNoteId(artistId, email)));
      assert.ok(note, "the artist's note keeps the imported email");
      assert.equal(note.artistId, artistId);
      assert.match(note.clientId, /^usr_imp_/);
      assert.ok(note.note.includes(email));
      const [person] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, note.clientId));
      assert.equal(person.email, null);
      assert.equal(person.loginMethod, "imported");
      return person.id;
    };
    const count = async () =>
      (
        await db
          .select({ id: schema.conversations.id })
          .from(schema.conversations)
          .where(eq(schema.conversations.artistId, artistId))
      ).length;

    // Someone else's account.
    const first = clients("Typed name", accountEmail);
    assert.equal(
      (await processImport(artistId, first, false))[0].status,
      "new"
    );
    assert.equal(
      (await processImport(artistId, first, true))[0].status,
      "imported"
    );
    await untouched(accountId);
    const mine = await placeholder(accountEmail);
    assert.notEqual(mine, accountId);
    assert.equal(await count(), 1);
    // The same person again: unchanged, renamed, and with a phone added.
    for (const again of [
      first,
      clients("Corrected name", accountEmail),
      clients("Typed name", accountEmail, "0412345678"),
    ])
      assert.equal(
        (await processImport(artistId, again, true))[0].status,
        "duplicate"
      );
    assert.equal(await count(), 1);
    // A sitting for that email lands on the artist's own record.
    const sitting = importInputSchema.parse({
      mode: "appointments",
      rows: [
        {
          name: "Typed name",
          email: accountEmail,
          date: "2020-01-06",
          startTime: "10:00",
          price: 100,
          sourceRow: 2,
        },
      ],
    });
    assert.equal(
      (await processImport(artistId, sitting, true))[0].status,
      "imported"
    );
    assert.equal(
      (await processImport(artistId, sitting, true))[0].status,
      "duplicate"
    );
    await untouched(accountId);
    const booked = await db
      .select({ clientId: schema.appointments.clientId })
      .from(schema.appointments)
      .where(eq(schema.appointments.artistId, artistId));
    assert.deepEqual(booked, [{ clientId: mine }]);

    // Another artist's unclaimed walk-in with the same email.
    const walkIn = clients("Walk-in", walkInEmail);
    assert.equal(
      (await processImport(artistId, walkIn, false))[0].status,
      "new"
    );
    assert.equal(
      (await processImport(artistId, walkIn, true))[0].status,
      "imported"
    );
    await untouched(walkInId);
    assert.notEqual(await placeholder(walkInEmail), walkInId);
    assert.equal(
      (await processImport(artistId, walkIn, true))[0].status,
      "duplicate"
    );
    assert.equal(await count(), 2);
    console.log(
      "PASS: import of an unrelated account's and another artist's walk-in's email wrote nothing to them; re-imports were duplicates."
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
  .where(
    inArray(schema.users.id, [artistId, otherArtistId, accountId, walkInId])
  );
assert.equal(leftovers.length, 0);
console.log("PASS: MySQL rollback removed all fixtures.");
process.exit(0);
