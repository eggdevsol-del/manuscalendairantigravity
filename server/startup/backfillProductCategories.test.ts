// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rows: [] as unknown[], sets: [] as unknown[], scrape: vi.fn() }));
vi.mock("../db", () => ({
  getDb: async () => ({
    select: () => ({ from: () => ({ where: async () => mocks.rows }) }),
    update: () => ({ set: (data: unknown) => ({ where: async () => { mocks.sets.push(data); } }) }),
  }),
}));
vi.mock("../services/scraper", () => ({ runStoreScraper: mocks.scrape }));
import { backfillProductCategories } from "./backfillProductCategories";
beforeEach(() => { vi.resetAllMocks(); mocks.rows = []; mocks.sets = []; });

it("gives each imported product its store's product type, or none when the store has none", async () => {
  mocks.rows = [
    { id: 1, externalId: "store:www.bstattoo.com.au:101" },
    { id: 2, externalId: "store:www.bstattoo.com.au:102" },
    { id: 3, externalId: "store:www.bstattoo.com.au:103" },
  ];
  mocks.scrape.mockResolvedValue({
    allProducts: [
      { id: 101, product_type: " Cartridges " },
      { id: 102, product_type: "" },
    ],
  });
  await backfillProductCategories();
  expect(mocks.scrape).toHaveBeenCalledWith("www.bstattoo.com.au");
  expect(mocks.sets).toEqual([{ category: "Cartridges" }, { category: "" }, { category: "" }]);
});

it("leaves products untouched when their store can't be reached, so the next start retries", async () => {
  mocks.rows = [{ id: 1, externalId: "store:https://shop.myshopify.com:101" }];
  mocks.scrape.mockRejectedValue(new Error("offline"));
  vi.spyOn(console, "error").mockImplementation(() => {});
  await backfillProductCategories();
  expect(mocks.scrape).toHaveBeenCalledWith("https://shop.myshopify.com");
  expect(mocks.sets).toEqual([]);
});
