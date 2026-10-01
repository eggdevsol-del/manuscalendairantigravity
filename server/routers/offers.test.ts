// @vitest-environment node
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
const state = vi.hoisted(() => ({ db: {} as any }));
vi.mock("../services/core", () => ({
  withDatabaseTransaction: (work: any) => work(state.db),
}));
vi.mock("../db", () => ({
  getArtistSettings: async () => ({ subscriptionTier: "top" }),
}));
import * as schema from "../../drizzle/schema";
import { offersRouter } from "./offers";
const caller = (role = "client") =>
  offersRouter.createCaller({ user: { id: "client-1", role } } as any);
beforeEach(() => {
  vi.stubEnv("IVORY_OFFERS_ENABLED", "true");
  state.db = {};
});
afterEach(() => vi.unstubAllEnvs());
describe("offer access and activation", () => {
  it("returns an empty feature state before activation without reading new tables", async () => {
    vi.stubEnv("IVORY_OFFERS_ENABLED", "false");
    const result = await caller().list();
    expect(result.enabled).toBe(false);
    expect(result.offers).toEqual([]);
  });
  it("does not let clients preview other clients or issue campaigns", async () => {
    await expect(
      caller().audience({ minSpendCents: 0, minBookings: 0, inactiveDays: 0 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller().issue({
        id: 1,
        filters: { minSpendCents: 0, minBookings: 0, inactiveDays: 0 },
        expectedCount: 1,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("does not let clients archive artist campaigns", async () => {
    await expect(caller().archive({ id: 1 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
  it("prevents transfer or use when the ownership-scoped lookup finds no offer", async () => {
    state.db = {
      select: () => ({
        from: () => ({ where: () => ({ for: async () => [] }) }),
      }),
    };
    await expect(
      caller().transfer({ id: 55, email: "someone@example.com" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller().use({ id: 55 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
  it("lets a gift recipient contact the artist without an existing conversation",async()=>{
    const offer={id:1,artistId:"artist",clientId:"client-1",remainingValue:5000,rulesJson:JSON.stringify({name:"Gift",kind:"voucher",valueType:"fixed",value:5000,currency:"AUD",eligibility:"unpaid",expiresAt:null,sittingFrom:null,sittingUntil:null})};
    const writes:any[]=[];
    state.db={select:()=>({from:(table:any)=>({where:()=>({for:async()=>table===schema.clientOffers?[offer]:[{id:"client-1"}]})})}),query:{conversations:{findFirst:async()=>null}},insert:(table:any)=>({values:async(values:any)=>{writes.push({table,values});return [{insertId:42}];}}),update:()=>({set:()=>({where:async()=>{}})})};
    const result=await caller().use({id:1});
    expect(result.conversationId).toBe(42);
    expect(writes.find(w=>w.table===schema.conversations)?.values).toMatchObject({artistId:"artist",clientId:"client-1"});
    expect(writes.find(w=>w.table===schema.messages)?.values.conversationId).toBe(42);
    expect(writes.some(w=>w.table===schema.notificationOutbox)).toBe(true);
  });

});
