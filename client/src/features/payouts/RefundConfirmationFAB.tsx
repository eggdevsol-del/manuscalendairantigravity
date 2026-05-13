import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { tokens } from "@/_core/theme";

interface RefundConfirmationFABProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: any | null;
  onSuccess: () => void;
}

export function RefundConfirmationFAB({
  isOpen,
  onClose,
  transaction,
  onSuccess,
}: RefundConfirmationFABProps) {
  const [isRefunding, setIsRefunding] = useState(false);
  const refundMutation = trpc.payouts.refundTransaction.useMutation();

  if (!isOpen || !transaction) return null;

  const handleRefund = async () => {
    setIsRefunding(true);
    try {
      await refundMutation.mutateAsync({ ledgerId: transaction.id });
      toast.success("Refund processed successfully");
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to process refund");
    } finally {
      setIsRefunding(false);
    }
  };

  const formatCents = (cents: number) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
    }).format(cents / 100);

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 z-50 flex justify-center w-full px-4 pb-6"
          >
            <div
              className={cn(
                tokens.card.base,
                tokens.card.bg,
                tokens.card.border,
                "w-full max-w-md p-6 shadow-2xl space-y-6"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-foreground">
                      Confirm Refund
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      This action cannot be undone.
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-white/5 rounded-xl p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Client:</span>
                  <span className="font-medium">{transaction.clientName || "Guest"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Type:</span>
                  <span className="font-medium capitalize">{transaction.type}</span>
                </div>
                <div className="flex justify-between text-base border-t border-white/10 pt-3 mt-3">
                  <span className="font-semibold">Refund Amount:</span>
                  <span className="font-bold text-red-400">
                    {formatCents(transaction.amountCents)}
                  </span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                The platform fee and connected account transfer will be automatically reversed.
              </p>

              <button
                onClick={handleRefund}
                disabled={isRefunding}
                className="w-full flex items-center justify-center h-12 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 transition-colors disabled:opacity-50"
              >
                {isRefunding ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "Confirm Refund"
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
