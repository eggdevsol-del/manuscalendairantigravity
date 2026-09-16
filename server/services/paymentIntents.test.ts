// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { stripe } from "./stripe";
import {
  createDepositPaymentIntent,
  createBalancePaymentIntent,
  createStorefrontPaymentIntent,
} from "./paymentIntents";
import { calculateTransactionFees } from "../../shared/fees";
afterEach(() => vi.restoreAllMocks());
describe("direct payment amounts and fee routing", () => {
  it.each(["deposit", "balance", "store"] as const)(
    "includes the platform fee in the %s charge and retains both platform and seller fees",
    async kind => {
      const create = vi
        .spyOn(stripe.paymentIntents, "create")
        .mockResolvedValue({
          id: "pi_fixture",
          client_secret: "pi_fixture_secret",
        } as any);
      const fees = calculateTransactionFees(10000, "free");
      const common = {
        ...fees,
        clientEmail: "client@example.invalid",
        artistName: "Artist",
        stripeConnectAccountId: "acct_artist",
        tier: "free",
      };
      if (kind === "deposit")
        await createDepositPaymentIntent({
          ...common,
          leadId: 1,
          depositAmountCents: 10000,
          depositToken: "fixture",
          idempotencyKey: "deposit-fixture",
        });
      if (kind === "balance")
        await createBalancePaymentIntent({
          ...common,
          bookingId: 2,
          balanceAmountCents: 10000,
        });
      if (kind === "store")
        await createStorefrontPaymentIntent({
          ...common,
          orderId: 3,
          items: [{ productName: "Print", priceCents: 10000, quantity: 1 }],
        });
      const config = create.mock.calls[0][0]!;
      expect(config.amount).toBe(10500);
      expect(config.application_fee_amount).toBe(700);
      expect(config.transfer_data).toEqual({ destination: "acct_artist" });
      expect(config.metadata).toMatchObject({
        platformFeeCents: "500",
        artistFeeCents: "200",
      });
    }
  );
});
