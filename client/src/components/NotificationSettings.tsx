import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import {
  requestNotificationPermission,
  isSubscribed,
  setExternalUserId,
  getSubscriptionId,
} from "@/lib/onesignal";
import { Bell, BellOff } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface NotificationSettingsProps {
  userId: string;
}

export function NotificationSettings({ userId }: NotificationSettingsProps) {
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSubscriptionStatus();
  }, []);

  const checkSubscriptionStatus = async () => {
    try {
      const status = await isSubscribed();
      setSubscribed(status);
    } catch (error) {
      console.error("Failed to check subscription status:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnableNotifications = async () => {
    setLoading(true);
    try {
      const granted = await requestNotificationPermission();

      if (granted) {
        // Set external user ID for targeting
        await setExternalUserId(userId);

        // Get subscription ID for verification
        const subscriptionId = await getSubscriptionId();
        console.log("[Notifications] Subscription ID:", subscriptionId);

        setSubscribed(true);
        toast.success("Push notifications enabled!");
      } else {
        toast.error(
          "Notification permission denied. Please enable in browser settings."
        );
      }
    } catch (error) {
      console.error("Failed to enable notifications:", error);
      toast.error("Failed to enable notifications");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Push Notifications</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Push Notifications</CardTitle>
        <CardDescription>
          Get notified about new messages, appointments, and updates
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {subscribed ? (
              <Bell className="w-5 h-5 text-primary" />
            ) : (
              <BellOff className="w-5 h-5 text-muted-foreground" />
            )}
            <div>
              <p className="font-medium">
                {subscribed
                  ? "Notifications Enabled"
                  : "Notifications Disabled"}
              </p>
              <p className="text-sm text-muted-foreground">
                {subscribed
                  ? "You'll receive push notifications for important updates"
                  : "Enable to receive real-time notifications"}
              </p>
            </div>
          </div>
          {!subscribed && (
            <Button onClick={handleEnableNotifications} disabled={loading}>
              Enable
            </Button>
          )}
        </div>

        {subscribed && (
          <div className="bg-muted p-3 rounded-lg text-sm">
            <p className="font-medium mb-2">You'll be notified about:</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• New messages from clients or artists</li>
              <li>• Appointment confirmations</li>
              <li>• Consultation requests</li>
              <li>• Important updates</li>
            </ul>
          </div>
        )}

        {!subscribed && (
          <p className="text-xs text-muted-foreground">
            Note: Push notifications require browser permission. You can manage
            this in your browser settings.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
