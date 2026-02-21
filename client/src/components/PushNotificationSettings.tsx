import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Switch } from "@/components/ui";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { requestNotificationPermission, isSubscribed, setExternalUserId, getSubscriptionId } from "@/lib/onesignal";
import { Bell, BellOff } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function PushNotificationSettings() {
  const { user } = useAuth();
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    checkSubscriptionStatus();
  }, []);

  const checkSubscriptionStatus = async () => {
    try {
      if ('Notification' in window) {
        setPermission(Notification.permission);
      }

      const subscribed = await isSubscribed();

      // Safety fix: If OneSignal reports true, upgrade UI permission
      if (subscribed && permission !== "granted") {
        setPermission("granted");
      }

      setIsEnabled(subscribed);
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
    setIsLoading(true);
    try {
      const granted = await requestNotificationPermission();

      if (granted) {
        setPermission("granted");

        // Set external user ID for targeting
        if (user?.id) {
          await setExternalUserId(user.id);
        }

        // Get subscription ID for verification
        const subscriptionId = await getSubscriptionId();
        console.log('[Notifications] Subscription ID:', subscriptionId);

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

