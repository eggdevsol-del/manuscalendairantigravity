/**
 * Studio Role Demo Seed Script — "Harpoon and highwater"
 *
 * Populates real Drizzle/MySQL database records for the demo studio:
 * - Studio entity in `studios`
 * - 6 resident artist memberships in `studio_members`
 * - 1 pending invite in `studio_members`
 * - Inbound leads in `leads`
 * - Appointments across Day, Week, and Month in `appointments`
 * - Financial transactions in `studio_transactions`
 *
 * Idempotent: Can be run multiple times safely.
 * Usage: `npx tsx server/scripts/seedStudioDemo.ts`
 */

import "dotenv/config";
import mysql from "mysql2/promise";

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.log("[Seed] DATABASE_URL not set — skipping seed");
    process.exit(0);
  }

  console.log("[Seed] Connecting to database...");
  const connection = await mysql.createConnection(DATABASE_URL);

  const STUDIO_ID = "studio_harpoon_highwater";
  const STUDIO_NAME = "Harpoon and highwater";
  const PUBLIC_SLUG = "harpoonandhighwater";
  const OWNER_EMAIL = "piripi@tattoi.app";

  console.log("[Seed] Ensuring owner user exists...");
  const [users] = await connection.query("SELECT id FROM users LIMIT 10") as any;
  let ownerId = users.length > 0 ? users[0].id : "user_piripi_mason";

  // Check if user named Piripi Mason exists
  const [piripiUser] = await connection.query("SELECT id FROM users WHERE name LIKE '%Piripi%' OR email = ? LIMIT 1", [OWNER_EMAIL]) as any;
  if (piripiUser.length > 0) {
    ownerId = piripiUser[0].id;
  } else if (users.length === 0) {
    await connection.query(
      "INSERT INTO users (id, email, name, role, isArtist) VALUES (?, ?, 'Piripi Mason', 'artist', 1)",
      [ownerId, OWNER_EMAIL]
    );
  }

  console.log(`[Seed] Using ownerId: ${ownerId}`);

  // 1. Create or Update Studio
  await connection.query(`
    INSERT INTO studios (
      id, name, ownerId, publicSlug, brandLine, address, instagramHandle,
      balanceCents, defaultCommission, defaultChairRentCents, autoBriefEnabled, subscriptionTier
    ) VALUES (
      ?, ?, ?, ?, 'STUDIO BY THE DEPT OF TATTOO SERVICES', 'Fortitude Valley, QLD', 'harpoonandhighwater',
      1243850, 30, 35000, 1, 'studio'
    ) ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      balanceCents = VALUES(balanceCents),
      defaultCommission = VALUES(defaultCommission),
      defaultChairRentCents = VALUES(defaultChairRentCents)
  `, [STUDIO_ID, STUDIO_NAME, ownerId, PUBLIC_SLUG]);

  console.log("[Seed] ✅ Studio 'Harpoon and highwater' seeded");

  // 2. Seed Resident Artists
  const residentArtists = [
    { id: ownerId, name: "Piripi Mason", email: "piripi@harpoon.co", role: "owner", model: "commission", comm: 30, rent: 35000, dyn: 35, spec: "Realism, Portrait" },
    { id: "artist_kaia_ngata", name: "Kaia Ngata", email: "kaia@harpoon.co", role: "artist", model: "commission", comm: 25, rent: 35000, dyn: 35, spec: "Fine Line, Floral" },
    { id: "artist_jonah_reid", name: "Jonah Reid", email: "jonah@harpoon.co", role: "artist", model: "rent", comm: 30, rent: 35000, dyn: 35, spec: "Blackwork, Script" },
    { id: "artist_sofia_marsh", name: "Sofia Marsh", email: "sofia@harpoon.co", role: "artist", model: "commission", comm: 30, rent: 35000, dyn: 35, spec: "Neo-trad, Color" },
    { id: "artist_eli_tan", name: "Eli Tan", email: "eli@harpoon.co", role: "artist", model: "rent", comm: 30, rent: 30000, dyn: 35, spec: "Anime, Color" },
    { id: "artist_marta_kovac", name: "Marta Kovač", email: "marta@harpoon.co", role: "artist", model: "dynamic", comm: 35, rent: 35000, dyn: 35, spec: "Geometric, Dotwork" },
  ];

  for (const art of residentArtists) {
    // Create user if not exists
    await connection.query(
      "INSERT INTO users (id, email, name, role, isArtist) VALUES (?, ?, ?, 'artist', 1) ON DUPLICATE KEY UPDATE name = VALUES(name)",
      [art.id, art.email, art.name]
    );

    // Create artist settings
    await connection.query(
      "INSERT INTO artistSettings (userId, businessName, displayName, keywords, workSchedule) VALUES (?, ?, ?, ?, '{\"mon\":true,\"tue\":true,\"wed\":true,\"thu\":true,\"fri\":true,\"sat\":true}') ON DUPLICATE KEY UPDATE keywords = VALUES(keywords)",
      [art.id, art.name, art.name, art.spec]
    );

    // Create studio membership
    await connection.query(`
      INSERT INTO studio_members (
        studioId, userId, role, paymentModel, commissionPct, weeklyChairRentCents, dynamicStartingPct, status, joinedAt
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, 'active', NOW()
      ) ON DUPLICATE KEY UPDATE
        role = VALUES(role),
        paymentModel = VALUES(paymentModel),
        commissionPct = VALUES(commissionPct),
        weeklyChairRentCents = VALUES(weeklyChairRentCents),
        dynamicStartingPct = VALUES(dynamicStartingPct),
        status = 'active'
    `, [STUDIO_ID, art.id, art.role, art.model, art.comm, art.rent, art.dyn]);
  }

  // 3. Seed Pending Invite
  await connection.query(`
    INSERT INTO studio_members (
      studioId, userId, role, paymentModel, commissionPct, weeklyChairRentCents, dynamicStartingPct, status, inviteEmail, inviteToken, inviteSentAt
    ) VALUES (
      ?, 'user_pending_ana_silva', 'artist', 'commission', 30, 35000, 35, 'pending_invite', 'ana.silva@ink.co', 'inv_ana_silva_demo', NOW()
    ) ON DUPLICATE KEY UPDATE
      status = 'pending_invite'
  `, [STUDIO_ID]);

  console.log("[Seed] ✅ Resident artists and pending invite seeded");

  // 4. Seed Studio Transactions
  const demoTransactions = [
    { type: "artist_settlement_credit", amt: 146700, gross: 489000, model: "commission", desc: "Settlement · Piripi Mason · Weekly payout Fri 21 Aug · 30% commission on $4,890 gross" },
    { type: "artist_settlement_credit", amt: 35000, gross: 120000, model: "rent", desc: "Settlement · Jonah Reid · Weekly payout Fri 21 Aug · chair rent" },
    { type: "artist_settlement_credit", amt: 30000, gross: 85000, model: "rent", desc: "Settlement · Eli Tan · Daily payout Fri 21 Aug · chair rent" },
    { type: "artist_settlement_credit", amt: 18000, gross: 72000, model: "commission", desc: "Settlement · Kaia Ngata · Daily payout Thu 20 Aug · 25% commission on $720 gross" },
    { type: "artist_settlement_credit", amt: 63000, gross: 252000, model: "dynamic", desc: "Settlement · Marta Kovač · Weekly payout Fri 21 Aug · dynamic 25% on $2,520 gross" },
    { type: "studio_withdrawal_debit", amt: -937500, gross: 937500, model: "payout", desc: "Payout · Studio withdrawal (Fees: $160.00 Stripe + $168.13 platform)" },
  ];

  for (const tx of demoTransactions) {
    await connection.query(`
      INSERT INTO studio_transactions (
        studioId, type, amountCents, grossAmountCents, stripeFeeCents, platformFeeCents, netAmountCents, paymentModel, payoutSchedule, description
      ) VALUES (
        ?, ?, ?, ?, 0, 0, ?, ?, 'weekly', ?
      )
    `, [STUDIO_ID, tx.type, tx.amt, tx.gross, tx.amt, tx.model, tx.desc]);
  }

  console.log("[Seed] ✅ Studio transactions seeded");

  // 5. Seed Studio Leads
  const demoLeads = [
    { clientName: "Mia Torrens", clientEmail: "mia.torrens@gmail.com", clientPhone: "+61412000111", projectType: "Fine-line floral sleeve", estimatedValue: 450000, status: "new" },
    { clientName: "Dominic Reyes", clientEmail: "dominic.reyes@gmail.com", clientPhone: "+61412000222", projectType: "Realism pet portrait · calf", estimatedValue: 180000, status: "new" },
    { clientName: "Hana Walker", clientEmail: "hana.walker@gmail.com", clientPhone: "+61412000333", projectType: "Blackwork back piece", estimatedValue: 300000, status: "referred" },
    { clientName: "Tom Field", clientEmail: "tom.field@gmail.com", clientPhone: "+61412000444", projectType: "Fine-line script wrist", estimatedValue: 45000, status: "booked" },
  ];

  for (const l of demoLeads) {
    await connection.query(`
      INSERT INTO leads (
        artistId, clientName, clientEmail, clientPhone, projectType, estimatedValue, status, source
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, 'studio_link'
      )
    `, [STUDIO_ID, l.clientName, l.clientEmail, l.clientPhone, l.projectType, l.estimatedValue, l.status]);
  }

  console.log("[Seed] ✅ Studio leads seeded");

  // 6. Seed Appointments across Artists for multi-chair calendar
  const demoAppts = [
    { aid: "artist_sofia_marsh", date: "2026-08-23 11:00:00", end: "2026-08-23 13:00:00", client: "Riley P", service: "Walk-in flash", status: "confirmed" },
    { aid: "artist_eli_tan", date: "2026-08-23 10:00:00", end: "2026-08-23 15:00:00", client: "Kenji M", service: "Anime half sleeve · s2", status: "pending" },
    { aid: ownerId, date: "2026-08-24 09:00:00", end: "2026-08-24 15:00:00", client: "Bob Lazar", service: "Full back · Session 2", status: "confirmed" },
    { aid: ownerId, date: "2026-08-26 09:00:00", end: "2026-08-26 15:00:00", client: "Bob Lazar", service: "Full back · Session 3", status: "confirmed" },
    { aid: "artist_kaia_ngata", date: "2026-08-24 13:00:00", end: "2026-08-24 16:00:00", client: "Iris Lowe", service: "Fine-line peony", status: "confirmed" },
    { aid: "artist_kaia_ngata", date: "2026-08-26 10:00:00", end: "2026-08-26 14:00:00", client: "Amber Rowe", service: "Floral forearm", status: "pending" },
    { aid: "artist_jonah_reid", date: "2026-08-25 11:00:00", end: "2026-08-25 14:00:00", client: "Theo Marsh", service: "Script collarbone", status: "confirmed" },
    { aid: "artist_jonah_reid", date: "2026-08-27 09:00:00", end: "2026-08-27 14:00:00", client: "Dana K", service: "Blackwork panel", status: "confirmed" },
    { aid: "artist_marta_kovac", date: "2026-08-25 09:00:00", end: "2026-08-25 15:00:00", client: "Lena V", service: "Geometric sleeve · s3", status: "confirmed" },
    { aid: "artist_marta_kovac", date: "2026-08-27 13:00:00", end: "2026-08-27 17:00:00", client: "Omar F", service: "Dotwork mandala", status: "confirmed" },
  ];

  for (const a of demoAppts) {
    await connection.query(`
      INSERT INTO appointments (
        studioId, artistId, clientId, title, serviceName, startTime, endTime, status, price, isStudioReferral
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, 500, 0
      )
    `, [STUDIO_ID, a.aid, a.aid, `${a.service} · ${a.client}`, a.service, a.date, a.end, a.status]);
  }

  console.log("[Seed] ✅ Appointments seeded");

  await connection.end();
  console.log("[Seed] 🎉 Studio demo seed completed successfully!");
  process.exit(0);
}

main().catch((err) => {
  console.error("[Seed] Fatal error:", err);
  process.exit(1);
});
