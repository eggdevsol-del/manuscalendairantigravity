import { useEffect, useRef } from "react";
import { APP_VERSION, compareVersions } from "./version";
import { forceUpdate } from "./pwa";

/**
 * Checks the client's bundled version against the server's deployed version.
 *
 * Detection sources (fastest to slowest):
 *   1. X-App-Version header on every tRPC/API response — near-instant detection
 *      (handled in main.tsx tRPC link — triggers pwa-update-available event)
 *   2. /api/version poll every 30 seconds (reduced from 5 min) — catches cases
 *      where the app is idle and no API calls are being made
 *   3. On visibility change — user switches back to the app after being away
 *
 * On mismatch: dispatches "pwa-update-available" to show the update banner.
 * Falls back to forceUpdate() only if no SW is controlling the page (e.g.
 * first-load or SW completely missing) to guarantee the user gets the new version.
 */
export function useVersionCheck() {
  const checking = useRef(false);
  const notified = useRef(false);

  useEffect(() => {
    async function checkVersion() {
      if (checking.current || notified.current) return;
      checking.current = true;

      try {
        const res = await fetch("/api/version", {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });

        if (!res.ok) return;

        const data = await res.json();
        const serverVersion = data.version;

        if (!serverVersion) return;

        const cmp = compareVersions(APP_VERSION, serverVersion);

        if (cmp < 0) {
          console.log(
            `[VersionCheck] Client ${APP_VERSION} < Server ${serverVersion} — triggering update`
          );

          notified.current = true; // Only notify once per session

          // Prefer the banner flow (user-consented update) if a SW is active.
          // Fall back to forceUpdate() only if no SW is present.
          if (navigator.serviceWorker?.controller) {
            window.dispatchEvent(new CustomEvent("pwa-update-available"));
          } else {
            await forceUpdate();
          }
        } else {
          console.log(
            `[VersionCheck] Client ${APP_VERSION} matches server ${serverVersion}`
          );
        }
      } catch (err) {
        // Network error — skip silently (offline mode)
        console.debug("[VersionCheck] Check failed (offline?):", err);
      } finally {
        checking.current = false;
      }
    }

    // Check on boot
    checkVersion();

    // Check every 30 seconds (reduced from 5 minutes for faster deploy detection)
    const interval = setInterval(checkVersion, 30_000);

    // Check when user switches back to the app
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkVersion();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);
}
