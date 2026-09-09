import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { useEffect } from "react";
const confirm = vi.fn();
const state = {
  type: "success",
  checkout: {
    email: "test@example.invalid",
    phoneNumber: null,
    shippingOptions: [] as unknown[],
    recurring: null as unknown,
    currency: "aud",
    total: { total: { minorUnitsAmount: 12345 } },
    confirm,
  },
};
vi.mock("@/lib/stripe", () => ({ stripePromise: Promise.resolve({}) }));
vi.mock("@stripe/react-stripe-js/checkout", () => ({
  CheckoutElementsProvider: ({ children }: any) => children,
  useCheckoutElements: () => state,
  PaymentElement: ({ onReady }: any) => {
    useEffect(() => {
      onReady();
    }, []);
    return <div>Secure session card fields</div>;
  },
  ShippingAddressElement: () => <div>Secure delivery address</div>,
}));
vi.mock("@stripe/react-stripe-js", () => ({
  Elements: () => <div>PaymentIntent Elements</div>,
  PaymentElement: () => null,
  useStripe: () => null,
  useElements: () => null,
}));
import { DotsCheckout } from "./DotsCheckout";
afterEach(cleanup);
beforeEach(() => {
  confirm.mockReset();
  state.checkout.recurring = null;
  state.checkout.shippingOptions = [];
});
describe("Custom Stripe checkout", () => {
  it("renders the branded form and provider total for a Session, even when the caller has no total", () => {
    render(
      <DotsCheckout
        clientSecret="cs_test_secret"
        amountCents={0}
        onComplete={() => {}}
      />
    );
    expect(screen.getByRole("button", { name: "Pay A$123.45" })).toBeTruthy();
    expect(screen.getByText("Secure session card fields")).toBeTruthy();
    expect(screen.queryByText("PaymentIntent Elements")).toBeNull();
    expect(screen.queryByLabelText("Phone")).toBeNull();
  });
  it("keeps deposit PaymentIntents on their existing integration", () => {
    render(
      <DotsCheckout
        clientSecret="pi_test_secret"
        amountCents={10000}
        onComplete={() => {}}
      />
    );
    expect(screen.getByText("PaymentIntent Elements")).toBeTruthy();
  });
  it("shows a decline without reporting payment completion and allows retry", async () => {
    confirm
      .mockResolvedValueOnce({
        type: "error",
        error: { message: "Your card was declined." },
      })
      .mockResolvedValueOnce({ type: "success" });
    const complete = vi.fn();
    render(
      <DotsCheckout
        clientSecret="cs_test_secret"
        amountCents={0}
        onComplete={complete}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Pay A$123.45" }));
    await screen.findByRole("alert");
    expect(complete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Pay A$123.45" }));
    await waitFor(() => expect(complete).toHaveBeenCalledTimes(1));
    expect(confirm).toHaveBeenCalledWith({ redirect: "if_required" });
  });
  it("discloses recurring charges and collects shipping only when configured", () => {
    state.checkout.recurring = {};
    state.checkout.shippingOptions = [{}];
    render(
      <DotsCheckout
        clientSecret="cs_test_secret"
        amountCents={0}
        onComplete={() => {}}
      />
    );
    expect(
      screen.getByRole("button", { name: "Subscribe for A$123.45/month" })
    ).toBeTruthy();
    expect(screen.getByText(/charged monthly until canceled/)).toBeTruthy();
    expect(screen.getByText("Secure delivery address")).toBeTruthy();
  });
});
