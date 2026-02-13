export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { Capacitor } from "@capacitor/core";

export const API_BASE_URL = Capacitor.isNativePlatform()
  ? "https://artist-booking-app-production.up.railway.app"
  : ""; // Relative for web

export const APP_TITLE = import.meta.env.VITE_APP_TITLE || "Calendair";

export const APP_LOGO =
  import.meta.env.VITE_APP_LOGO ||
  `/veil-logo.png?v=${Date.now()}`;

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const origin = API_BASE_URL || window.location.origin;
  const redirectUri = `${origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};