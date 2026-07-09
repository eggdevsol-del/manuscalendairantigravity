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
 *   new SW installed (waiting) ? pwa-update-available event
 *   ? this banner appears
 *   ? user taps "Update Now"
 *   ? triggerSWUpdate() ? SKIP_WAITING ? SW activates ? page reloads
 */
export function UpdateBanner() {
  const [visible, setVisible] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const onUpdate = () => {
      setVisible(true);
    };

    window.addEventListener("pwa-update-available", onUpdate);
    return () => window.removeEventListener("pwa-update-available", onUpdate);
  }, []);

  const handleUpdate = async () => {
    setUpdating(true);
    triggerSWUpdate();
    // Page will reload — no need to reset state
  };

  const handleDismiss = () => {
    setVisible(false);
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
          style={{
            position: "fixed",
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
            width: "calc(100% - 32px)",
            maxWidth: 420,
          }}
        >
          <div
            style={{
              background: "rgba(20, 20, 30, 0.92)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 16,
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <RefreshCw
                size={18}
                color="white"
                style={updating ? { animation: "spin 1s linear infinite" } : undefined}
              />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.95)",
                  lineHeight: 1.3,
                }}
              >
                Update available
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  color: "var(--color-text-secondary)",
                  lineHeight: 1.3,
                }}
              >
                A new version is ready to install
              </p>
            </div>

            <button
              onClick={handleDismiss}
              style={{
                background: "none",
                border: "none",
                color: "rgba(255,255,255,0.35)",
                fontSize: 13,
                cursor: "pointer",
                padding: "4px 6px",
                flexShrink: 0,
              }}
              aria-label="Dismiss update"
            >
              Later
            </button>

            <button
              onClick={handleUpdate}
              disabled={updating}
              style={{
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                border: "none",
                borderRadius: 8,
                color: "white",
                fontSize: 13,
                fontWeight: 600,
                padding: "8px 14px",
                cursor: updating ? "not-allowed" : "pointer",
                opacity: updating ? 0.7 : 1,
                flexShrink: 0,
                transition: "opacity 0.2s",
              }}
            >
              {updating ? "Updating..." : "Update Now"}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
