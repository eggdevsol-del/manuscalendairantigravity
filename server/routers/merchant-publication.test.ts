// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ status: "pending", publishedProduct: true, listings: [] as any[], insert: vi.fn(), update: vi.fn() }));
vi.mock("../services/core", async original => ({
  ...await original<any>(),
  withDatabaseTransaction: async (work: any) => work({
    select: () => ({ from: () => ({ where: () => ({ for: async () => [{id:7,userId:"supplier",businessName:"BS Tattoo",country:"AU",status:f.status}] }) }) }),
    query: { suppliers: { findMany: async () => f.listings }, products: { findFirst: async () => f.publishedProduct ? {id:1} : undefined } },
    insert: () => ({ values: f.insert }),
    update: () => ({ set: (data: any) => ({ where: async () => f.update(data) }) }),
  }),
}));
import { merchantAuthRouter } from "./merchantAuth";
const caller = (role = "merchant") => merchantAuthRouter.createCaller({user:{id:"supplier",role},req:{},res:{}} as any);
beforeEach(() => { vi.clearAllMocks(); f.status="pending"; f.publishedProduct=true; f.listings=[]; });
it("publishes an existing imported catalogue without re-importing or duplicating products", async () => {
  await caller().setStorePublished({published:true});
  expect(f.insert).toHaveBeenCalledWith(expect.objectContaining({merchantId:7,name:"BS Tattoo",isActive:1}));
  expect(f.update).toHaveBeenCalledWith({status:"active"});
});
it("unpublishes without deleting listings, products or orders", async () => {
  f.status="active"; f.listings=[{id:2,isActive:1}];
  await caller().setStorePublished({published:false});
  expect(f.insert).not.toHaveBeenCalled();
  expect(f.update).toHaveBeenCalledWith({status:"pending"});
});
it("reuses the directory entry on republish", async () => {
  f.listings=[{id:2,isActive:1}];
  await caller().setStorePublished({published:true});
  expect(f.insert).not.toHaveBeenCalled();
});
it("requires at least one published product", async () => {
  f.publishedProduct=false;
  await expect(caller().setStorePublished({published:true})).rejects.toThrow("Publish at least one product");
  expect(f.update).not.toHaveBeenCalled();
});
it("does not permit suppliers to override suspension or administrator removal", async () => {
  f.status="suspended";
  await expect(caller().setStorePublished({published:true})).rejects.toThrow("suspended");
  f.status="pending";f.listings=[{id:2,isActive:0}];
  await expect(caller().setStorePublished({published:true})).rejects.toThrow("administrator");
  expect(f.update).not.toHaveBeenCalled();
});
it("rejects artists", async () => {
  await expect(caller("artist").setStorePublished({published:true})).rejects.toThrow("Merchant access required");
});
