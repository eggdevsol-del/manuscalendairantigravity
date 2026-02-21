import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { isSubscribed, requestNotificationPermission, setExternalUserId } from "@/lib/onesignal";
import { X, Bell } from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";

export function PushNotificationBanner() {
    const { user } = useAuth();
    const [show, setShow] = useState(false);

    useEffect(() => {
        // Only show if logged in, haven't dismissed, and not already subscribed
        if (!user) return;
        const dismissed = localStorage.getItem("push-banner-dismissed");
        if (dismissed === "true") return;

        isSubscribed().then(sub => {
            if (!sub) setShow(true);
        });
    }, [user]);

    if (!show) return null;

    const handleEnable = async () => {
        try {
            const granted = await requestNotificationPermission();
            if (granted) {
                if (user?.id) await setExternalUserId(user.id);
                setShow(false);
                toast.success("Push notifications enabled!");
            } else {
                // Only show error if we're not inside native capacitor wrapper which handles its own OS prompts
                if (!Capacitor.isNativePlatform()) {
                    toast.error("Permission denied. You may need to enable notifications in your browser settings.");
                }
                setShow(false);
                localStorage.setItem("push-banner-dismissed", "true");
            }
        } catch (e) {
            console.error("Error requesting permission", e);
            setShow(false);
        }
    };

    const handleDismiss = () => {
        setShow(false);
        localStorage.setItem("push-banner-dismissed", "true");
    };

    return (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-zinc-900 border-b border-primary/30 p-3 flex flex-row items-center justify-between gap-3 shadow-xl">
            <div className="flex items-center gap-3">
                <div className="bg-primary/20 p-2 rounded-full hidden sm:block">
                    <Bell className="w-5 h-5 text-primary shrink-0" />
                </div>
                <p className="text-sm font-medium text-white/90">
                    Enable notifications for important booking updates
                </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" onClick={handleEnable} className="text-xs h-8 bg-primary hover:bg-primary/90 text-white font-bold">
                    Enable
                </Button>
                <button onClick={handleDismiss} className="p-2 text-white/60 hover:text-white rounded-full transition-colors">
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
