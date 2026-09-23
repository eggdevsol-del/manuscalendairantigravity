import assert from 'node:assert/strict';
import {browser,setup,out} from './tour-browser-harness.mjs';
const base=process.env.AUDIT_URL||'http://127.0.0.1:5243';
try {
 for(const width of [320,390]) {
  let status='pending';
  const {page,context,calls,errors}=await setup('merchant',{
   'merchantAuth.getMerchantProfile':()=>({id:7,businessName:'BS Tattoo',country:'AU',status,shopifySimulatorEnabled:false}),
   'merchantAuth.getDashboardStats':{pendingOrders:0,lowStockItems:0,revenueCents:0,totalOrders:0},
   'merchantAuth.setStorePublished':input=>{status=input.published?'active':'pending';return {published:input.published};},
  });
  await page.setViewportSize({width,height:844});
  await page.goto(base+'/merchant');
  await page.getByRole('button',{name:'Publish store',exact:true}).click();
  await page.getByText('Live on Tattoi',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Unpublish store',exact:true}).click();
  await page.getByRole('button',{name:'Publish store',exact:true}).waitFor();
  assert.deepEqual(calls.filter(c=>c.name==='merchantAuth.setStorePublished').map(c=>c.input),[{published:true},{published:false}]);
  await page.screenshot({path:`${out}/supplier-publication-${width}.png`});
  assert.deepEqual(errors,[]); await context.close();
 }
 const {page,context,errors}=await setup('artist',{'suppliers.getSuppliers':[{id:5,merchantId:7,name:'BS Tattoo',currency:'AUD',isActive:1}]});
 await page.goto(base+'/supplies');
 assert.equal(await page.getByRole('link',{name:/BS Tattoo/}).getAttribute('href'),'/shop/supplier-7');
 assert.deepEqual(errors,[]);await context.close();
 console.log('PASS supplier publish/unpublish at 320/390 and canonical catalogue link');
} finally {await browser.close();}
