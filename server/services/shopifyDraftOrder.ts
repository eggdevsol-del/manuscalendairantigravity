/** Shopify Admin GraphQL 2026-07. A stable tag recovers drafts after a local retry. */
export async function createShopifyDraftOrder(
  shopDomain: string,
  accessToken: string,
  order: {
    lineItems: { shopifyVariantId: string; quantity: number }[];
    shippingAddress?: {
      first_name: string;
      last_name: string;
      address1: string;
      address2?: string;
      city: string;
      province: string;
      zip: string;
      country: string;
    };
    note: string;
    email?: string;
    retryTag: string;
  }
): Promise<{ draftOrderId: string; draftOrderName: string }> {
  let domain = shopDomain
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  if (!domain.includes(".")) domain += ".myshopify.com";
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(domain))
    throw new Error("Use the store’s myshopify.com domain.");
  if (!/^tattoi-supplier-order-\d+$/.test(order.retryTag))
    throw new Error("Invalid order retry identity.");
  const request = async (query: string, variables: unknown) => {
    const response = await fetch(
      `https://${domain}/admin/api/2026-07/graphql.json`,
      {
        method: "POST",
        signal: AbortSignal.timeout(15000),
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, variables }),
      }
    );
    if (!response.ok)
      throw new Error(`Shopify request failed (${response.status}).`);
    const body = await response.json();
    if (body.errors?.length || !body.data)
      throw new Error(
        "Shopify rejected the request. Check app permissions and configuration."
      );
    return body.data;
  };
  const found = await request(
    "query ExistingDraft($query: String!) { draftOrders(first: 2, query: $query) { nodes { id name tags } } }",
    { query: `tag:${order.retryTag}` }
  );
  const matches = found.draftOrders.nodes.filter((node: any) =>
    node.tags?.includes(order.retryTag)
  );
  if (matches.length > 1)
    throw new Error(
      "Multiple Shopify drafts match this order; review required."
    );
  let draft = matches[0];
  if (!draft) {
    if (
      !order.lineItems.length ||
      order.lineItems.some(
        item =>
          !/^\d+$/.test(item.shopifyVariantId) ||
          !Number.isInteger(item.quantity) ||
          item.quantity < 1
      )
    )
      throw new Error("Order has invalid Shopify variants or quantities.");
    const a = order.shippingAddress;
    const input = {
      lineItems: order.lineItems.map(item => ({
        variantId: `gid://shopify/ProductVariant/${item.shopifyVariantId}`,
        quantity: item.quantity,
      })),
      note: order.note,
      email: order.email,
      tags: ["tattoi", "marketplace-order", order.retryTag],
      ...(a
        ? {
            shippingAddress: {
              firstName: a.first_name,
              lastName: a.last_name,
              address1: a.address1,
              address2: a.address2,
              city: a.city,
              provinceCode: a.province,
              zip: a.zip,
              countryCode: a.country,
            },
          }
        : {}),
    };
    const data = await request(
      "mutation CreateDraft($input: DraftOrderInput!) { draftOrderCreate(input: $input) { draftOrder { id name } userErrors { field message } } }",
      { input }
    );
    if (
      data.draftOrderCreate.userErrors?.length ||
      !data.draftOrderCreate.draftOrder
    )
      throw new Error(
        "Shopify could not create the draft. Check variants, address and permissions."
      );
    draft = data.draftOrderCreate.draftOrder;
  }
  return {
    draftOrderId: draft.id.split("/").pop(),
    draftOrderName: draft.name,
  };
}
