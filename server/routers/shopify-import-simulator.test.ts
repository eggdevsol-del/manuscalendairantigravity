// @vitest-environment node
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({ values: vi.fn(), pending: false }));
vi.mock("../db", () => ({
  getDb: async () => ({
    query: {
      merchants: {
        findFirst: async () => ({ id: 7, userId: "merchant-test" }),
      },
      notificationOutbox: {
        findFirst: async () => (mocks.pending ? { id: 1, payloadJson: JSON.stringify({storeUrl:"https://example.com"}) } : undefined),
      },
    },
    insert: () => ({ values: mocks.values }),
  }),
}));
import { merchantAuthRouter } from "./merchantAuth";
const caller = (role = "merchant") =>
  merchantAuthRouter.createCaller({
    user: { id: "merchant-test", role },
    req: {},
    res: {},
  } as any);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.pending = false;
  mocks.values.mockResolvedValue([{ insertId: 2 }]);
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("ENABLE_SHOPIFY_IMPORT_SIMULATOR", "true");
});
afterEach(() => vi.unstubAllEnvs());
describe("simulated Shopify import boundary", () => {
  it("queues the existing scraper for the authenticated merchant only", async () => {
    const result = await caller().simulateShopifyImport({
      storeUrl: "https://example.com/products",
    });
    expect(result).toMatchObject({ jobId: 2, storeUrl: "https://example.com" });
    expect(mocks.values).toHaveBeenCalledWith({
      eventType: "public_catalogue_import",
      payloadJson: JSON.stringify({
        merchantId: 7,
        storeUrl: "https://example.com",
      }),
      status: "pending",
    });
  });
  it("rejects credentials and private URLs", async () => {
    await expect(
      caller().simulateShopifyImport({
        storeUrl: "https://example.com",
        password: "dummy",
      } as any)
    ).rejects.toThrow();
    await expect(
      caller().simulateShopifyImport({ storeUrl: "http://127.0.0.1" })
    ).rejects.toThrow();
    expect(mocks.values).not.toHaveBeenCalled();
  });
  it("requires merchant role and explicit production test mode", async () => {
    await expect(
      caller("artist").simulateShopifyImport({
        storeUrl: "https://example.com",
      })
    ).rejects.toThrow("Merchant access required");
    vi.stubEnv("ENABLE_SHOPIFY_IMPORT_SIMULATOR", "false");
    await expect(
      caller().simulateShopifyImport({ storeUrl: "https://example.com" })
    ).rejects.toThrow("disabled");
  });
  it("does not queue a duplicate while an import is pending", async () => {
    mocks.pending = true;
    expect(
      await caller().simulateShopifyImport({ storeUrl: "https://example.com" })
    ).toMatchObject({ alreadyQueued: true });
    expect(mocks.values).not.toHaveBeenCalled();
  });
});

it("does not silently substitute a pending import from another URL", async () => {
  mocks.pending = true;
  await expect(caller().simulateShopifyImport({storeUrl:"https://different.example"})).rejects.toThrow("Another store import");
  expect(mocks.values).not.toHaveBeenCalled();
});
