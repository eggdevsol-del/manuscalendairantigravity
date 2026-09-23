import assert from 'node:assert/strict';
import {browser,setup,out} from './tour-browser-harness.mjs';
import {cases} from './tour-feature-cases.mjs';
const base=process.env.AUDIT_URL||'http://127.0.0.1:5240';
const supply=cases.find(c=>c.name==='supply-total').override;
try {
 for(const width of [320,390]) {
  const {page,context,calls,errors}=await setup('artist',{...supply,'appointments.getArtistCalendar':[],
   'supplierOrders.getReorderRecommendations':[{supplierId:1,supplierName:'Studio Supply',orderId:7,intervalDays:14,dueAt:'2026-09-22T00:00:00Z',due:true,sampleOrders:3,items:[{quantity:3,productTitle:'Needle cartridges'}]}],
  });
  await page.setViewportSize({width,height:844});
  await page.goto(base+'/dashboard');
  await page.getByText(/about every 14 days, based on 3 paid orders/).waitFor();
  await page.getByRole('link',{name:'Review reorder',exact:true}).waitFor();
  await page.goto(base+'/supplies?supplier=1');
  await page.getByRole('button',{name:'View Needle cartridges',exact:true}).click();
  await page.getByRole('button',{name:'Increase quantity',exact:true}).click();
  await page.getByRole('button',{name:'Increase quantity',exact:true}).click();
  assert.equal(await page.getByRole('spinbutton',{name:'Quantity',exact:true}).inputValue(),'3');
  await page.screenshot({path:`${out}/quantity-${width}.png`});
  await page.getByRole('button',{name:'Add to cart',exact:true}).click();
  await page.getByRole('button',{name:'Cart, 3 items',exact:true}).click();
  await page.getByRole('button',{name:'Add one Needle cartridges',exact:true}).click();
  await page.getByRole('button',{name:'Review checkout total',exact:true}).click();
  await page.getByText('Platform fee',{exact:true}).waitFor();
  assert.equal(calls.find(c=>c.name==='supplierOrders.createSupplierCheckout').input.items[0].quantity,4);
  assert.deepEqual(errors,[]);await context.close();console.log('PASS quantity and cadence UI',width);
 }
 const {page,context,calls,errors}=await setup('merchant',{
  'merchantAuth.getMerchantProfile':{id:7,businessName:'Studio Supply',country:'AU',shopifySimulatorEnabled:true},
  'merchantAuth.simulateShopifyImport':{queued:true,alreadyQueued:false},
  'merchantAuth.getSyncStatus':{status:'complete',count:5,message:'Import complete.'},
 });
 await page.goto(base+'/settings');
 assert.equal(await page.getByLabel('Admin API token',{exact:true}).count(),0);
 await page.getByRole('button',{name:'Connect with Shopify',exact:true}).click();
 await page.getByLabel('Dummy username',{exact:true}).fill('test-user');
 await page.getByLabel('Dummy password',{exact:true}).fill('not-a-real-password');
 await page.getByRole('button',{name:'Continue simulation',exact:true}).click();
 assert(!calls.some(c=>c.name==='merchantAuth.simulateShopifyImport'));
 assert(!JSON.stringify(calls).includes('not-a-real-password'));
 await page.getByLabel('Store URL',{exact:true}).fill('https://example.com');
 await page.getByRole('button',{name:'Import store',exact:true}).click();
 await page.getByText('Import complete. Review your products before publishing.',{exact:true}).waitFor();
 assert.deepEqual(calls.find(c=>c.name==='merchantAuth.simulateShopifyImport').input,{storeUrl:'https://example.com'});
 assert(!JSON.stringify(calls).includes('not-a-real-password'));
 await page.screenshot({path:`${out}/shopify-simulation.png`});
 assert.deepEqual(errors,[]);await context.close();console.log('PASS Shopify simulation; only storefront URL transmitted');
} finally {await browser.close();}
