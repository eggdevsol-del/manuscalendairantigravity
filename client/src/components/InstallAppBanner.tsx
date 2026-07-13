import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Capacitor } from "@capacitor/core";
import { X } from "lucide-react";

const DISMISS_KEY = "installPromptDismissed";

type Platform = "ios" | "android" | null;

function detectMobilePlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return null;
}

function isPWA(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches;
}

/**
 * InstallAppBanner
 *
 * Compact banner shown only on mobile browsers (not PWA, not Capacitor native,
 * not desktop) prompting users to install the native app.
 *
 * Mirrors UpdateBanner styling/animation patterns for visual consistency.
 */
export function InstallAppBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Gate: don't show on Capacitor native, PWA, or desktop
    if (Capacitor.isNativePlatform()) return;
    if (isPWA()) return;
    if (!detectMobilePlatform()) return;
    if (localStorage.getItem(DISMISS_KEY) === "true") return;

    const timer = setTimeout(() => setVisible(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, "true");
  };

  const platform = detectMobilePlatform();

  const storeLabel = platform === "ios" ? "App Store" : "Google Play";
  const storeUrl =
    platform === "ios"
      ? "https://apps.apple.com/app/instagram/id389801252"
      : "https://play.google.com/store/apps/details?id=com.instagram.android";

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="install-app-banner"
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed top-[calc(env(safe-area-inset-top,0px)+20px)] left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-32px)] max-w-[420px]"
        >
          <div className="bg-popover/95 backdrop-blur-[12px] border border-border rounded-2xl shadow-lg p-3 flex items-center gap-3">
            {/* App icon */}
            <div className="text-2xl shrink-0 leading-none" aria-hidden>
              📱
            </div>

            {/* Message */}
            <div className="flex-1 min-w-0">
              <p className="m-0 text-[13px] font-semibold text-foreground leading-[1.3]">
                Get TATTOI for the best experience
              </p>
            </div>

            {/* Dismiss */}
            <button
              onClick={handleDismiss}
              className="bg-transparent border-none text-muted-foreground cursor-pointer p-1 shrink-0 hover:text-foreground transition-colors"
              aria-label="Dismiss install prompt"
            >
              <X size={16} />
            </button>

            {/* Store link */}
            <a
              href={storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-primary border-none rounded-[var(--radius-sm)] text-primary-foreground text-[13px] font-semibold px-3 py-[6px] cursor-pointer shrink-0 transition-opacity hover:bg-primary/90 active:scale-[0.98] no-underline text-center"
            >
              {storeLabel}
            </a>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
