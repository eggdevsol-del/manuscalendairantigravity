/**
 * Payment Request Token Service
 *
 * Generates and verifies HMAC-signed tokens for secure,
 * stateless payment request links.
 *
 * Token format: {requestId}.{expiryTimestamp}.{hmacSignature}
 * - HMAC-SHA256 prevents tampering
 * - 48-hour expiry baked into the token
 * - No database storage needed for verification — fully stateless
 *
 * Follows the same pattern as depositToken.ts
 */

import crypto from "crypto";

const TOKEN_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";

/** Token validity duration: 48 hours */
const TOKEN_EXPIRY_MS = 48 * 60 * 60 * 1000;

/**
 * Creates an HMAC signature for a requestId + expiry pair.
 */
function sign(requestId: number, expiry: number): string {
  return crypto
    .createHmac("sha256", TOKEN_SECRET)
    .update(`pr.${requestId}.${expiry}`)
    .digest("hex");
}

/**
 * Generates a secure payment request token.
 *
 * @param requestId - The numeric payment request ID
 * @returns A URL-safe token string
 */
export function createPaymentRequestToken(requestId: number): string {
  const expiry = Date.now() + TOKEN_EXPIRY_MS;
  const signature = sign(requestId, expiry);
  return `${requestId}.${expiry}.${signature}`;
}

/**
 * Verifies a payment request token and extracts the request ID.
 *
 * @param token - The token string from the URL
 * @returns Object with validity status and request ID (if valid)
 */
export function verifyPaymentRequestToken(
  token: string
): { valid: boolean; requestId?: number; expired?: boolean } {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return { valid: false };

    const requestId = parseInt(parts[0], 10);
    const expiry = parseInt(parts[1], 10);
    const providedSignature = parts[2];

    if (isNaN(requestId) || isNaN(expiry)) return { valid: false };

    // Check expiry
    if (Date.now() > expiry) {
      return { valid: false, requestId, expired: true };
    }

    // Verify HMAC
    const expectedSignature = sign(requestId, expiry);
    const isValid = crypto.timingSafeEqual(
      Buffer.from(providedSignature, "hex"),
      Buffer.from(expectedSignature, "hex")
    );

    return isValid ? { valid: true, requestId } : { valid: false };
  } catch {
    return { valid: false };
  }
}
