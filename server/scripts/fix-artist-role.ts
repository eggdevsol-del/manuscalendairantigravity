// @ts-nocheck
/**
 * One-off script: ensures bookings@pmasontattoo.com has role = 'artist'
 * Run: npx tsx server/scripts/fix-artist-role.ts
 */
import "dotenv/config";
import mysql from "mysql2/promise";

const EMAIL = "bookings@pmasontattoo.com";

async function fixRole() {
  const connection = await mysql.createConnection({
    uri: process.env.DATABASE_URL!,
  });

  // Check current state
  const [rows] = await connection.execute(
    "SELECT id, email, role FROM users WHERE email = ? LIMIT 1",
    [EMAIL]
  ) as any;

  if (!rows || rows.length === 0) {
    console.error(`❌ User ${EMAIL} NOT FOUND in the database.`);
    await connection.end();
    process.exit(1);
  }

  const user = rows[0];
  console.log(`✅ Found user: id=${user.id} email=${user.email} role=${user.role}`);

  if (user.role === "artist") {
    console.log("✅ Role is already 'artist'. No change needed.");
    await connection.end();
    process.exit(0);
  }

  console.log(`⚠️  Role is '${user.role}' — updating to 'artist'...`);
  await connection.execute(
    "UPDATE users SET role = 'artist' WHERE email = ?",
    [EMAIL]
  );

  // Verify
  const [updated] = await connection.execute(
    "SELECT role FROM users WHERE email = ? LIMIT 1",
    [EMAIL]
  ) as any;
  console.log(`✅ New role confirmed: ${updated[0]?.role}`);

  await connection.end();
  process.exit(0);
}

fixRole().catch(err => {
  console.error("Script failed:", err);
  process.exit(1);
});
