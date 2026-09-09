import { getAuthSecret } from "../_core/auth-secret";
/**
 * Deposit Token Service
 *
 * Generates and verifies HMAC-signed deposit tokens for secure,
 * stateless deposit payment links.
 *
 * Token format: {leadId}.{expiryTimestamp}.{hmacSignature}
 * - HMAC-SHA256 prevents tampering
 * - 48-hour expiry baked into the token
 * - No database storage needed — fully stateless
 */

import crypto from "crypto";

/** Token validity duration: 48 hours */
const TOKEN_EXPIRY_MS = 48 * 60 * 60 * 1000;

/**
 * Creates an HMAC signature for a leadId + expiry pair.
 */
function sign(leadId: number, expiry: number): string {
  return crypto
    .createHmac("sha256", getAuthSecret())
    .update(`${leadId}.${expiry}`)
    .digest("hex");
}

/**
 * Generates a secure deposit token for a given lead.
 *
 * @param leadId - The numeric lead ID
 * @returns A URL-safe token string
 */
export function createDepositToken(leadId: number): string {
  const expiry = Date.now() + TOKEN_EXPIRY_MS;
  const signature = sign(leadId, expiry);
  return `${leadId}.${expiry}.${signature}`;
}

/**
 * Verifies a deposit token and extracts the lead ID.
 *
 * @param token - The token string from the URL
 * @returns Object with validity status and lead ID (if valid)
 */
export function verifyDepositToken(
  token: string
): { valid: true; leadId: number } | { valid: false; reason: string } {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return { valid: false, reason: "Malformed token" };
  }

  const leadId = parseInt(parts[0], 10);
  const expiry = parseInt(parts[1], 10);
  const providedSignature = parts[2];
  if (!/^[a-f0-9]{64}$/i.test(providedSignature))
    return { valid: false, reason: "Invalid signature" };

  if (isNaN(leadId) || isNaN(expiry)) {
    return { valid: false, reason: "Invalid token data" };
  }

  // Check expiry
  if (Date.now() > expiry) {
    return { valid: false, reason: "Token has expired" };
  }

  // Verify HMAC signature (timing-safe comparison)
  const expectedSignature = sign(leadId, expiry);
  const isValid = crypto.timingSafeEqual(
    Buffer.from(providedSignature, "hex"),
    Buffer.from(expectedSignature, "hex")
  );

  if (!isValid) {
    return { valid: false, reason: "Invalid token signature" };
  }

  return { valid: true, leadId };
}

/** Balance links use a separate signature domain so a lead link cannot authorise a booking. */
export function createBalanceToken(bookingId: number): string {
  const expiry = Date.now() + TOKEN_EXPIRY_MS;
  const payload = `balance.${bookingId}.${expiry}`;
  return `${payload}.${crypto.createHmac("sha256", getAuthSecret()).update(payload).digest("hex")}`;
}
export function verifyBalanceToken(
  token: string
): { valid: true; bookingId: number } | { valid: false } {
  const [purpose, rawId, rawExpiry, signature, extra] = token.split(".");
  if (
    purpose !== "balance" ||
    extra ||
    !/^[1-9]\d*$/.test(rawId || "") ||
    !/^\d+$/.test(rawExpiry || "") ||
    !/^[a-f0-9]{64}$/.test(signature || "")
  )
    return { valid: false };
  const bookingId = Number(rawId);
  const expiry = Number(rawExpiry);
  if (
    !Number.isSafeInteger(bookingId) ||
    !Number.isSafeInteger(expiry) ||
    Date.now() >= expiry
  )
    return { valid: false };
  const expected = crypto
    .createHmac("sha256", getAuthSecret())
    .update(`balance.${rawId}.${rawExpiry}`)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expected, "hex")
  )
    ? { valid: true, bookingId }
    : { valid: false };
}
