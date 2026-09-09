// @vitest-environment node
import { afterEach, describe, it, expect, vi } from "vitest";
import { createShopifyDraftOrder } from "./shopifyDraftOrder";
const order = {
  lineItems: [{ shopifyVariantId: "123", quantity: 2 }],
  note: "Order 42",
  retryTag: "tattoi-supplier-order-42",
};
const response = (data: unknown) => ({
  ok: true,
  json: async () => ({ data }),
});
afterEach(() => vi.unstubAllGlobals());
describe("Shopify draft retries", () => {
  it("reuses a matching remote draft after a local commit failure", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        response({
          draftOrders: {
            nodes: [
              {
                id: "gid://shopify/DraftOrder/7",
                name: "#D7",
                tags: [order.retryTag],
              },
            ],
          },
        })
      );
    vi.stubGlobal("fetch", fetch);
    expect(
      await createShopifyDraftOrder("store.myshopify.com", "test-token", order)
    ).toEqual({ draftOrderId: "7", draftOrderName: "#D7" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("tags a new draft so a retry can recover it", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response({ draftOrders: { nodes: [] } }))
      .mockResolvedValueOnce(
        response({
          draftOrderCreate: {
            draftOrder: { id: "gid://shopify/DraftOrder/8", name: "#D8" },
            userErrors: [],
          },
        })
      );
    vi.stubGlobal("fetch", fetch);
    await createShopifyDraftOrder("store", "test-token", order);
    const body = JSON.parse(fetch.mock.calls[1][1].body);
    expect(body.variables.input.tags).toContain(order.retryTag);
    expect(body.variables.input.lineItems).toEqual([
      { variantId: "gid://shopify/ProductVariant/123", quantity: 2 },
    ]);
  });
  it("fails closed if lookup fails, without submitting a new draft", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    vi.stubGlobal("fetch", fetch);
    await expect(
      createShopifyDraftOrder("store", "test-token", order)
    ).rejects.toThrow("503");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("never sends the merchant token to a supplied external host", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    for (const domain of [
      "evil.example",
      "store.myshopify.com.evil.example",
      "store.myshopify.com@evil.example",
      "store.myshopify.com/path",
    ])
      await expect(
        createShopifyDraftOrder(domain, "test-token", order)
      ).rejects.toThrow("domain");
    expect(fetch).not.toHaveBeenCalled();
  });
});
