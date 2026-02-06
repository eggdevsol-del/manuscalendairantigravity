import { registerSW } from 'virtual:pwa-register';

/**
 * Register service worker for PWA functionality
 * 
 * This implementation uses aggressive update checking to ensure
 * users always get the latest version of the app.
 */
export async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    console.log('[PWA] Registering service worker...');

    const updateSW = registerSW({
      immediate: false, // Don't force immediate activation to prevent reload loops
      onNeedRefresh() {
        console.log('[PWA] New content available. User will be prompted to refresh.');
        // We'll let the UI handle the refresh prompt instead of automatic reloads
      },
      onOfflineReady() {
        console.log('[PWA] App ready to work offline');
      },
      onRegistered(registration) {
        console.log('[PWA] Service Worker registered successfully');

        if (registration) {
          // Check for updates every 60 seconds
          setInterval(() => {
            registration.update().catch(err => {
              console.error('[PWA] Update check failed:', err);
            });
          }, 60000);
        }
      },
      onRegisterError(error) {
        console.error('[PWA] SW registration error:', error);
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
  console.log('[PWA] Force updating app...');

  // Clear all caches
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    console.log('[PWA] Clearing caches:', cacheNames);
    await Promise.all(
      cacheNames.map(cacheName => caches.delete(cacheName))
    );
  }

  // Unregister all service workers
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    console.log('[PWA] Unregistering service workers:', registrations.length);
    await Promise.all(
      registrations.map(registration => registration.unregister())
    );
  }

  // Reload the page
  console.log('[PWA] Reloading page...');
  window.location.reload();
}

/**
 * Get current service worker version
 */
export async function getServiceWorkerVersion(): Promise<string | null> {
  if (!('serviceWorker' in navigator)) return null;

  const registration = await navigator.serviceWorker.ready;
  const activeWorker = registration.active;
  if (!activeWorker) return null;

  return new Promise((resolve) => {
    const messageChannel = new MessageChannel();
    messageChannel.port1.onmessage = (event) => {
      resolve(event.data?.version || null);
    };
    activeWorker.postMessage({ type: 'GET_VERSION' }, [messageChannel.port2]);

    // Timeout after 1 second
    setTimeout(() => resolve(null), 1000);
  });
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('[PWA] Notifications not supported');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
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
        'BEl62iUYgUivxIkv69yViEuiBIa-Ib37J8xQmrpcPBblQaw4MZu7SvTQBGWxsGNGRdQVLi5gPc4FLqx7wpIfDeU'
      ) as any,
    });

    console.log('[PWA] Push subscription successful:', subscription);
    return subscription;
  } catch (error) {
    console.error('[PWA] Push subscription failed:', error);
    return null;
  }
}

/**
 * Convert VAPID key to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

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
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

// Module-level variable to capture event even before React mounts
// This is critical because beforeinstallprompt often fires before our components are ready
let globalDeferredPrompt: any = null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    globalDeferredPrompt = e;
    console.log('[PWA] Global install prompt captured');
  });
}

/**
 * Show install prompt for PWA (Legacy)
 */
export function setupInstallPrompt() {
  return {
    showPrompt: async () => {
      if (!globalDeferredPrompt) {
        console.log('[PWA] Install prompt not available');
        return false;
      }

      globalDeferredPrompt.prompt();
      const { outcome } = await globalDeferredPrompt.userChoice;
      console.log('[PWA] User choice:', outcome);
      globalDeferredPrompt = null;
      return outcome === 'accepted';
    },
    isAvailable: () => globalDeferredPrompt !== null,
  };
}

