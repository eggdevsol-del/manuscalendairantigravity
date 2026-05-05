import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { eq } from "drizzle-orm";
import { users, artistSettings } from "../drizzle/schema";

async function check() {
  const connection = await mysql.createConnection({
    uri: process.env.DATABASE_URL || "mysql://root:@localhost:3306/calendair",
  });
  const db = drizzle(connection);

  const artist = await db.query.users.findFirst({
    where: eq(users.email, "bookings@pmasontattoo.com"),
  });
  console.log("Artist:", artist?.id);

  if (artist) {
    const settings = await db.query.artistSettings.findFirst({
      where: eq(artistSettings.userId, artist.id),
    });
    console.log("Settings stripeConnectAccountId:", settings?.stripeConnectAccountId);
    console.log("Settings stripeConnectOnboardingComplete:", settings?.stripeConnectOnboardingComplete);
    console.log("Settings stripeConnectPayoutsEnabled:", settings?.stripeConnectPayoutsEnabled);
  }

  process.exit(0);
}

check().catch(console.error);
