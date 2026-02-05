import { useWebPush } from "@/hooks/useWebPush";
import { Button } from "@/components/ui";
import { Bell, BellOff, Send } from "lucide-react";
import { cn } from "@/lib/utils";

export function WebPushSettings() {
    const { status, subscription, subscribe, isSubscribing, sendTestPush, isTesting } = useWebPush();

    // Feature flag check (optional, can also be done by parent)
    // Casting to string comparison to be safe with env types
    const enabled = import.meta.env.VITE_FEATURE_WEBPUSH_TEST === 'true';

    if (!enabled) return null;

    return (
        <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Bell className="w-4 h-4 text-primary" />
                    Push Notifications (Test)
                </h3>
                <span className={cn(
                    "text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border",
                    status === 'granted' && subscription ? "bg-green-500/10 text-green-400 border-green-500/20" :
                        status === 'denied' ? "bg-red-500/10 text-red-400 border-red-500/20" :
                            status === 'unsupported' ? "bg-gray-500/10 text-gray-400 border-gray-500/20" :
                                "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                )}>
                    {status === 'granted' && subscription ? 'Active' : status}
                </span>
            </div>

            <div className="space-y-2">
                {(!subscription && status !== 'denied' && status !== 'unsupported') && (
                    <Button
                        size="sm"
                        onClick={subscribe}
                        disabled={isSubscribing}
                        className="w-full bg-primary/20 hover:bg-primary/30 text-primary border border-primary/20"
                    >
                        {isSubscribing ? 'Enabling...' : 'Enable Notifications'}
                    </Button>
                )}

                {subscription && (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={sendTestPush}
                        disabled={isTesting}
                        className="w-full"
                    >
                        <Send className="w-3 h-3 mr-2" />
                        {isTesting ? 'Sending...' : 'Send Test Push'}
                    </Button>
                )}

                {status === 'denied' && (
                    <p className="text-xs text-red-300">
                        Notifications are blocked. Please enable them in your browser settings.
                    </p>
                )}

                {status === 'unsupported' && (
                    <p className="text-xs text-muted-foreground">
                        Push notifications are not supported on this device/browser.
                    </p>
                )}
            </div>
        </div>
    );
}
