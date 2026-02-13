import OneSignal from 'react-onesignal';
import { Capacitor } from '@capacitor/core';

const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID;

let isInitialized = false;

// Access the native OneSignal plugin if on Capacitor
const getNativeOneSignal = () => (window as any).OneSignal;

export async function initializeOneSignal() {
  if (isInitialized || !ONESIGNAL_APP_ID) {
    console.log('[OneSignal] Already initialized or missing App ID');
    return;
  }

  try {
    if (Capacitor.isNativePlatform()) {
      const NativeOneSignal = getNativeOneSignal();
      if (NativeOneSignal) {
        NativeOneSignal.Debug.setLogLevel(4); // Verbose for debugging
        NativeOneSignal.initialize(ONESIGNAL_APP_ID);
        console.log('[OneSignal] Native SDK initialized');
      } else {
        console.warn('[OneSignal] Native plugin not found on window');
        // Fallback to web SDK might not work on native but we can try
        await initWebOneSignal();
      }
    } else {
      await initWebOneSignal();
    }

    isInitialized = true;
  } catch (error) {
    console.error('[OneSignal] Initialization failed:', error);
  }
}

async function initWebOneSignal() {
  await OneSignal.init({
    appId: ONESIGNAL_APP_ID,
    allowLocalhostAsSecureOrigin: true,
    serviceWorkerPath: '/sw.js',
    welcomeNotification: {
      title: "Thanks for subscribing!",
      message: "You'll receive notifications about new messages and appointments.",
    },
  });
  console.log('[OneSignal] Web SDK initialized');
}

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform()) {
      const NativeOneSignal = getNativeOneSignal();
      if (NativeOneSignal) {
        return await NativeOneSignal.Notifications.requestPermission(true);
      }
    }
    const permission = await OneSignal.Notifications.requestPermission();
    console.log('[OneSignal] Permission status:', permission);
    return permission;
  } catch (error) {
    console.error('[OneSignal] Permission request failed:', error);
    return false;
  }
}

export async function getSubscriptionId(): Promise<string | null> {
  try {
    if (Capacitor.isNativePlatform()) {
      const NativeOneSignal = getNativeOneSignal();
      if (NativeOneSignal) {
        return NativeOneSignal.User.pushSubscription.getPushSubscriptionId();
      }
    }
    const subscription = await OneSignal.User.PushSubscription.id;
    return subscription || null;
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
        NativeOneSignal.login(userId);
        console.log('[OneSignal] Native external user ID set:', userId);
        return;
      }
    }
    await OneSignal.login(userId);
    console.log('[OneSignal] Web external user ID set:', userId);
  } catch (error) {
    console.error('[OneSignal] Failed to set external user ID:', error);
  }
}

export async function removeExternalUserId() {
  try {
    if (Capacitor.isNativePlatform()) {
      const NativeOneSignal = getNativeOneSignal();
      if (NativeOneSignal) {
        NativeOneSignal.logout();
        return;
      }
    }
    await OneSignal.logout();
    console.log('[OneSignal] External user ID removed');
  } catch (error) {
    console.error('[OneSignal] Failed to remove external user ID:', error);
  }
}

export async function isSubscribed(): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform()) {
      const NativeOneSignal = getNativeOneSignal();
      if (NativeOneSignal) {
        return NativeOneSignal.Notifications.hasPermission();
      }
    }
    const permission = await OneSignal.Notifications.permission;
    return permission;
  } catch (error) {
    console.error('[OneSignal] Failed to check subscription status:', error);
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
    await OneSignal.User.addTag(key, value);
    console.log('[OneSignal] Tag added:', key, value);
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
    await OneSignal.User.removeTag(key);
    console.log('[OneSignal] Tag removed:', key);
  } catch (error) {
    console.error('[OneSignal] Failed to remove tag:', error);
  }
}

