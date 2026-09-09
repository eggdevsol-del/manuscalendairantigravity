import { render, screen } from "@testing-library/react";
import { vi, it, expect } from "vitest";
const state = vi.hoisted(() => ({ data: { status: "pending" } as any }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    storefront: { getOrderStatus: { useQuery: () => ({ data: state.data }) } },
  },
}));
import { OrderConfirmation, returnedOrder } from "./OrderConfirmation";
it("does not trust a success URL and only confirms recorded payment", () => {
  window.history.replaceState({}, "", "/?status=success");
  expect(returnedOrder()).toBeNull();
  const confirmed = vi.fn();
  const result = render(
    <OrderConfirmation
      identity={{ orderId: 1, sessionId: "cs_test" }}
      onConfirmed={confirmed}
    />
  );
  expect(screen.getByText("Confirming your order…")).toBeTruthy();
  expect(confirmed).not.toHaveBeenCalled();
  state.data = { status: "paid" };
  result.rerender(
    <OrderConfirmation
      identity={{ orderId: 1, sessionId: "cs_test" }}
      onConfirmed={confirmed}
    />
  );
  expect(screen.getByText("Order confirmed")).toBeTruthy();
  expect(confirmed).toHaveBeenCalledTimes(1);
});
