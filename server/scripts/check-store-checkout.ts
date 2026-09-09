/** Real Stripe test-mode checkout/expiry acceptance. No card charge is made. */
import 'dotenv/config';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {eq,and,isNotNull} from 'drizzle-orm';
import * as s from '../../drizzle/schema';
import {getDb,withDatabaseTransaction} from '../services/core';
import {stripe} from '../services/stripe';
import {storefrontRouter} from '../routers/storefront';
if(!process.argv.includes('--run')||!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_'))throw new Error('Explicit --run in Stripe test mode required.');
const db=await getDb();if(!db)throw new Error('Database unavailable.');
const existing=await db.query.artistSettings.findFirst({where:and(eq(s.artistSettings.stripeConnectOnboardingComplete,1),isNotNull(s.artistSettings.stripeConnectAccountId))});
if(!existing?.stripeConnectAccountId)throw new Error('A ready test Connect account is required.');
const account=await stripe.accounts.retrieve(existing.stripeConnectAccountId);if(!account.charges_enabled)throw new Error('Connect account not ready.');
const userId=`qa_checkout_${randomUUID()}`;
let orderId:number|undefined,sessionId:string|undefined;
try{
 const pid=await withDatabaseTransaction(async tx=>{
  await tx.insert(s.users).values({id:userId,role:'merchant',name:'TEST ONLY Checkout QA'});
  await tx.insert(s.merchants).values({userId,businessName:'TEST ONLY Checkout QA',country:'AU',contactName:'TEST ONLY',phone:'0400000000',address:'TEST ONLY',status:'active',stripeAccountId:account.id});
  const [product]=await tx.insert(s.products).values({artistId:userId,ownerType:'merchant',title:'TEST ONLY stock reservation',priceCents:1000,inventoryCount:3,fulfillmentType:'pickup',isActive:1});return product.insertId;
 });
 const caller=storefrontRouter.createCaller({user:null,req:{},res:{}} as any);
 const checkout=await caller.createStorefrontCheckout({items:[{productId:pid,quantity:2}],fulfillmentMethod:'pickup'});
 orderId=checkout.orderId;sessionId=checkout.sessionId;
 assert.equal((await db.query.products.findFirst({where:eq(s.products.id,pid)}))?.inventoryCount,1);
 const session=await stripe.checkout.sessions.retrieve(sessionId);
 assert.equal(session.amount_total,checkout.totalCents);assert.equal(session.metadata?.stockReserved,'1');assert.equal(session.metadata?.orderId,String(orderId));
 await stripe.checkout.sessions.expire(sessionId);
 for(let i=0;i<45;i++){
  const order=await db.query.orders.findFirst({where:eq(s.orders.id,orderId)});
  if(order?.status==='cancelled')break;
  await new Promise(resolve=>setTimeout(resolve,1000));
 }
 assert.equal((await db.query.orders.findFirst({where:eq(s.orders.id,orderId)}))?.status,'cancelled','Real checkout.session.expired webhook must cancel the order.');
 assert.equal((await db.query.products.findFirst({where:eq(s.products.id,pid)}))?.inventoryCount,3);
 await caller.cancelStoreCheckout({orderId,sessionId});
 assert.equal((await db.query.products.findFirst({where:eq(s.products.id,pid)}))?.inventoryCount,3);
 console.log('PASS: real Stripe embedded session, server total, inventory held, provider expiry delivered to deployed webhook, stock restored exactly once. No card charge.');
 await db.delete(s.users).where(eq(s.users.id,userId));
 console.log('PASS: test merchant/product/order fixtures removed; webhook receipt retained.');
}catch(error){if(sessionId){const session=await stripe.checkout.sessions.retrieve(sessionId);if(session.status==='open')await stripe.checkout.sessions.expire(sessionId);}console.error('TEST ONLY fixtures retained for diagnosis',{userId,orderId});throw error;}
process.exit(0);
