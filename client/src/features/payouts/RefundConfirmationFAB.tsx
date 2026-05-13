import React, { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { tokens } from "@/ui/tokens";
import { FABMenu } from "@/ui/FABMenu";

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

  if (!transaction) return null;

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

  const fab = tokens.fab;

  return (
    <FABMenu
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      toggleIcon={<AlertTriangle className="h-6 w-6 text-red-500" />}
      hideToggle={true}
      className="fixed bottom-[80px] right-5 z-[55] flex flex-col items-start gap-3"
      panelClassName="w-[320px] max-w-[calc(100vw-40px)]"
    >
      <div className="flex items-center gap-3 w-full pb-2 mb-2 border-b border-white/5">
        <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-4 h-4 text-red-500" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-foreground leading-tight">
            Confirm Refund
          </h2>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
            Cannot be undone
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 w-full">
        <div className="flex justify-between items-center text-xs">
          <span className="text-muted-foreground font-medium">Client</span>
          <span className="font-bold text-foreground">{transaction.clientName || "Guest"}</span>
        </div>
        
        <div className="flex justify-between items-center text-xs">
          <span className="text-muted-foreground font-medium">Type</span>
          <span className="font-bold text-foreground capitalize">{transaction.type}</span>
        </div>
        
        <div className="flex justify-between items-center text-sm border-t border-white/5 pt-2 mt-1">
          <span className="font-bold text-foreground">Refund Amount</span>
          <span className="font-black text-red-400">
            {formatCents(transaction.amountCents)}
          </span>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground text-center leading-relaxed mt-2 mb-2">
        The platform fee and connected account transfer will be automatically reversed.
      </p>

      <button
        onClick={handleRefund}
        disabled={isRefunding}
        className={cn(
          "w-full flex items-center justify-center py-3 rounded-[4px] text-xs font-bold uppercase tracking-wider transition-all active:scale-95",
          "bg-red-500/20 text-red-500 border border-red-500/30 hover:bg-red-500/30 disabled:opacity-50"
        )}
      >
        {isRefunding ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          "Confirm Refund"
        )}
      </button>
    </FABMenu>
  );
}
