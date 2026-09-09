/** Acceptance checks against MySQL; all fixtures and queued effects are rolled back. */
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import * as s from "../../drizzle/schema";
import {
  getDb,
  withDatabaseTransaction,
  withDatabaseSavepoint,
} from "../services/core";
import { importCatalogue } from "../services/catalogueImport";
import {
  changeOrderInventory,
  releaseExpiredStoreOrder,
} from "../services/storeInventory";
import { merchantAuthRouter } from "../routers/merchantAuth";
import { storefrontRouter } from "../routers/storefront";
import { studiosRouter } from "../routers/studios";
import { appointmentsRouter } from "../routers/appointments";
import type { TrpcContext } from "../_core/context";
if (!process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_"))
  throw new Error("Only run against the authorized test environment.");
const suffix = randomUUID();
const ids = ["merchant", "owner", "artist", "client", "outsider"].map(
  role => `qa_${role}_${suffix}`
);
const [merchantId, ownerId, artistId, clientId, outsiderId] = ids;
const ctx = (id: string, role: string) =>
  ({ user: { id, role }, req: {}, res: {} }) as TrpcContext;
const rollback = new Error("TEST_ROLLBACK");
try {
  await withDatabaseTransaction(async db => {
    await db.insert(s.users).values(
      ids.map(
        (id, i) =>
          ({
            id,
            role: ["merchant", "artist", "artist", "client", "client"][i],
            name: "TEST ONLY acceptance",
            email: `${id}@example.invalid`,
          }) as any
      )
    );
    const [insert] = await db.insert(s.merchants).values({
      userId: merchantId,
      businessName: "TEST ONLY Store",
      country: "AU",
      contactName: "TEST ONLY",
      phone: "0400000000",
      address: "TEST ONLY",
      status: "active",
      shopifyToken: "private_fixture_token",
    });
    const source = [
      {
        id: "p1",
        title: "Fixture needles",
        variants: [
          {
            id: "v1",
            title: "Size A",
            price: "10.00",
            sku: "TEST",
            inventory_quantity: 5,
          },
        ],
      },
    ];
    await importCatalogue(
      insert.insertId,
      merchantId,
      "qa.example.invalid",
      source
    );
    let product = (
      await db.query.products.findMany({
        where: eq(s.products.artistId, merchantId),
        with: { variants: true },
      })
    )[0];
    assert.equal(product.isActive, 0);
    const pid = product.id,
      vid = product.variants[0].id;
    await db
      .update(s.products)
      .set({ isActive: 1 })
      .where(eq(s.products.id, pid));
    const [order] = await db.insert(s.orders).values({
      artistId: merchantId,
      clientId,
      totalAmountCents: 2000,
      platformFeeCents: 100,
      artistFeeCents: 0,
      status: "pending",
      stripeCheckoutSessionId: "cs_test_fixture",
    });
    await db.insert(s.orderItems).values({
      orderId: order.insertId,
      productId: pid,
      variantId: vid,
      productName: "Snapshot fixture",
      quantity: 2,
      priceAtPurchaseCents: 1000,
    });
    await changeOrderInventory(db, order.insertId, -1);
    source[0].title = "Updated fixture";
    source[0].variants[0].inventory_quantity = 50;
    await importCatalogue(
      insert.insertId,
      merchantId,
      "qa.example.invalid",
      source
    );
    product = (
      await db.query.products.findMany({
        where: eq(s.products.artistId, merchantId),
        with: { variants: true },
      })
    )[0];
    assert.equal(product.id, pid);
    assert.equal(product.variants[0].id, vid);
    assert.equal(product.variants[0].inventoryCount, 3);
    assert.equal(product.isActive, 1);
    await releaseExpiredStoreOrder(db, order.insertId, "cs_wrong");
    assert.equal(
      (
        await db.query.orders.findFirst({
          where: eq(s.orders.id, order.insertId),
        })
      )?.status,
      "pending"
    );
    await releaseExpiredStoreOrder(db, order.insertId, "cs_test_fixture");
    await releaseExpiredStoreOrder(db, order.insertId, "cs_test_fixture");
    assert.equal(
      (
        await db.query.productVariants.findFirst({
          where: eq(s.productVariants.id, vid),
        })
      )?.inventoryCount,
      5
    );
    const merchant = merchantAuthRouter.createCaller(
      ctx(merchantId, "merchant")
    );
    assert.ok(
      !JSON.stringify(await merchant.getMerchantProfile()).includes(
        "private_fixture_token"
      )
    );
    const purchases = await storefrontRouter
      .createCaller(ctx(clientId, "client"))
      .getPurchases();
    assert.equal(purchases.length, 1);
    assert.equal(purchases[0].items[0].name, "Snapshot fixture");
    assert.equal(
      (
        await storefrontRouter
          .createCaller(ctx(outsiderId, "client"))
          .getPurchases()
      ).length,
      0
    );
    await assert.rejects(
      () =>
        withDatabaseSavepoint(async inner => {
          await inner
            .update(s.products)
            .set({ title: "MUST ROLL BACK" })
            .where(eq(s.products.id, pid));
          throw new Error("simulated failed job");
        }),
      /simulated failed job/
    );
    assert.equal(
      (await db.query.products.findFirst({ where: eq(s.products.id, pid) }))
        ?.title,
      "Updated fixture"
    );
    console.log(
      "PASS: stable catalogue/variant IDs, published state, reserved stock preserved on re-import, expiry exactly once, profile secrets excluded, purchase ownership, job savepoint rollback."
    );
    const owner = studiosRouter.createCaller(ctx(ownerId, "artist")),
      artist = studiosRouter.createCaller(ctx(artistId, "artist"));
    const studio = await owner.createStudio({ name: "TEST ONLY Studio" });
    await assert.rejects(
      () =>
        owner.inviteArtist({
          studioId: studio.studioId,
          artistEmail: `${artistId}@example.invalid`,
          role: "artist",
        }),
      { code: "PRECONDITION_FAILED" }
    );
    await db
      .update(s.studios)
      .set({
        stripeSubscriptionId: "sub_fixture",
        subscriptionStatus: "active",
      })
      .where(eq(s.studios.id, studio.studioId));
    await assert.rejects(
      () =>
        owner.inviteArtist({
          studioId: studio.studioId,
          artistEmail: `${clientId}@example.invalid`,
          role: "artist",
        }),
      { code: "BAD_REQUEST" }
    );
    await owner.inviteArtist({
      studioId: studio.studioId,
      artistEmail: `${artistId}@example.invalid`,
      role: "artist",
    });
    const invitation = (await artist.getPendingInvites())[0];
    await assert.rejects(
      () => artist.getStudioMembers({ studioId: studio.studioId }),
      { code: "FORBIDDEN" }
    );
    await db
      .update(s.studios)
      .set({ subscriptionStatus: "canceled" })
      .where(eq(s.studios.id, studio.studioId));
    await assert.rejects(
      () =>
        artist.respondToInvite({ inviteId: invitation.id, response: "accept" }),
      { code: "PRECONDITION_FAILED" }
    );
    await db
      .update(s.studios)
      .set({ subscriptionStatus: "active" })
      .where(eq(s.studios.id, studio.studioId));
    await artist.respondToInvite({
      inviteId: invitation.id,
      response: "accept",
    });
    assert.equal((await artist.getCurrentStudio())?.id, studio.studioId);
    const [conversation] = await db
      .insert(s.conversations)
      .values({ artistId, clientId });
    await db.insert(s.appointments).values([
      {
        artistId,
        clientId,
        conversationId: conversation.insertId,
        studioId: studio.studioId,
        title: "Studio appointment",
        startTime: "2099-10-01 00:00:00",
        endTime: "2099-10-01 01:00:00",
        status: "confirmed",
      },
      {
        artistId,
        clientId,
        conversationId: conversation.insertId,
        studioId: null,
        title: "PRIVATE appointment",
        startTime: "2099-10-02 00:00:00",
        endTime: "2099-10-02 01:00:00",
        status: "confirmed",
      },
    ]);
    const calendar = appointmentsRouter.createCaller(ctx(ownerId, "artist"));
    const rows = await calendar.getStudioCalendar({
      studioId: studio.studioId,
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].title, "Studio appointment");
    await assert.rejects(
      () => owner.removeMember({ studioId: studio.studioId, userId: ownerId }),
      { code: "PRECONDITION_FAILED" }
    );
    await artist.removeMember({ studioId: studio.studioId, userId: artistId });
    await assert.rejects(
      () => artist.getStudioMembers({ studioId: studio.studioId }),
      { code: "FORBIDDEN" }
    );
    assert.equal(
      (await calendar.getStudioCalendar({ studioId: studio.studioId })).length,
      0
    );
    assert.equal(
      (
        await db.query.appointments.findMany({
          where: eq(s.appointments.artistId, artistId),
        })
      ).length,
      2
    );
    console.log(
      "PASS: artist eligibility, paid studio invitation/acceptance, pending/departed access denied, owner retained, private calendar excluded, departure retains artist history."
    );
    throw rollback;
  });
} catch (error) {
  if (error !== rollback) throw error;
}
const db = await getDb();
assert.equal(
  (await db!.select().from(s.users).where(inArray(s.users.id, ids))).length,
  0
);
console.log(
  "PASS: every fixture and queued side effect rolled back. No external provider calls."
);
process.exit(0);
