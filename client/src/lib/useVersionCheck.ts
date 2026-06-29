import { useEffect, useRef } from "react";
import { APP_VERSION, compareVersions } from "./version";
import { forceUpdate } from "./pwa";

/**
 * Checks the client's bundled version against the server's deployed version.
 * If the server is newer, forces a cache clear + reload.
 *
 * Runs:
 * - Once on mount (app boot)
 * - Every 5 minutes while the app is open
 * - On visibility change (user switches back to the app)
 */
export function useVersionCheck() {
  const checking = useRef(false);

  useEffect(() => {
    async function checkVersion() {
      if (checking.current) return;
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
          // Client is older than server — force update
          console.log(
            `[VersionCheck] Client ${APP_VERSION} < Server ${serverVersion}, forcing update...`
          );
          await forceUpdate();
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

    // Check every 5 minutes
    const interval = setInterval(checkVersion, 5 * 60 * 1000);

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
