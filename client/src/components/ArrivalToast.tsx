import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UserCheck, AlertTriangle } from "lucide-react";

/**
 * ArrivalToast — "Has [client] arrived?" popup
 *
 * Styled identically to UpdateBanner. Replaces the old AppointmentCheckInModal.
 * Shows two states:
 *   1. Initial: "Has [client] arrived?" → Yes / No
 *   2. No-show confirmation: "Mark as no-show?" → Cancel / Confirm
 */

interface ArrivalToastProps {
  clientName: string;
  onArrived: () => void;
  onNoShow: () => void;
  onDismiss: () => void;
  isOpen: boolean;
}

export function ArrivalToast({
  clientName,
  onArrived,
  onNoShow,
  onDismiss,
  isOpen,
}: ArrivalToastProps) {
  const [confirmingNoShow, setConfirmingNoShow] = useState(false);

  const handleYes = () => {
    setConfirmingNoShow(false);
    onArrived();
  };

  const handleNo = () => {
    setConfirmingNoShow(true);
  };

  const handleConfirmNoShow = () => {
    setConfirmingNoShow(false);
    onNoShow();
  };

  const handleCancelNoShow = () => {
    setConfirmingNoShow(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="arrival-toast"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+80px)] left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-32px)] max-w-[420px]"
        >
          <div className="bg-popover/95 backdrop-blur-[12px] border border-border rounded-[var(--radius-md)] p-[14px_16px] flex items-center gap-3 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
            {/* Icon */}
            <div
              className={`w-9 h-9 rounded-[var(--radius-sm)] flex items-center justify-center shrink-0 ${
                confirmingNoShow ? "bg-destructive" : "bg-primary"
              }`}
            >
              {confirmingNoShow ? (
                <AlertTriangle size={18} className="text-destructive-foreground" />
              ) : (
                <UserCheck size={18} className="text-primary-foreground" />
              )}
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="m-0 text-[14px] font-semibold text-foreground leading-[1.3]">
                {confirmingNoShow
                  ? "Mark as no-show?"
                  : "Client arrived?"}
              </p>
              <p className="m-0 text-[12px] text-muted-foreground leading-[1.3] truncate">
                {confirmingNoShow
                  ? `${clientName}'s deposit will be forfeited`
                  : clientName}
              </p>
            </div>

            {/* Buttons */}
            {confirmingNoShow ? (
              <>
                <button
                  onClick={handleCancelNoShow}
                  className="bg-transparent border-none text-muted-foreground text-[13px] cursor-pointer p-[4px_6px] shrink-0 hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmNoShow}
                  className="bg-destructive border-none rounded-[var(--radius-sm)] text-destructive-foreground text-[13px] font-semibold px-[14px] py-2 cursor-pointer shrink-0 transition-opacity hover:opacity-90 active:scale-[0.98]"
                >
                  Confirm
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleNo}
                  className="bg-transparent border-none text-muted-foreground text-[13px] cursor-pointer p-[4px_6px] shrink-0 hover:text-foreground transition-colors"
                >
                  No
                </button>
                <button
                  onClick={handleYes}
                  className="bg-primary border-none rounded-[var(--radius-sm)] text-primary-foreground text-[13px] font-semibold px-[14px] py-2 cursor-pointer shrink-0 transition-opacity hover:bg-primary/90 active:scale-[0.98]"
                >
                  Yes
                </button>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
