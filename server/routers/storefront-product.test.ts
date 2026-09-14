// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({
  saved: null as Record<string, unknown> | null,
}));
vi.mock("../services/core", async importOriginal => {
  const original = await importOriginal<typeof import("../services/core")>();
  return {
    ...original,
    withDatabaseTransaction: async (work: any) =>
      work({
        query: {
          products: {
            findFirst: async () => ({
              id: 1,
              artistId: "artist",
              imageUrl: "https://example.test/old.png",
            }),
          },
        },
        select: () => ({
          from: () => ({ where: () => ({ for: async () => [] }) }),
        }),
        update: () => ({
          set: (data: Record<string, unknown>) => ({
            where: async () => {
              fixture.saved = data;
            },
          }),
        }),
      }),
  };
});
import { storefrontRouter } from "./storefront";
const caller = storefrontRouter.createCaller({
  user: { id: "artist", role: "artist" },
  req: {},
  res: {},
} as any);
const product = {
  id: 1,
  title: "Print",
  description: "",
  priceCents: 2000,
  inventoryCount: 5,
  fulfillmentType: "delivery" as const,
};
beforeEach(() => {
  fixture.saved = null;
});

describe("product image editing", () => {
  it("persists explicit image removal as null", async () => {
    await caller.updateProduct({ ...product, imageUrl: null });
    expect(fixture.saved).toMatchObject({ imageUrl: null });
  });
  it("preserves an existing image when an older caller omits the field", async () => {
    await caller.updateProduct(product);
    expect(fixture.saved).not.toHaveProperty("imageUrl");
  });
  it("rejects an invalid replacement URL before updating the product", async () => {
    await expect(
      caller.updateProduct({ ...product, imageUrl: "not-a-url" })
    ).rejects.toThrow();
    expect(fixture.saved).toBeNull();
  });
});
