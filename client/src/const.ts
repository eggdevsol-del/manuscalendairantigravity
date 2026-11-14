export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { isNativeApp } from "./lib/platform";

const configuredApiBase = (import.meta.env.VITE_API_BASE_URL || "")
  .trim()
  .replace(/\/+$/, "");

/**
 * True when the page was loaded from the web assets bundled in the binary
 * (capacitor://localhost on iOS, https://localhost on Android). A development
 * shell pointed at a server with CAPACITOR_SERVER_URL has that server's
 * origin instead, or a port, and its relative /api calls are correct.
 */
export const isBundledOrigin = (
  location: Pick<Location, "hostname" | "port"> | undefined = typeof window !==
  "undefined"
    ? window.location
    : undefined
) => !!location && location.hostname === "localhost" && !location.port;

/**
 * The bundled page origin is not the server, so a bundled native build must
 * be given an absolute HTTPS API base. main.tsx stops at first launch with a
 * clear message when this is true.
 */
export const NATIVE_API_BASE_MISSING =
  isNativeApp() &&
  isBundledOrigin() &&
  !/^https:\/\/[^/]+/.test(configuredApiBase);

export const NATIVE_API_BASE_MESSAGE =
  "This Tattoi build has no server address. Rebuild the web assets with VITE_API_BASE_URL set to the HTTPS address of the Tattoi server, then sync the native project again (see docs/NATIVE_BUILD.md).";

export const API_BASE_URL =
  configuredApiBase ||
  (typeof window !== "undefined"
    ? window.location.origin
    : "https://www.tattoi.app");

/** Absolute URL of a server path such as "/api/version". */
export const apiUrl = (path: string) => `${API_BASE_URL}${path}`;

/**
 * Origin to use for links other people open (booking links, share links,
 * payment return URLs). In a browser this is the page origin. In the native
 * app the page origin is not reachable from outside the device, so use
 * VITE_PUBLIC_WEB_URL, or the server that also hosts the web app.
 */
export const PUBLIC_WEB_ORIGIN = isNativeApp()
  ? (import.meta.env.VITE_PUBLIC_WEB_URL || "").trim().replace(/\/+$/, "") ||
    API_BASE_URL
  : typeof window !== "undefined"
    ? window.location.origin
    : API_BASE_URL;

export const APP_TITLE = import.meta.env.VITE_APP_TITLE || "Tattoi";

export const APP_LOGO =
  import.meta.env.VITE_APP_LOGO || `/veil-logo.png?v=${Date.now()}`;

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const origin = API_BASE_URL || window.location.origin;
  const redirectUri = `${origin}/api/oauth/callback`;
  if (!oauthPortalUrl || !appId) return "/login";
  const state = btoa(redirectUri);

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};
