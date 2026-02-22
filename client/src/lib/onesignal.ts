import OneSignal from 'react-onesignal';
import { Capacitor } from '@capacitor/core';
// Re-added react-onesignal ONLY for SMS/Email campaign targeting.
// Web Push functionality is deliberately bypassed to allow custom VAPID SW to render Android UI.

const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID;

let isInitialized = false;

// Access the native OneSignal plugin if on Capacitor
const getNativeOneSignal = () => {
  if (!Capacitor.isNativePlatform()) return null;
  const os = (window as any).OneSignal || (window as any).plugins?.OneSignal;
  if (os) return os;
  // Fallback for some Capacitor/Cordova environments
  return (window as any).cordova?.plugins?.OneSignal;
};

export async function initializeOneSignal() {
  if (isInitialized || !ONESIGNAL_APP_ID) {
    if (!ONESIGNAL_APP_ID) console.warn('[OneSignal] Missing App ID');
    return;
  }

  // Helper to wait for plugin to be available
  const waitForPlugin = async (retries = 5): Promise<any> => {
    for (let i = 0; i < retries; i++) {
      const os = getNativeOneSignal();
      if (os) return os;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    return null;
  };

  try {
    if (Capacitor.isNativePlatform()) {
      console.log('[OneSignal] Initializing Native SDK...');
      const NativeOneSignal = await waitForPlugin();
      if (NativeOneSignal) {
        NativeOneSignal.Debug.setLogLevel(4);
        NativeOneSignal.initialize(ONESIGNAL_APP_ID);
        console.log('[OneSignal] Native SDK initialized successfully');
      } else {
        console.warn('[OneSignal] Native plugin not found. Falling back to CRM Web SDK.');
        await initWebOneSignal();
      }
    } else {
      console.log('[OneSignal] Initializing Web SDK for SMS/Email CRM ONLY. Push is handled by VAPID.');
      await initWebOneSignal();
    }

    isInitialized = true;
  } catch (error) {
    console.error('[OneSignal] Initialization failed:', error);
  }
}

async function initWebOneSignal() {
  try {
    await Promise.race([
      OneSignal.init({
        appId: ONESIGNAL_APP_ID,
        allowLocalhostAsSecureOrigin: true,
        // CRITICAL DECOUPLING: Do NOT supply `serviceWorkerPath`.
        // If we configure OneSignal for Web Push, its proprietary SW swallows the push events
        // and suppresses Android vibrate matrices. By omitting this, OneSignal tracks CRM
        // for SMS and Email, but completely ignores Push.
      }),
      new Promise<void>((_, reject) => setTimeout(() => reject(new Error('Web SDK init timed out')), 5000))
    ]);
    console.log('[OneSignal] CRM Web SDK initialized successfully.');
  } catch (error) {
    console.warn('[OneSignal] Web SDK initialization warning/timeout:', error);
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform()) {
      const NativeOneSignal = getNativeOneSignal();
      if (NativeOneSignal) {
        // Native methods occasionally hang on Android without returning a promise.
        // We wrap it in a race to guarantee the UI unlocks.
        return await Promise.race([
          NativeOneSignal.Notifications.requestPermission(true),
          new Promise<boolean>((resolve) => setTimeout(() => {
            console.warn('[OneSignal] Native requestPermission timed out');
            resolve(false);
          }, 3500))
        ]);
      }
    }

    // Core Web Push / PWA VAPID native prompt:
    if ('Notification' in window && !Capacitor.isNativePlatform()) {
      const nativeWebPerm = await window.Notification.requestPermission();
      console.log('[PushManager] Native Browser Web Prompt result:', nativeWebPerm);
      return nativeWebPerm === 'granted';
    }

    return false;
  } catch (error) {
    console.error('[OneSignal/PushManager] Permission request failed:', error);
    return false;
  }
}

export async function getSubscriptionId(): Promise<string | null> {
  try {
    if (Capacitor.isNativePlatform()) {
      const NativeOneSignal = getNativeOneSignal();
      if (NativeOneSignal) {
        return await Promise.race([
          NativeOneSignal.User.pushSubscription.getPushSubscriptionId(),
          new Promise<string | null>((resolve) => setTimeout(() => {
            console.warn('[OneSignal] Native getPushSubscriptionId timed out');
            resolve(null);
          }, 2000))
        ]);
      }
    }
    // Web SDK doesn't generate OneSignal IDs anymore
    return null;
  } catch (error) {
    console.error('[OneSignal] Failed to get subscription ID:', error);
    return null;
  }
}

export async function setExternalUserId(userId: string) {
  try {
    if (Capacitor.isNativePlatform()) {
      const NativeOneSignal = getNativeOneSignal();
      if (NativeOneSignal) {
        await Promise.race([
          NativeOneSignal.login(userId),
          new Promise<void>((resolve) => setTimeout(() => resolve(), 2000))
        ]);
        console.log('[OneSignal] Native external user ID set:', userId);
        return;
      }
    }

    // Web: Sync External ID to OneSignal for SMS/Email campaign targeting
    await OneSignal.login(userId);
    console.log('[OneSignal] CRM Web external user ID set:', userId);
  } catch (error) {
    console.error('[OneSignal] Failed to set external user ID:', error);
  }
}

export async function removeExternalUserId() {
  try {
    if (Capacitor.isNativePlatform()) {
      const NativeOneSignal = getNativeOneSignal();
      if (NativeOneSignal) {
        await Promise.race([
          NativeOneSignal.logout(),
          new Promise<void>((resolve) => setTimeout(() => resolve(), 2000))
        ]);
        return;
      }
    }

    // Web: Unbind External ID from OneSignal session
    await OneSignal.logout();
    console.log('[OneSignal] CRM Web external user ID removed');
  } catch (error) {
    console.error('[OneSignal] Failed to remove external user ID:', error);
  }
}

export async function isSubscribed(): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform()) {
      const NativeOneSignal = getNativeOneSignal();
      if (NativeOneSignal) {
        return await Promise.race([
          NativeOneSignal.Notifications.hasPermission(),
          new Promise<boolean>((resolve) => setTimeout(() => {
            console.warn('[OneSignal] Native hasPermission timed out');
            resolve(false);
          }, 2000))
        ]);
      }
    }

    // Core Web Push Check
    if ('serviceWorker' in navigator && 'PushManager' in window && !Capacitor.isNativePlatform()) {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      return !!sub;
    }

    return false;
  } catch (error) {
    console.error('[OneSignal/PushManager] Failed to check subscription status:', error);
    return false;
  }
}

export async function addTag(key: string, value: string) {
  try {
    if (Capacitor.isNativePlatform()) {
      const NativeOneSignal = getNativeOneSignal();
      if (NativeOneSignal) {
        NativeOneSignal.User.addTag(key, value);
        return;
      }
    }
  } catch (error) {
    console.error('[OneSignal] Failed to add tag:', error);
  }
}

export async function removeTag(key: string) {
  try {
    if (Capacitor.isNativePlatform()) {
      const NativeOneSignal = getNativeOneSignal();
      if (NativeOneSignal) {
        NativeOneSignal.User.removeTag(key);
        return;
      }
    }
  } catch (error) {
    console.error('[OneSignal] Failed to remove tag:', error);
  }
}

export function isOneSignalAvailable(): boolean {
  return !!getNativeOneSignal() || !!OneSignal;
}

