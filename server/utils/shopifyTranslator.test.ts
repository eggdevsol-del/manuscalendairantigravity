import { expect, it } from "vitest";
import { translateShopifyToTattoi } from "./shopifyTranslator";

it("keeps Shopify's product type as the store category", () => {
  const variants = [{ title: "Default Title", price: "20.00", sku: "" }];
  expect(
    translateShopifyToTattoi({ title: "Liner", product_type: " Cartridges ", variants }, "u1")
      .masterProduct.category
  ).toBe("Cartridges");
  expect(translateShopifyToTattoi({ title: "Liner", variants }, "u1").masterProduct.category).toBe("");
});
