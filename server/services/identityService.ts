import { eq } from "drizzle-orm";
import { users, leads } from "../../drizzle/schema";
import { getDb } from "./core";
import { Identity, normalizeName } from "../../shared/identity";

/**
 * Resolves an identity (User or Lead) into a unified Identity model.
 */
export async function resolveIdentity(
  id: string | number,
  type: "user" | "lead"
): Promise<Identity | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  try {
    if (type === "user") {
      const result = await db
        .select()
        .from(users)
        .where(eq(users.id, id as string))
        .limit(1);
      if (result.length === 0) return undefined;
      const user = result[0];
      const { firstName, lastName } = normalizeName(user.name);

      return {
        id: user.id,
        type: "user",
        name: user.name ?? "",
        firstName,
        lastName,
        email: user.email ?? undefined,
        phone: user.phone ?? undefined,
        birthday: user.birthday ?? undefined,
        avatar: user.avatar ?? undefined,
        role: user.role ?? undefined,
        clerkId: user.clerkId ?? undefined,
        hasPassword: !!user.password,
      };
    } else {
      const result = await db
        .select()
        .from(leads)
        .where(eq(leads.id, id as number))
        .limit(1);
      if (result.length === 0) return undefined;
      const lead = result[0];

      // Priority: clientFirstName/clientLastName > clientName parsing
      let firstName = lead.clientFirstName || "";
      let lastName = lead.clientLastName || "";

      if (!firstName && lead.clientName) {
        const normalized = normalizeName(lead.clientName);
        firstName = normalized.firstName;
        lastName = normalized.lastName;
      }

      return {
        id: lead.id,
        type: "lead",
        name: lead.clientName ?? `${firstName} ${lastName}`.trim(),
        firstName,
        lastName,
        email: lead.clientEmail,
        phone: lead.clientPhone ?? undefined,
        birthday: lead.clientBirthdate ?? undefined,
      };
    }
  } catch (error) {
    console.error(
      `[IdentityService] Failed to resolve identity (${type}:${id}):`,
      error
    );
    return undefined;
  }
}

export type CounterpartIdentity = Pick<
  Identity,
  "id" | "type" | "name" | "firstName" | "lastName" | "avatar" | "role"
> & { email?: string; phone?: string; unclaimed?: boolean };

/**
 * What the other person in a conversation may see of someone. Contact details
 * are added only when the caller has established the viewer is entitled to them;
 * sign-in details and birthday never leave the server this way.
 */
export function toCounterpartIdentity(
  identity: Identity,
  contact: { email?: boolean; phone?: boolean; unclaimed?: boolean } = {}
): CounterpartIdentity {
  return {
    id: identity.id,
    type: identity.type,
    name: identity.name,
    firstName: identity.firstName,
    lastName: identity.lastName,
    avatar: identity.avatar,
    role: identity.role,
    ...(contact.email && identity.email ? { email: identity.email } : {}),
    ...(contact.phone && identity.phone ? { phone: identity.phone } : {}),
    // A client record the viewing artist made that nobody has signed in to.
    ...(contact.unclaimed ? { unclaimed: true } : {}),
  };
}

/**
 * Attempts to find a user by email, and if not found, returns any matching lead.
 */
export async function findPersonByEmail(
  email: string
): Promise<Identity | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  // Try user first
  const userResult = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (userResult.length > 0) {
    return resolveIdentity(userResult[0].id, "user");
  }

  // Try lead
  const leadResult = await db
    .select()
    .from(leads)
    .where(eq(leads.clientEmail, email))
    .limit(1);
  if (leadResult.length > 0) {
    return resolveIdentity(leadResult[0].id, "lead");
  }

  return undefined;
}
