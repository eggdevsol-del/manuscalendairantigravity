import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { triggerSWUpdate } from "@/lib/pwa";
import { RefreshCw } from "lucide-react";

/**
 * PWA Update Banner
 *
 * Listens for the "pwa-update-available" custom DOM event dispatched by pwa.ts
 * when a new service worker is waiting to activate.
 *
 * Shows a non-blocking banner at the bottom of the screen. The user chooses
 * when to apply the update — no mid-session surprises.
 *
 * Flow:
 *   new SW installed (waiting) → pwa-update-available event
 *   → this banner appears
 *   → user taps "Update Now"
 *   → triggerSWUpdate() → SKIP_WAITING → SW activates → page reloads
 */
export function UpdateBanner() {
  const [visible, setVisible] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onUpdate = () => {
      // Don't re-show if user already dismissed this session
      if (dismissed) return;
      setVisible(true);
    };

    window.addEventListener("pwa-update-available", onUpdate);
    return () => window.removeEventListener("pwa-update-available", onUpdate);
  }, [dismissed]);

  const handleUpdate = async () => {
    setUpdating(true);
    triggerSWUpdate();
    // If the page hasn't reloaded after 5 seconds, force a hard reload
    setTimeout(() => {
      window.location.href = window.location.href.split("?")[0] + "?_v=" + Date.now();
    }, 5000);
  };

  const handleDismiss = () => {
    setVisible(false);
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="update-banner"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+80px)] left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-32px)] max-w-[420px]"
        >
          <div className="bg-popover/95 backdrop-blur-[12px] border border-border rounded-[var(--radius-md)] p-[14px_16px] flex items-center gap-3 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
            <div className="w-9 h-9 rounded-[var(--radius-sm)] bg-primary flex items-center justify-center shrink-0">
              <RefreshCw
                size={18}
                className={`text-primary-foreground ${updating ? "animate-spin" : ""}`}
              />
            </div>

            <div className="flex-1 min-w-0">
              <p className="m-0 text-[14px] font-semibold text-foreground leading-[1.3]">
                Update available
              </p>
              <p className="m-0 text-[12px] text-muted-foreground leading-[1.3]">
                A new version is ready to install
              </p>
            </div>

            <button
              onClick={handleDismiss}
              className="bg-transparent border-none text-muted-foreground text-[13px] cursor-pointer p-[4px_6px] shrink-0 hover:text-foreground transition-colors"
              aria-label="Dismiss update"
            >
              Later
            </button>

            <button
              onClick={handleUpdate}
              disabled={updating}
              className="bg-primary border-none rounded-[var(--radius-sm)] text-primary-foreground text-[13px] font-semibold px-[14px] py-2 cursor-pointer shrink-0 transition-opacity hover:bg-primary/90 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {updating ? "Updating..." : "Update Now"}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
