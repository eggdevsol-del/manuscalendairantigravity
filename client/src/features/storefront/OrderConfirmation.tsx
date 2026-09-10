import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Action as Button } from "@/app-v3/design/primitives";
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
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), 60000);
    return () => clearTimeout(timer);
  }, [identity.orderId, identity.sessionId]);
  const query = trpc.storefront.getOrderStatus.useQuery(identity, {
    refetchInterval: query =>
      timedOut || query.state.status === "error"
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
    <div className="v3-stack" role="status">
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
      {confirmed &&
        query.data?.eventAccess?.map((event, index) => (
          <div key={index}>
            <strong>{event.title}</strong>
            {event.locationUrl &&
              (/^https:\/\//i.test(event.locationUrl) ? (
                <a
                  className="v3-action v3-action-secondary"
                  href={event.locationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {event.type === "virtual"
                    ? "Open event link"
                    : "View event location"}
                </a>
              ) : (
                <p>{event.locationUrl}</p>
              ))}
          </div>
        ))}
      {(query.error || (!confirmed && timedOut)) && (
        <Button tone="secondary" onClick={() => void query.refetch()}>
          Retry confirmation
        </Button>
      )}
    </div>
  );
}
