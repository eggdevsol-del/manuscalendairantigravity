import { and, eq, inArray, isNotNull, or, sql, type SQL } from "drizzle-orm";
import {
  users,
  InsertUser,
  artistSettings,
  appointments,
  consultations,
  conversations,
  leads,
  messages,
  sessionPlans,
  studioMembers,
} from "../../drizzle/schema";
import { getDb } from "./core";
import { ENV } from "../_core/env";

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.id) {
    throw new Error("User ID is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      id: user.id,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = [
      "name",
      "email",
      "loginMethod",
      "phone",
      "avatar",
      "bio",
    ] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }

    if (user.role === undefined) {
      if (user.id === ENV.ownerId) {
        user.role = "admin";
        values.role = "admin";
        updateSet.role = "admin";
      }
    } else {
      values.role = user.role;
      updateSet.role = user.role;
    }

    if (user.hasCompletedOnboarding !== undefined) {
      values.hasCompletedOnboarding = user.hasCompletedOnboarding;
      updateSet.hasCompletedOnboarding = user.hasCompletedOnboarding;
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUser(id: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getArtists() {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get artists: database not available");
    return [];
  }

  // Join users with their artistSettings for enriched discovery data.
  // Every signed-in user can read this list: public fields only, never contact details.
  const result = await db
    .select({
      id: users.id,
      name: users.name,
      avatar: users.avatar,
      bio: users.bio,
      instagramUsername: users.instagramUsername,
      city: users.city,
      // from artistSettings
      businessName: artistSettings.businessName,
      displayName: artistSettings.displayName,
      businessAddress: artistSettings.businessAddress,
      funnelBannerUrl: artistSettings.funnelBannerUrl,
      keywords: artistSettings.keywords,
      publicSlug: artistSettings.publicSlug,
      lat: artistSettings.lat,
      lng: artistSettings.lng,
    })
    .from(users)
    .leftJoin(artistSettings, eq(artistSettings.userId, users.id))
    .where(eq(users.role, "artist"));

  return result;
}

// Ids given to client records an artist adds by hand or imports. Sign-up
// never produces these, so they mark a record as artist-made.
const ARTIST_MADE_ID = /^(client_|usr_imp_)/;

/**
 * Which of these people the artist really works with.
 *
 * `related` needs evidence the artist could not have produced alone:
 * - the client wrote in their conversation, sent a request or consultation
 *   from their own account, accepted a session plan, or paid by card; or
 * - the artist made the client record (added or imported it) and theirs was
 *   its first conversation.
 * A conversation row, an appointment the artist booked or a plan still
 * waiting on the client is not enough: the artist can create all of those
 * for any account. Only people with the client role are ever related.
 *
 * `unclaimed`: the artist-made records nobody has signed in to yet. Only
 * these may be edited by the artist.
 */
export async function getClientRelationships(
  database: any,
  artistId: string,
  clientIds: (string | null | undefined)[]
) {
  const related = new Set<string>();
  const unclaimed = new Set<string>();
  const requested = Array.from(
    new Set(clientIds.filter((id): id is string => !!id && id !== artistId))
  );
  if (requested.length === 0) return { related, unclaimed };

  const people: {
    id: string;
    loginMethod: string | null;
    signedIn: number | string | boolean | null;
  }[] = await database
    .selectDistinct({
      id: users.id,
      loginMethod: users.loginMethod,
      signedIn: sql<number>`(${users.password} is not null or ${users.clerkId} is not null or ${users.googleSub} is not null)`,
    })
    .from(users)
    .where(and(inArray(users.id, requested), eq(users.role, "client")));
  const ids = people.map(p => p.id);
  if (ids.length === 0) return { related, unclaimed };

  const clientsIn = (
    table: any,
    extra?: SQL
  ): Promise<{ clientId: string | null }[]> =>
    database
      .selectDistinct({ clientId: table.clientId })
      .from(table)
      .where(
        and(eq(table.artistId, artistId), inArray(table.clientId, ids), extra)
      );

  const [requestedWork, consulted, accepted, paid, threads] =
    await Promise.all([
      // leads.clientId and consultations.clientId are only filled in from the
      // client's own signed-in session.
      clientsIn(leads),
      clientsIn(consultations),
      clientsIn(sessionPlans, inArray(sessionPlans.status, ["accepted", "refunded"])),
      clientsIn(
        appointments,
        or(
          isNotNull(appointments.depositPaymentId),
          isNotNull(appointments.balancePaymentId)
        )
      ),
      // Every artist's conversation with these people: this artist's threads,
      // and who had the first one with each record.
      database
        .selectDistinct({
          id: conversations.id,
          artistId: conversations.artistId,
          clientId: conversations.clientId,
        })
        .from(conversations)
        .where(inArray(conversations.clientId, ids)) as Promise<
        { id: number; artistId: string; clientId: string | null }[]
      >,
    ]);
  for (const row of [...requestedWork, ...consulted, ...accepted, ...paid]) {
    if (row.clientId) related.add(row.clientId);
  }

  const mine = threads.filter(t => t.artistId === artistId && t.clientId);
  if (mine.length > 0) {
    const wrote: { conversationId: number; senderId: string }[] =
      await database
        .selectDistinct({
          conversationId: messages.conversationId,
          senderId: messages.senderId,
        })
        .from(messages)
        .where(
          and(
            inArray(
              messages.conversationId,
              mine.map(t => t.id)
            ),
            inArray(
              messages.senderId,
              Array.from(new Set(mine.map(t => t.clientId as string)))
            )
          )
        );
    for (const row of wrote) {
      const inOwnThread = mine.some(
        t => t.id === row.conversationId && t.clientId === row.senderId
      );
      if (inOwnThread) related.add(row.senderId);
    }
  }

  const firstThread = new Map<string, { id: number; artistId: string }>();
  for (const t of threads) {
    if (!t.clientId) continue;
    const first = firstThread.get(t.clientId);
    if (!first || t.id < first.id) firstThread.set(t.clientId, t);
  }
  for (const person of people) {
    if (!ARTIST_MADE_ID.test(person.id)) continue;
    if (firstThread.get(person.id)?.artistId !== artistId) continue;
    related.add(person.id);
    const neverSignedIn =
      !Number(person.signedIn) &&
      (person.loginMethod === null || person.loginMethod === "imported");
    if (neverSignedIn) unclaimed.add(person.id);
  }
  return { related, unclaimed };
}

export async function hasClientRelationship(
  database: any,
  artistId: string,
  clientId: string
) {
  const { related } = await getClientRelationships(database, artistId, [
    clientId,
  ]);
  return related.has(clientId);
}

/**
 * True when both people are active members of the same studio. A pending
 * invite does not count: the inviter chooses who that is.
 */
export async function shareStudio(database: any, a: string, b: string) {
  const rows: { studioId: string; userId: string }[] = await database
    .selectDistinct({
      studioId: studioMembers.studioId,
      userId: studioMembers.userId,
    })
    .from(studioMembers)
    .where(
      and(
        inArray(studioMembers.userId, [a, b]),
        eq(studioMembers.status, "active")
      )
    );
  const mine = new Set(rows.filter(r => r.userId === a).map(r => r.studioId));
  return rows.some(r => r.userId === b && mine.has(r.studioId));
}

export async function updateUserProfile(
  userId: string,
  updates: Partial<InsertUser>
) {
  const db = await getDb();
  if (!db) return undefined;

  // Sanitize: convert empty strings to null so MySQL date/text columns don't choke
  const sanitized = Object.fromEntries(
    Object.entries(updates).map(([key, value]) => [
      key,
      value === "" ? null : value,
    ])
  );

  await db.update(users).set(sanitized).where(eq(users.id, userId));
  return getUser(userId);
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user by email: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: string) {
  return getUser(id);
}

export async function createUser(user: InsertUser) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create user: database not available");
    return undefined;
  }

  try {
    console.log("[Database] Creating user:", {
      id: user.id,
      email: user.email,
      name: user.name,
    });
    await db.insert(users).values(user);
    console.log("[Database] User created successfully:", user.id);
    return getUser(user.id!);
  } catch (error) {
    console.error("[Database] Error creating user:", error);
    throw error;
  }
}

export async function updateUserLastSignedIn(userId: string) {
  const db = await getDb();
  if (!db) return;

  await db
    .update(users)
    .set({ lastSignedIn: new Date().toISOString().slice(0, 19).replace("T", " ") })
    .where(eq(users.id, userId));
}

export async function updateUserPassword(
  userId: string,
  hashedPassword: string
) {
  const db = await getDb();
  if (!db) return;

  await db
    .update(users)
    .set({ password: hashedPassword })
    .where(eq(users.id, userId));
}

// Push Subscriptions
import {
  pushSubscriptions,
  InsertPushSubscription,
} from "../../drizzle/schema";

export async function createPushSubscription(sub: InsertPushSubscription) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.insert(pushSubscriptions).values(sub);

  const inserted = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.id, Number(result[0].insertId)))
    .limit(1);

  return inserted[0];
}

export async function getPushSubscriptions(userId: string) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
}

export async function deletePushSubscription(id: number) {
  const db = await getDb();
  if (!db) return false;

  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, id));
  return true;
}
