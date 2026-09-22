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
