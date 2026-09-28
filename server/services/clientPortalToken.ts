import { SignJWT, jwtVerify } from "jose";
import { ENV } from "../_core/env";
const audience = "tattoi-client-portal";
function key() {
  if (ENV.cookieSecret.length < 32) throw new Error("A strong JWT_SECRET is required for client portal links.");
  return new TextEncoder().encode(ENV.cookieSecret);
}
export async function issuePortalToken(conversationId: number, clientId: string) {
  return new SignJWT({ conversationId }).setProtectedHeader({ alg: "HS256" }).setSubject(clientId)
    .setAudience(audience).setIssuer("tattoi").setIssuedAt().setExpirationTime("24h").sign(key());
}
export async function verifyPortalToken(token: string) {
  const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"], audience, issuer: "tattoi" });
  if (!payload.sub || !Number.isSafeInteger(payload.conversationId) || Number(payload.conversationId) <= 0) throw new Error("Invalid portal link");
  return { clientId: payload.sub, conversationId: Number(payload.conversationId) };
}
