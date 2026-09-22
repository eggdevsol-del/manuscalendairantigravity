import { TRPCError } from "@trpc/server";
import jwt from "jsonwebtoken";
import { getAuthSecret } from "../_core/auth-secret";

export function masterDevIdentity(user: { id: string; role: string } | null) {
  return (
    !!process.env.MASTER_DEV_USER_ID &&
    user?.id === process.env.MASTER_DEV_USER_ID &&
    user.role === "master_dev"
  );
}
export function masterDevSession(
  user: { id: string; role: string } | null,
  authorization?: string
) {
  if (!masterDevIdentity(user) || !authorization?.startsWith("Bearer "))
    return false;
  try {
    const token = jwt.verify(authorization.slice(7), getAuthSecret(), {
      algorithms: ["HS256"],
    });
    return (
      typeof token !== "string" &&
      token.masterDev === true &&
      token.userId === user?.id
    );
  } catch {
    return false;
  }
}
export function accountEnabled(user: { role: string } | null) {
  return !!user && !user.role.startsWith("disabled_");
}

const attempts = new Map<string, { count: number; until: number }>();
export function masterDevLoginAttempt(key: string) {
  const now = Date.now();
  for (const [k, v] of attempts) if (v.until < now) attempts.delete(k);
  const entry = attempts.get(key) || { count: 0, until: now + 15 * 60_000 };
  if (++entry.count > 5)
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Try again in 15 minutes.",
    });
  attempts.set(key, entry);
}

export function createMasterDevToken(user: { id: string; role: string; email: string | null }) {
  if (!masterDevIdentity(user)) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
  return jwt.sign({ userId: user.id, email: user.email || "", masterDev: true }, getAuthSecret(), { expiresIn: "30m" });
}
