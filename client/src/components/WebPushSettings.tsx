import { useWebPush } from "@/hooks/useWebPush";
import { Button } from "@/components/ui";
import { Bell, BellOff, Send, Smartphone, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { Capacitor } from "@capacitor/core";

export function WebPushSettings({
  hideTestButton = false,
}: {
  hideTestButton?: boolean;
}) {
  const {
    status,
    subscription,
    subscribe,
    isSubscribing,
    sendTestPush,
    isTesting,
  } = useWebPush();

  // Feature flag check (optional, can also be done by parent)
  // Casting to string comparison to be safe with env types
  const enabled = import.meta.env.VITE_FEATURE_WEBPUSH_TEST === "true";

  if (!enabled) return null;

  return (
    <div className="p-4 rounded-[4px] bg-secondary/50 border border-border space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          Push Notifications
        </h3>
        <span
          className={cn(
            "text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border",
            status === "granted" && subscription
              ? "bg-[var(--color-status-success-bg)] text-[var(--color-success)] border-[var(--color-status-success-border)]"
              : status === "denied"
                ? "bg-[var(--color-status-danger-bg)] text-[var(--color-status-danger-text)] border-[var(--color-status-danger-border)]"
                : status === "unsupported"
                  ? "bg-[var(--color-status-neutral-bg)] text-[var(--color-status-neutral-text)] border-[var(--color-status-neutral-border)]"
                  : "bg-[var(--color-status-warning-bg)] text-[var(--color-status-warning-text)] border-yellow-500/20"
          )}
        >
          {status === "granted" && subscription
            ? "Active"
            : status === "default"
              ? "Ready"
              : status}
        </span>
      </div>

      {/* Platform Debug (only in dev/debug mode) */}
      {import.meta.env.DEV && (
        <div className="flex items-center gap-1.5 opacity-30 text-[9px] font-mono uppercase tracking-tighter">
          {Capacitor.getPlatform() === "web" ? (
            <Globe className="w-2 h-2" />
          ) : (
            <Smartphone className="w-2 h-2" />
          )}
          {Capacitor.getPlatform()} mode
        </div>
      )}

      <div className="space-y-2">
        {!subscription && status !== "denied" && status !== "unsupported" && (
          <Button
            size="sm"
            onClick={subscribe}
            disabled={isSubscribing}
            className="w-full bg-primary/20 hover:bg-primary/30 text-primary border border-primary/20"
          >
            {isSubscribing ? "Enabling..." : "Enable Notifications"}
          </Button>
        )}

        {subscription && !hideTestButton && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => sendTestPush()}
            disabled={isTesting}
            className="w-full"
          >
            <Send className="w-3 h-3 mr-2" />
            {isTesting ? "Sending..." : "Send Test Push"}
          </Button>
        )}

        {status === "denied" && (
          <p className="text-xs text-red-300">
            {Capacitor.getPlatform() === "web"
              ? "Notifications are blocked. Please enable them in your browser settings."
              : "Notifications are blocked. Please enable them in your system settings."}
          </p>
        )}

        {status === "unsupported" && (
          <p className="text-xs text-muted-foreground">
            Push notifications are not supported on this device/browser.
          </p>
        )}
      </div>
    </div>
  );
}
