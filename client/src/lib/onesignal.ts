import OneSignal from 'react-onesignal';

const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID;

let isInitialized = false;

export async function initializeOneSignal() {
  if (isInitialized || !ONESIGNAL_APP_ID) {
    console.log('[OneSignal] Already initialized or missing App ID');
    return;
  }

  try {
    await OneSignal.init({
      appId: ONESIGNAL_APP_ID,
      allowLocalhostAsSecureOrigin: true, // For development
      serviceWorkerPath: '/sw.js', // Unified with PWA
      welcomeNotification: {
        title: "Thanks for subscribing!",
        message: "You'll receive notifications about new messages and appointments.",
      },
    });

    isInitialized = true;
    console.log('[OneSignal] Initialized successfully');
  } catch (error) {
    console.error('[OneSignal] Initialization failed:', error);
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  try {
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
    const subscription = await OneSignal.User.PushSubscription.id;
    return subscription || null;
  } catch (error) {
    console.error('[OneSignal] Failed to get subscription ID:', error);
    return null;
  }
}

export async function setExternalUserId(userId: string) {
  try {
    await OneSignal.login(userId);
    console.log('[OneSignal] External user ID set:', userId);
  } catch (error) {
    console.error('[OneSignal] Failed to set external user ID:', error);
  }
}

export async function removeExternalUserId() {
  try {
    await OneSignal.logout();
    console.log('[OneSignal] External user ID removed');
  } catch (error) {
    console.error('[OneSignal] Failed to remove external user ID:', error);
  }
}

export async function isSubscribed(): Promise<boolean> {
  try {
    const permission = await OneSignal.Notifications.permission;
    return permission;
  } catch (error) {
    console.error('[OneSignal] Failed to check subscription status:', error);
    return false;
  }
}

export async function addTag(key: string, value: string) {
  try {
    await OneSignal.User.addTag(key, value);
    console.log('[OneSignal] Tag added:', key, value);
  } catch (error) {
    console.error('[OneSignal] Failed to add tag:', error);
  }
}

export async function removeTag(key: string) {
  try {
    await OneSignal.User.removeTag(key);
    console.log('[OneSignal] Tag removed:', key);
  } catch (error) {
    console.error('[OneSignal] Failed to remove tag:', error);
  }
}

