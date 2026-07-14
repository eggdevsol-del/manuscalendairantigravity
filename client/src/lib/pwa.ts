import { registerSW } from "virtual:pwa-register";

/**
 * Module-level reference to the updateSW function from vite-plugin-pwa.
 * Stored so the UpdateBanner can call it when the user taps "Update".
 */
let _pendingUpdateSW: ((reloadPage?: boolean) => Promise<void>) | null = null;


/**
 * Called by the UpdateBanner when the user taps the update button.
 *
 * With skipWaiting() in the SW, the new SW is already active by the time
 * the user sees the banner. We just need to reload to pick up the new JS.
 *
 * Priority order:
 *  1. _pendingUpdateSW — set by onNeedRefresh (edge case, workbox internal)
 *  2. registration.waiting — direct send if a waiting SW exists
 *  3. Simple reload — new SW is already active, just reload for new JS
 */
export async function triggerSWUpdate() {
  if (_pendingUpdateSW) {
    // Workbox-window handles SKIP_WAITING + controllerchange + reload
    _pendingUpdateSW(true);
    return;
  }

  // Check if a waiting SW exists (edge case)
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration?.waiting) {
      console.log("[PWA] Found waiting SW — sending SKIP_WAITING directly");
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        () => window.location.reload(),
        { once: true }
      );
      return;
    }
  } catch {
    // getRegistration failed — fall through
  }

  // Most common case with skipWaiting: new SW is already active.
  // Just reload the page to load the new JS bundle.
  console.log("[PWA] New SW already active — reloading to pick up new JS");
  window.location.reload();
}

/**
 * Register service worker for PWA functionality.
 *
 * Update strategy:
 * - New SW installs and immediately calls self.skipWaiting()
 * - The new SW activates, triggering a "controllerchange" event
 * - We detect this and dispatch "pwa-update-available" DOM event
 * - React UpdateBanner shows a non-blocking banner
 * - User taps "Update" → page reloads to load the new JS bundle
 */
export async function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    console.log("[PWA] Registering service worker...");

    // Detect when a new SW activates via skipWaiting() and takes control.
    // Since the SW calls self.skipWaiting() immediately, onNeedRefresh never fires.
    // Instead, we listen for controllerchange — this means a new SW is now active
    // and the page needs to reload to load the new JS bundle.
    let isFirstController = true;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      // Skip the initial controller assignment on first page load
      if (isFirstController) {
        isFirstController = false;
        return;
      }
      console.log("[PWA] New SW activated via skipWaiting — showing update banner");
      window.dispatchEvent(new CustomEvent("pwa-update-available"));
    });

    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        // This may still fire in some edge cases (e.g., workbox internal detection)
        console.log("[PWA] New version available (onNeedRefresh) — showing update banner");
        _pendingUpdateSW = updateSW;
        window.dispatchEvent(new CustomEvent("pwa-update-available"));
      },
      onOfflineReady() {
        console.log("[PWA] App ready to work offline");
      },
      onRegistered(registration) {
        console.log("[PWA] Service Worker registered successfully");

        if (registration) {
          // Check for SW updates every 30 seconds (reduced from 60s for faster deploy detection)
          setInterval(() => {
            registration.update().catch(err => {
              console.error("[PWA] Update check failed:", err);
            });
          }, 30_000);

          // Also check on page visibility change (user switches back to the app)
          document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") {
              registration.update().catch(err => {
                console.error("[PWA] Visibility update check failed:", err);
              });
            }
          });
        }
      },
      onRegisterError(error) {
        console.error("[PWA] SW registration error:", error);
      },
    });

    return updateSW;
  }
}

/**
 * Force clear all caches and reload
 * Call this when you need to force an update
 */
export async function forceUpdate(): Promise<void> {
  console.log("[PWA] Force updating app...");

  // Clear all caches
  if ("caches" in window) {
    const cacheNames = await caches.keys();
    console.log("[PWA] Clearing caches:", cacheNames);
    await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
  }

  // Unregister all service workers
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    console.log("[PWA] Unregistering service workers:", registrations.length);
    await Promise.all(
      registrations.map(registration => registration.unregister())
    );
  }

  // Reload with a cache-busting query param to bypass browser disk cache
  console.log("[PWA] Reloading page...");
  window.location.href = window.location.href.split("?")[0] + "?_v=" + Date.now();
}

/**
 * Get current service worker version
 */
export async function getServiceWorkerVersion(): Promise<string | null> {
  if (!("serviceWorker" in navigator)) return null;

  const registration = await navigator.serviceWorker.ready;
  const activeWorker = registration.active;
  if (!activeWorker) return null;

  return new Promise(resolve => {
    const messageChannel = new MessageChannel();
    messageChannel.port1.onmessage = event => {
      resolve(event.data?.version || null);
    };
    activeWorker.postMessage({ type: "GET_VERSION" }, [messageChannel.port2]);

    // Timeout after 1 second
    setTimeout(() => resolve(null), 1000);
  });
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) {
    console.warn("[PWA] Notifications not supported");
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }

  return false;
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPushNotifications(
  registration: ServiceWorkerRegistration
): Promise<PushSubscription | null> {
  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        // This is a placeholder VAPID public key - in production, generate your own
        "BEl62iUYgUivxIkv69yViEuiBIa-Ib37J8xQmrpcPBblQaw4MZu7SvTQBGWxsGNGRdQVLi5gPc4FLqx7wpIfDeU"
      ) as any,
    });

    console.log("[PWA] Push subscription successful:", subscription);
    return subscription;
  } catch (error) {
    console.error("[PWA] Push subscription failed:", error);
    return null;
  }
}

/**
 * Convert VAPID key to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Check if app is running as PWA
 */
export function isPWA(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

// Module-level variable to capture event even before React mounts
// This is critical because beforeinstallprompt often fires before our components are ready
let globalDeferredPrompt: any = null;

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    globalDeferredPrompt = e;
    console.log("[PWA] Global install prompt captured");
  });
}

/**
 * Show install prompt for PWA (Legacy)
 */
export function setupInstallPrompt() {
  return {
    showPrompt: async () => {
      if (!globalDeferredPrompt) {
        console.log("[PWA] Install prompt not available");
        return false;
      }

      globalDeferredPrompt.prompt();
      const { outcome } = await globalDeferredPrompt.userChoice;
      console.log("[PWA] User choice:", outcome);
      globalDeferredPrompt = null;
      return outcome === "accepted";
    },
    isAvailable: () => globalDeferredPrompt !== null,
  };
}
