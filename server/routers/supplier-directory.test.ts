// @vitest-environment node
import { expect, it, vi } from "vitest";
vi.mock("../db", () => ({ getDb: async () => ({ query: {
  suppliers: {
    findMany: async () => [{id:1,merchantId:null,name:"Legacy"},{id:2,merchantId:7,name:"Old name"},{id:3,merchantId:8,name:"Draft shop"}],
    findFirst: async () => ({id:3,merchantId:8,isActive:1}),
  },
  merchants: { findMany: async () => [{id:7,businessName:"BS Tattoo"}], findFirst: async () => ({id:8,status:"pending"}) },
  supplierProducts: { findMany: vi.fn(() => {throw Error("Draft catalogue must not be queried");}) },
} }) }));
import { suppliersRouter } from "./suppliers";
const caller = suppliersRouter.createCaller({user:{id:"artist",role:"artist"},req:{},res:{}} as any);
it("lists active merchant shops using the merchant name and preserves legacy suppliers", async () => {
 expect((await caller.getSuppliers()).map(s=>s.name)).toEqual(["Legacy","BS Tattoo"]);
});
it("hides unpublished shops from direct directory links", async () => {
 expect(await caller.getSupplier({id:3})).toBeUndefined();
 expect(await caller.getSupplierProducts({supplierId:3})).toEqual([]);
});
