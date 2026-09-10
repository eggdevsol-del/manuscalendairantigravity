import { RefundSheet } from "@/app-v3/pages/PayoutHistory";
/** Compatibility for remaining legacy callers; shares the verified refund review. */
export function RefundConfirmationFAB({
  isOpen,
  onClose,
  transaction,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  transaction: { id: number } | null;
  onSuccess: () => void;
}) {
  return isOpen && transaction ? (
    <RefundSheet
      ledgerId={transaction.id}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  ) : null;
}
