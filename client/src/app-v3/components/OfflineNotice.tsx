import { useEffect, useState } from "react";
import { apiUrl } from "@/const";
import { Action } from "../design/primitives";
import "./offline-notice.css";

const isOffline = () =>
  typeof navigator !== "undefined" && navigator.onLine === false;

/**
 * One notice for every role, mounted once beside the app. It follows the
 * device's connection state and lets the person check again by hand.
 */
export function OfflineNotice({ onReconnect }: { onReconnect?: () => void }) {
  const [offline, setOffline] = useState(isOffline);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const online = () => {
      setOffline(false);
      onReconnect?.();
    };
    const lost = () => setOffline(true);
    window.addEventListener("online", online);
    window.addEventListener("offline", lost);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", lost);
    };
  }, [onReconnect]);

  if (!offline) return null;

  const retry = async () => {
    setChecking(true);
    // navigator.onLine can lag behind the real connection, so ask the server.
    let reachable = !isOffline();
    if (!reachable) {
      try {
        await fetch(apiUrl("/api/version"), { cache: "no-store" });
        reachable = true;
      } catch {
        reachable = false;
      }
    }
    setChecking(false);
    if (reachable) {
      setOffline(false);
      onReconnect?.();
    }
  };

  return (
    <div className="v3-offline" role="status" aria-live="polite">
      <p>You’re offline. Reconnect to continue.</p>
      <Action tone="secondary" disabled={checking} onClick={retry}>
        {checking ? "Checking…" : "Try again"}
      </Action>
    </div>
  );
}
