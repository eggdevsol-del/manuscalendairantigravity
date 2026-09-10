import { afterEach, describe, expect, it, vi } from "vitest";
import {
  stripe,
  createArtistCheckoutSession,
  createPaymentRequestCheckoutSession,
  createStudioCheckoutSession,
  createStorefrontCheckoutSession,
} from "./stripe";
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
describe("Custom checkout server contract", () => {
  it.each([
    ["pro", 9900],
    ["studio", 49900],
  ] as const)(
    "returns an in-app client secret for %s with subscription metadata intact",
    async (tier, amount) => {
      vi.stubEnv(
        tier === "pro" ? "STRIPE_PRO_PRICE_ID" : "STRIPE_STUDIO_PRICE_ID",
        "price_test"
      );
      vi.spyOn(stripe.prices, "retrieve").mockResolvedValue({
        active: true,
        currency: "aud",
        unit_amount: amount,
        recurring: { interval: "month", interval_count: 1 },
      } as any);
      const create = vi
        .spyOn(stripe.checkout.sessions, "create")
        .mockResolvedValue({
          id: "cs_test",
          client_secret: "cs_test_secret",
        } as any);
      const result =
        tier === "pro"
          ? await createArtistCheckoutSession(
              "artist",
              "test@example.invalid",
              "price_test",
              "cus_test"
            )
          : await createStudioCheckoutSession("studio", "test@example.invalid");
      expect(result).toEqual({
        clientSecret: "cs_test_secret",
        sessionId: "cs_test",
      });
      const config = create.mock.calls[0][0];
      expect(config).toMatchObject({
        ui_mode: "custom",
        mode: "subscription",
        line_items: [{ price: "price_test", quantity: 1 }],
      });
      expect(config).not.toHaveProperty("success_url");
      expect(config).not.toHaveProperty("cancel_url");
      expect(config?.return_url).toContain("{CHECKOUT_SESSION_ID}");
      expect(config?.subscription_data?.metadata).toEqual(
        tier === "pro"
          ? { artistId: "artist", tier: "pro" }
          : { studioId: "studio" }
      );
    }
  );
  it("keeps payment requests custom and reuses the same idempotency key for retries", async () => {
    const create = vi
      .spyOn(stripe.checkout.sessions, "create")
      .mockResolvedValue({
        id: "cs_request",
        client_secret: "secret",
        url: null,
      } as any);
    const input = {
      requestId: 3,
      appointmentId: 8,
      amountCents: 10000,
      platformFeeCents: 300,
      artistFeeCents: 200,
      clientTotalCents: 10300,
      clientEmail: "client@example.invalid",
      artistName: "Artist",
      stripeConnectAccountId: "acct_artist",
      tier: "free",
      token: "request-token",
    };
    await createPaymentRequestCheckoutSession(input);
    await createPaymentRequestCheckoutSession(input);
    expect(create.mock.calls[0][0]).toMatchObject({
      ui_mode: "custom",
      mode: "payment",
      metadata: {
        type: "payment_request",
        requestId: "3",
        appointmentId: "8",
        baseAmountCents: "10000",
      },
      payment_intent_data: {
        application_fee_amount: 500,
        transfer_data: { destination: "acct_artist" },
      },
    });
    expect(create.mock.calls[0][0]).not.toHaveProperty("success_url");
    expect(create.mock.calls[0][1]).toEqual(create.mock.calls[1][1]);
    await createPaymentRequestCheckoutSession({
      ...input,
      previousSessionId: "cs_expired",
    });
    expect(create.mock.calls[2][1]).not.toEqual(create.mock.calls[0][1]);
  });
  it("keeps delivery, Connect fees and stock reservation metadata in custom store checkout", async () => {
    const create = vi
      .spyOn(stripe.checkout.sessions, "create")
      .mockResolvedValue({
        id: "cs_test",
        client_secret: "cs_test_secret",
        url: null,
      } as any);
    await createStorefrontCheckoutSession({
      orderId: 1,
      items: [{ productName: "Test", priceCents: 1000, quantity: 1 }],
      artistName: "Test",
      clientTotalCents: 1350,
      platformFeeCents: 50,
      artistFeeCents: 20,
      shippingCostCents: 300,
      fulfillmentMethod: "delivery",
      stripeConnectAccountId: "acct_test",
      slug: "test",
      stockReserved: true,
    });
    expect(create.mock.calls[0][0]).toMatchObject({
      ui_mode: "custom",
      metadata: { type: "store_order", orderId: "1", stockReserved: "1" },
      shipping_address_collection: {
        allowed_countries: ["AU", "NZ", "US", "GB", "CA"],
      },
      payment_intent_data: {
        application_fee_amount: 70,
        transfer_data: { destination: "acct_test" },
      },
    });
  });
});
