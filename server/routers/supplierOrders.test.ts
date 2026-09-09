// @vitest-environment node
import {beforeEach,describe,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({order:{id:1,status:'pending',shopifyDraftOrderId:null,shopifyDraftOrderName:null} as any,write:vi.fn(),stripe:vi.fn()}));
vi.mock('../db',()=>({getDb:async()=>({query:{supplierOrders:{findFirst:async()=>mocks.order}},update:mocks.write,insert:mocks.write})}));
vi.mock('../services/stripe',()=>({stripe:{checkout:{sessions:{retrieve:mocks.stripe}}},createSupplierCheckoutSession:vi.fn(),getOrCreateStripeCustomer:vi.fn()}));
import {supplierOrdersRouter} from './supplierOrders';
const caller=()=>supplierOrdersRouter.createCaller({user:{id:'artist',role:'artist'},req:{},res:{}} as any);
beforeEach(()=>{vi.clearAllMocks();mocks.order={id:1,status:'pending',shopifyDraftOrderId:null,shopifyDraftOrderName:null};});
describe('supplier order server confirmation',()=>{
 it('never marks an order paid from a client-supplied checkout ID',async()=>{expect(await caller().confirmSupplierOrder({orderId:1,stripeSessionId:'cs_unrelated_paid'})).toMatchObject({success:false,status:'pending'});expect(mocks.write).not.toHaveBeenCalled();expect(mocks.stripe).not.toHaveBeenCalled();});
 it('reports success only after the webhook has recorded payment',async()=>{mocks.order.status='paid';expect(await caller().getSupplierOrderStatus({orderId:1})).toMatchObject({success:true,status:'paid'});});
 it('rejects an order outside the ownership-scoped lookup',async()=>{mocks.order=null;await expect(caller().getSupplierOrderStatus({orderId:1})).rejects.toThrow('Order not found');});
});
