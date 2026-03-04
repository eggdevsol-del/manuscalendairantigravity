import { eq, or } from "drizzle-orm";
import { users, InsertUser } from "../../drizzle/schema";
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

    if (user.isOnboardingComplete !== undefined) {
      values.isOnboardingComplete = user.isOnboardingComplete;
      updateSet.isOnboardingComplete = user.isOnboardingComplete;
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

  const result = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      avatar: users.avatar,
      bio: users.bio,
      instagramUsername: users.instagramUsername,
    })
    .from(users)
    .where(eq(users.role, "artist"));

  return result;
}

export async function updateUserProfile(
  userId: string,
  updates: Partial<InsertUser>
) {
  const db = await getDb();
  if (!db) return undefined;

  await db.update(users).set(updates).where(eq(users.id, userId));
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
