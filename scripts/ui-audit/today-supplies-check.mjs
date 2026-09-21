import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {browser,setup,out} from './tour-browser-harness.mjs';
import {cases} from './tour-feature-cases.mjs';
const base=process.env.AUDIT_URL||'http://127.0.0.1:5240';
const fixture=cases.find(c=>c.name==='supply-total').override;
const products=fixture['suppliers.getSupplierProducts'];
const results=[];
try {
 for(const width of [320,390,820]) {
  const overrides={...fixture,
   "appointments.getArtistCalendar":[],
   'suppliers.getSuppliers':[{id:1,name:'Studio Supply',currency:'AUD'}],
   'suppliers.getSupplierProducts':[...products,{...products[0],id:2,title:'Extra long professional studio supply product name',variants:[{id:2,title:'An extra long variant label that must not stretch the shop',priceCents:4200,inventoryCount:4}]}],
   'dashboardTasks.getBusinessTasks':{tasks:[{taskType:'lead_follow_up',taskTier:'tier1',relatedEntityId:'12',title:'Follow up with Mia',context:'Botanical sleeve · awaiting a reply',priorityLevel:'high',priorityScore:90,actionType:'in_app',conversationId:12}],summary:{},counts:{}},
   'supplierOrders.getSupplierOrders':[{id:7,supplierId:1,status:'paid',supplier:{name:'Studio Supply'},createdAt:'2026-01-01T00:00:00Z',totalCents:6400,currency:'AUD',items:[{id:1,supplierProductId:1,variantId:1,quantity:2,productTitle:'Needle cartridges',variantTitle:'Round liner',priceCents:3200}]}],
  };
  const {page,context,errors,calls}=await setup('artist',overrides);
  await page.setViewportSize({width,height:844});
  await page.goto(base+'/conversations');
  await page.locator('#bottom-nav').getByRole('link',{name:'Today',exact:true}).click();
  await page.getByText('Follow up with Mia',{exact:true}).waitFor();
  assert.equal(await page.locator('.today-agenda-day').count(),7);
  await page.locator('.v3-home-main').getByText('$450.00',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Expand full week'}).count(),0);
  await page.screenshot({path:`${out}/today-${width}.png`});
  await page.getByRole('button',{name:'Create promo',exact:true}).click();
  await page.getByRole('dialog',{name:'Create promo',exact:true}).waitFor();
  await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.getByRole('link',{name:'Review reorder',exact:true}).click();
  let sheet=page.getByRole('dialog',{name:'Order from Studio Supply',exact:true});
  await sheet.getByText('Needle cartridges',{exact:true}).waitFor();
  await sheet.getByRole('button',{name:'Close',exact:true}).click();
  await sheet.waitFor({state:'hidden'});
  await page.getByRole('button',{name:/^Cart, 2 items$/}).waitFor();
  const grid=await page.locator('.supplier-product-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
  assert.equal(grid,2);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const dock=await page.locator('.supplier-cart-dock').boundingBox();
  const nav=await page.locator('#bottom-nav').boundingBox();
  assert(dock.y+dock.height<=nav.y+1,'Cart clears bottom navigation');
  await page.screenshot({path:`${out}/supplies-${width}.png`});
  await page.locator('.v3-scroll').evaluate(el=>{el.scrollTop=el.scrollHeight;});
  const lastProduct=await page.locator('.supplier-product-card').last().boundingBox();
  assert(lastProduct.y+lastProduct.height<dock.y,'Last product scrolls above cart');
  await page.getByRole('link',{name:'Back',exact:true}).click();
  await page.getByRole('link',{name:/Studio Supply cart/}).click();
  await page.getByRole('dialog').getByText('Needle cartridges',{exact:true}).waitFor();
  await page.getByRole('dialog').getByRole('button',{name:'Remove one Needle cartridges',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Review checkout total',exact:true}).click();
  await page.getByRole('dialog').getByText('Platform fee',{exact:true}).waitFor();
  await page.getByRole('dialog').getByText('$47.00',{exact:false}).waitFor();
  await page.screenshot({path:`${out}/checkout-${width}.png`});
  const sent=calls.find(c=>c.name==='supplierOrders.createSupplierCheckout');
  assert.equal(sent.input.items[0].quantity,1);
  assert.deepEqual(errors,[]);
  assert(!calls.some(c=>/messages.send|promotions.create|confirmSupplierOrder/.test(c.name)));
  results.push({width,status:'passed',gridColumns:grid});
  await context.close();
 }
} finally {await browser.close();await writeFile(`${out}/today-supplies-results.json`,JSON.stringify(results,null,2));}
console.log(results);
