import Fastify from "fastify";
import { setupDb } from "./server/db";
import { getArtistCalendar } from "./server/services/appointmentService";
import { artistSettings } from "./drizzle/schema";
import { eq } from "drizzle-orm";

async function test() {
  const app = Fastify();
  try {
    await setupDb(app);
    const db = app.db;
    const userId = "user_2tm14L2C0j1bAR7wO2wN2Hk9JgN";
    
    const settings = await db.query.artistSettings.findFirst({
        where: eq(artistSettings.userId, userId)
    });
    
    console.log("calendarUrl Check:", settings?.appleCalendarUrl);
    
    if (settings?.appleCalendarUrl) {
      const start = new Date("2025-01-01");
      const end = new Date("2027-01-01");
      console.log("Calling getArtistCalendar with window:", start, end);
      const events = await getArtistCalendar(userId, start, end);
      
      const ext = events.filter(e => e.clientId === "external-sync");
      console.log("Total Appointments via Service:", events.length);
      console.log("External Appts Merged:", ext.length);
    }
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
test();
