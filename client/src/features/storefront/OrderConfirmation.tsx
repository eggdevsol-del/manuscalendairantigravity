import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui";
export type OrderIdentity = { orderId: number; sessionId: string };
export function returnedOrder(): OrderIdentity | null {
  const params = new URLSearchParams(window.location.search);
  const orderId = Number(params.get("order_id")),
    sessionId = params.get("session_id") || "";
  return Number.isSafeInteger(orderId) &&
    orderId > 0 &&
    sessionId.startsWith("cs_")
    ? { orderId, sessionId }
    : null;
}
export function OrderConfirmation({
  identity,
  onConfirmed,
}: {
  identity: OrderIdentity;
  onConfirmed?: () => void;
}) {
  const query = trpc.storefront.getOrderStatus.useQuery(identity, {
    refetchInterval: query =>
      query.state.status === "error"
        ? false
        : query.state.data?.status && query.state.data.status !== "pending"
          ? false
          : 2000,
    retry: 1,
  });
  const confirmed =
    query.data?.status === "paid" || query.data?.status === "fulfilled";
  useEffect(() => {
    if (confirmed) onConfirmed?.();
  }, [confirmed]);
  return (
    <div className="space-y-4 py-6 text-center" role="status">
      <h2 className="text-2xl font-semibold">
        {confirmed
          ? "Order confirmed"
          : query.data?.status === "cancelled"
            ? "Checkout closed"
            : query.error
              ? "Confirmation unavailable"
              : "Confirming your order…"}
      </h2>
      <p className="text-sm text-muted-foreground">
        {confirmed
          ? `Payment for order #${identity.orderId} is recorded. Keep this order number for your records.`
          : query.data?.status === "cancelled"
            ? "This checkout has expired or been cancelled. Return to the store to start again."
            : query.error
              ? "We could not retrieve this order. Retry confirmation before starting another payment."
              : "We are waiting for payment confirmation. You can safely check this page again."}
      </p>
      {query.error && (
        <Button variant="outline" onClick={() => void query.refetch()}>
          Retry confirmation
        </Button>
      )}
    </div>
  );
}
