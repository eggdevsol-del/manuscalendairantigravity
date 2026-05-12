import { getDb } from "../services/core";
import { orders } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

async function check() {
  try {
    const db = await getDb();
    if (!db) {
        console.log("No DB");
        return;
    }
    const order = await db.query.orders.findFirst({ orderBy: [desc(orders.id)] });
    console.log("Latest order:", order);
    
    if (order) {
        const now = new Date().toISOString().slice(0, 19).replace("T", " ");
        console.log("Updating to:", now);
        await db.update(orders).set({ updatedAt: now as any }).where(eq(orders.id, order.id));
        console.log("Update successful!");
    }
  } catch (e: any) {
    console.error("DB Error:", e);
  }
  process.exit(0);
}
check();
