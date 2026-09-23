// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), save: vi.fn() }));
vi.mock("./publicStoreFetch", () => ({ parseStoreUrl: (url: string) => new URL(url), publicStoreFetch: mocks.fetch }));
vi.mock("../db", () => ({ getDb: async () => ({}) }));
vi.mock("./catalogueImport", () => ({ importCatalogue: mocks.save }));
import { scrapeForMerchant, syncStatusMap } from "./scraper";
beforeEach(() => { vi.resetAllMocks(); syncStatusMap.clear(); });
it("fetches the submitted public store and persists its actual catalogue for that supplier", async () => {
  const products = [{id:12,title:"Cartridges",variants:[{id:13,price:"20.00"}],images:[]}];
  mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify({products}),{headers:{"content-type":"application/json"}}));
  mocks.fetch.mockResolvedValueOnce(new Response("<html></html>"));
  await scrapeForMerchant(7,"supplier-user","https://supplier.example/collections/all");
  expect(mocks.fetch.mock.calls[0][0]).toBe("https://supplier.example/products.json?limit=250&page=1");
  expect(mocks.save).toHaveBeenCalledWith(7,"supplier-user","supplier.example",products);
  expect(syncStatusMap.get(7)).toMatchObject({status:"complete",count:1});
});
it("reports a failed import and saves nothing when the store blocks public catalogue access", async () => {
  mocks.fetch.mockImplementation(async () => new Response("Forbidden",{status:403}));
  await expect(scrapeForMerchant(7,"supplier-user","https://supplier.example")).rejects.toThrow("Could not find public products");
  expect(mocks.save).not.toHaveBeenCalled();
  expect(syncStatusMap.get(7)?.status).toBe("failed");
});
