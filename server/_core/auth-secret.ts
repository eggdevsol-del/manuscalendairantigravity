import { randomBytes } from "node:crypto";
const ephemeralSecret = randomBytes(48).toString("hex");
export function getAuthSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production")
    throw new Error("JWT_SECRET must contain at least 32 characters.");
  return ephemeralSecret;
}
