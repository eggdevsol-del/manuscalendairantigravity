import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Switch } from "@/components/ui";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { requestNotificationPermission, isSubscribed, setExternalUserId, getSubscriptionId } from "@/lib/onesignal";
import { Bell, BellOff } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Capacitor } from '@capacitor/core';

// Helper to convert VAPID key
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Safe conversion for TS downlevelIteration
function arrayBufferToBase64(buffer: ArrayBuffer | null) {
  if (!buffer) return '';
  const binary = new Uint8Array(buffer);
  let str = '';
  for (let i = 0; i < binary.length; i++) {
    str += String.fromCharCode(binary[i]);
  }
  return btoa(str);
}

export default function PushNotificationSettings() {
  const { user } = useAuth();
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const utils = trpc.useUtils();
  const subscribeMutation = trpc.push.subscribe.useMutation();

  useEffect(() => {
    checkSubscriptionStatus();
  }, []);

  const checkSubscriptionStatus = async () => {
    try {
      let isNativePermissionGranted = false;
      if ('Notification' in window) {
        setPermission(Notification.permission);
        if (Notification.permission === 'granted') {
          isNativePermissionGranted = true;
          // Optimistically set enabled to prevent UI flashing off while OneSignal initializes
          setIsEnabled(true);
        }
      }

      const subscribed = await isSubscribed();

      // Safety fix: If OneSignal reports true, upgrade UI permission
      if (subscribed && permission !== "granted") {
        setPermission("granted");
      }

      setIsEnabled(isNativePermissionGranted || subscribed);
    } catch (error) {
      console.error('Failed to check subscription status:', error);
    }
  };

  const handleToggle = async (checked: boolean) => {
    if (checked) {
      await enableNotifications();
    } else {
      await disableNotifications();
    }
  };

  const enableNotifications = async () => {
    // Safari Security: DO NOT set loading state here.
    // Calling setState yields the JS thread and drops the "Transient Activation" click context.
    try {
      // Fire the native browser prompt instantly inside the raw click handler stack
      const granted = await requestNotificationPermission();

      // Now that the browser has answered, we can safely show loading spinners 
      // while we sync the player ID with the OneSignal backend cloud.
      setIsLoading(true);

      if (granted) {
        setPermission("granted");

        // Set external user ID for targeting
        if (user?.id) {
          await setExternalUserId(user.id);
        }

        // Get subscription ID for verification
        const subscriptionId = await getSubscriptionId();
        console.log('[Notifications] OneSignal Subscription ID:', subscriptionId);

        // --- VAPID Dual-Blast Fallback Registration for Web/PWA Users ---
        if (!Capacitor.isNativePlatform() && 'serviceWorker' in navigator && 'PushManager' in window) {
          try {
            const keyData = await utils.push.getPublicKey.fetch();
            if (keyData?.publicKey) {
              const registration = await navigator.serviceWorker.ready;
              const existingSub = await registration.pushManager.getSubscription();
              if (existingSub) await existingSub.unsubscribe();

              const sub = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
              });

              const p256dh = sub.getKey('p256dh');
              const auth = sub.getKey('auth');
              if (p256dh && auth) {
                await subscribeMutation.mutateAsync({
                  endpoint: sub.endpoint,
                  keys: {
                    p256dh: arrayBufferToBase64(p256dh),
                    auth: arrayBufferToBase64(auth),
                  },
                  userAgent: navigator.userAgent,
                });
                console.log('[Notifications] VAPID Web Push synced for dual-blast backend');
              }
            }
          } catch (vapidErr) {
            console.error('[Notifications] VAPID dual-blast registration failed (OneSignal may still work):', vapidErr);
          }
        }

        setIsEnabled(true);
        toast.success("Push notifications enabled!");
      } else {
        toast.error("Notification permission denied. Please enable in browser settings.");
      }
    } catch (error) {
      console.error("Failed to enable notifications:", error);
      toast.error("Failed to enable notifications");
    } finally {
      setIsLoading(false);
    }
  };

  const disableNotifications = async () => {
    setIsLoading(true);
    try {
      // Note: OneSignal doesn't provide a direct way to unsubscribe via SDK
      // Users need to manage this through browser settings
      toast.info("To disable notifications, please use your browser settings");
      setIsEnabled(false);
    } catch (error) {
      console.error("Failed to disable notifications:", error);
      toast.error("Failed to disable notifications");
    } finally {
      setIsLoading(false);
    }
  };

  if (!('Notification' in window)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5" />
            Push Notifications
          </CardTitle>
          <CardDescription>
            Push notifications are not supported in your browser
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Push Notifications
        </CardTitle>
        <CardDescription>
          Receive notifications about new messages and appointments
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-sm font-medium">Enable Notifications</div>
            <div className="text-sm text-muted-foreground">
              {permission === "denied"
                ? "Notifications are blocked. Please enable them in your browser settings."
                : "Get notified about important updates"}
            </div>
          </div>
          <Switch
            checked={isEnabled}
            onCheckedChange={handleToggle}
            disabled={isLoading || permission === "denied"}
          />
        </div>

        {permission === "denied" && (
          <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
            To enable notifications, go to your browser settings and allow notifications for this site.
          </div>
        )}

        {isEnabled && (
          <div className="text-sm text-muted-foreground bg-green-50 dark:bg-green-950 p-3 rounded-md">
            ✓ You'll receive push notifications for new messages and appointments
          </div>
        )}
      </CardContent>
    </Card>
  );
}

