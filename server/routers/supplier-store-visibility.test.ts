// @vitest-environment node
import { expect, it, vi } from 'vitest';
const products=vi.hoisted(()=>vi.fn());
vi.mock('../db',()=>({getDb:async()=>({query:{merchants:{findFirst:async()=>({id:1,userId:'supplier',status:'active'})},suppliers:{findFirst:async()=>({id:2,isActive:0})},products:{findMany:products}}})}));
import {storefrontRouter} from './storefront';
it('hides the public shopfront for a supplier removed from the directory',async()=>{
 const caller=storefrontRouter.createCaller({user:null,req:{},res:{}} as any);
 expect(await caller.getArtistStorefront({slug:'supplier-1'})).toBeNull();
 expect(products).not.toHaveBeenCalled();
});
