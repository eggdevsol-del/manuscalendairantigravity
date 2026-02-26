import { SignJWT } from "jose";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "dev-jwt-secret-for-testing-only";
const APP_ID = process.env.VITE_APP_ID || "artist_booking_app_dev";
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

async function createSessionToken(userId: string, name: string) {
  const issuedAt = Date.now();
  const expirationSeconds = Math.floor((issuedAt + ONE_YEAR_MS) / 1000);
  const secretKey = new TextEncoder().encode(JWT_SECRET);

  const token = await new SignJWT({
    openId: userId,
    appId: APP_ID,
    name: name,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expirationSeconds)
    .sign(secretKey);

  return token;
}

// Create tokens for both test users
(async () => {
  const artistToken = await createSessionToken(
    "test_artist_001",
    "P Mason Tattoo Artist"
  );
  const clientToken = await createSessionToken(
    "test_client_001",
    "Test Client"
  );

  console.log("Artist Session Token:");
  console.log(artistToken);
  console.log("\nClient Session Token:");
  console.log(clientToken);
  console.log(
    '\nTo use these tokens, set them as cookies named "vida_session" in your browser.'
  );
})();
