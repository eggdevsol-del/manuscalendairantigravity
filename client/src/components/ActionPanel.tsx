/**
 * ActionPanel — Contextual bottom-sheet for page-specific actions.
 * 
 * SSOT: This is the ONLY component that renders the FAB button and action sheet.
 * Pages register their actions via useRegisterFABActions() in BottomNavContext.
 * 
 * This replaces the old CentralNavFAB as a navigation hub.
 * Settings have their own page — this panel is ONLY for:
 *   - Booking wizard
 *   - Project proposals
 *   - Deposit/balance payments
 *   - Any page-specific contextual actions
 */
import React, { useCallback } from "react";
import { Plus, X } from "lucide-react";
import { useBottomNav } from "@/contexts/BottomNavContext";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function ActionPanel() {
  const {
    fabActions,
    fabChildren,
    isFABOpen,
    setFABOpen,
    isLargePanel,
  } = useBottomNav();

  const hasActions = fabActions.length > 0 || fabChildren !== null;

  const handleToggle = useCallback(() => {
    setFABOpen(!isFABOpen);
  }, [isFABOpen, setFABOpen]);

  const handleClose = useCallback(() => {
    setFABOpen(false);
  }, [setFABOpen]);

  // Don't render FAB button if no actions registered
  if (!hasActions) return null;

  return (
    <>
      {/* Backdrop overlay */}
      <AnimatePresence>
        {isFABOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[3px]"
            onClick={handleClose}
          />
        )}
      </AnimatePresence>

      {/* Bottom sheet with actions */}
      <AnimatePresence>
        {isFABOpen && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className={cn(
              "fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.15)]",
              isLargePanel
                ? "max-h-[90dvh] h-[90dvh]"
                : "max-h-[60dvh]"
            )}
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>

            {/* If fabChildren is set (e.g. BookingWizardContent), render it directly */}
            {fabChildren ? (
              <div className="flex-1 overflow-y-auto overflow-x-hidden h-full" style={{ padding: 40 }}>
                {fabChildren}
              </div>
            ) : (
              /* Action items list */
              <div className="overflow-y-auto max-h-[calc(60dvh-40px)]" style={{ padding: 40 }}>
                {fabActions.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => {
                      action.onClick?.();
                      if (action.closeOnClick !== false) {
                        handleClose();
                      }
                    }}
                    className={cn(
                      "w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-colors hover:bg-gray-50 active:scale-[0.98]",
                      action.className
                    )}
                  >
                    {action.icon && (
                      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <action.icon className="w-5 h-5" />
                      </div>
                    )}
                    <span className="text-base font-medium text-foreground text-left">
                      {action.label}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Action Button — positioned above bottom nav */}
      <button
        onClick={handleToggle}
        className={cn(
          "fixed z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 active:scale-90",
          isFABOpen
            ? "bg-gray-200 text-gray-600 rotate-45"
            : "bg-primary text-white"
        )}
        style={{
          right: 20,
          bottom: "calc(56px + env(safe-area-inset-bottom, 0px) + 96px)",
        }}
        aria-label={isFABOpen ? "Close actions" : "Open actions"}
      >
        {isFABOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <Plus className="w-6 h-6" />
        )}
      </button>
    </>
  );
}
