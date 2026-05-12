import { getDb } from "../services/core";
import { appointments } from "../../drizzle/schema";
import { eq, isNull, or, and, ne } from "drizzle-orm";

async function run() {
  console.log("Starting balance backfill for legacy appointments...");
  const db = await getDb();
  if (!db) {
    console.error("No database connection!");
    return;
  }

  // Find all appointments that are not fully_paid and not cancelled
  const legacyAppointments = await db.query.appointments.findMany({
    where: and(
      ne(appointments.status, "cancelled"),
      ne(appointments.paymentStatus, "fully_paid")
    ),
  });

  let updatedCount = 0;

  for (const appt of legacyAppointments) {
    // If the database has 0 or null for remainingBalanceCents but it shouldn't
    if (!appt.remainingBalanceCents || appt.remainingBalanceCents === 0) {
      
      const expected = appt.totalExpectedAmountCents || (appt.price ? appt.price * 100 : 0);
      const paid = appt.totalPaidAmountCents || (appt.depositPaid ? (appt.depositAmount || 0) * 100 : 0);
      const calculatedBalance = Math.max(0, expected - paid);

      if (calculatedBalance > 0) {
        console.log(`Updating appointment ${appt.id}: expected ${expected}, paid ${paid}, setting balance to ${calculatedBalance}`);
        await db
          .update(appointments)
          .set({
            totalExpectedAmountCents: expected,
            totalPaidAmountCents: paid,
            remainingBalanceCents: calculatedBalance,
          })
          .where(eq(appointments.id, appt.id));
        updatedCount++;
      }
    }
  }

  console.log(`Successfully backfilled balances for ${updatedCount} legacy appointments.`);
  process.exit(0);
}

run().catch(console.error);
