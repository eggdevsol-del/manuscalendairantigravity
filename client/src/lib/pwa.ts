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
      immediate: true,
      onNeedRefresh() {
        console.log('[PWA] New content available! Updating immediately...');
        // Update immediately without user interaction
        updateSW(true);
      },
      onOfflineReady() {
        console.log('[PWA] App ready to work offline');
      },
      onRegistered(registration) {
        console.log('[PWA] Service Worker registered successfully');
        
        if (registration) {
          // Check for updates immediately on registration
          registration.update().catch(err => {
            console.error('[PWA] Initial update check failed:', err);
          });
          
          // Check for updates every 30 seconds (more aggressive)
          setInterval(() => {
            console.log('[PWA] Checking for updates...');
            registration.update().catch(err => {
              console.error('[PWA] Update check failed:', err);
            });
          }, 30000);
          
          // Also check when the page becomes visible
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
              console.log('[PWA] Page visible, checking for updates...');
              registration.update().catch(err => {
                console.error('[PWA] Visibility update check failed:', err);
              });
            }
          });
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
  if (!registration.active) return null;
  
  return new Promise((resolve) => {
    const messageChannel = new MessageChannel();
    messageChannel.port1.onmessage = (event) => {
      resolve(event.data?.version || null);
    };
    registration.active.postMessage({ type: 'GET_VERSION' }, [messageChannel.port2]);
    
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

/**
 * Show install prompt for PWA
 */
export function setupInstallPrompt() {
  let deferredPrompt: any = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    console.log('[PWA] Install prompt available');
  });

  return {
    showPrompt: async () => {
      if (!deferredPrompt) {
        console.log('[PWA] Install prompt not available');
        return false;
      }

      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log('[PWA] User choice:', outcome);
      deferredPrompt = null;
      return outcome === 'accepted';
    },
    isAvailable: () => deferredPrompt !== null,
  };
}

