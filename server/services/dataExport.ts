import { eq, inArray, or } from "drizzle-orm";
import * as schema from "../../drizzle/schema";
import { getDb } from "./core";

/** Fields that are credentials or provider secrets, never included in an export. */
const SECRET = /password|token|secret|bsb|accountNumber/i;
export const withoutSecrets = <T extends Record<string, unknown>>(row: T) =>
  Object.fromEntries(Object.entries(row).filter(([k]) => !SECRET.test(k)));

/**
 * Everything Tattoi holds that belongs to one person, as plain JSON: their profile, business
 * settings, bookings (as artist or client), conversations and the messages in them.
 */
export async function exportAccountData(userId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [profile, settings, appointments, conversations] = await Promise.all([
    db.query.users.findFirst({ where: eq(schema.users.id, userId) }),
    db.query.artistSettings.findFirst({
      where: eq(schema.artistSettings.userId, userId),
    }),
    db.query.appointments.findMany({
      where: or(
        eq(schema.appointments.artistId, userId),
        eq(schema.appointments.clientId, userId)
      ),
      limit: 5000,
    }),
    db.query.conversations.findMany({
      where: or(
        eq(schema.conversations.artistId, userId),
        eq(schema.conversations.clientId, userId)
      ),
      limit: 2000,
    }),
  ]);
  const messages = conversations.length
    ? await db.query.messages.findMany({
        where: inArray(
          schema.messages.conversationId,
          conversations.map(c => c.id)
        ),
        limit: 20000,
      })
    : [];
  return {
    exportedAt: new Date().toISOString(),
    profile: profile ? withoutSecrets(profile) : null,
    businessSettings: settings ? withoutSecrets(settings) : null,
    appointments: appointments.map(withoutSecrets),
    conversations: conversations.map(withoutSecrets),
    messages: messages.map(withoutSecrets),
  };
}
