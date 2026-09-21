import assert from 'node:assert/strict';
import {browser,setup} from './tour-browser-harness.mjs';
import {cases} from './tour-feature-cases.mjs';
const base=process.env.AUDIT_URL||'http://127.0.0.1:5240';
const fixture=cases.find(c=>c.name==='supply-total').override;
let stock=10,price=3200;
const original=fixture['suppliers.getSupplierProducts'][0];
try {
 const {page,context,errors}=await setup('artist',{...fixture,'appointments.getArtistCalendar':[],
  'suppliers.getSupplierProducts':()=>[{...original,variants:[{...original.variants[0],inventoryCount:stock,priceCents:price}]}],
 });
 await page.goto(base+'/supplies?supplier=1');
 await page.getByRole('button',{name:'View Needle cartridges',exact:true}).click();
 await page.getByRole('button',{name:'Add to cart',exact:true}).click();
 await page.getByRole('dialog').waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Cart, 1 items',exact:true}).waitFor();
 price=4200;
 await page.reload();
 await page.getByRole('button',{name:/Cart · 1 items · \$42.00/}).waitFor();
 stock=0;
 await page.reload();
 await page.getByRole('button',{name:'Cart, 0 items',exact:true}).waitFor();
 await page.getByText(/Some saved items are unavailable/).waitFor();
 await page.getByRole('button',{name:'Cart, 0 items',exact:true}).click();
 await page.getByText('Your order is empty.',{exact:true}).waitFor();
 assert(await page.getByRole('button',{name:'Review checkout total',exact:true}).isDisabled());
 assert.deepEqual(errors,[]);
 console.log('PASS retained basket reload, live repricing, stock removal and empty checkout');
 await context.close();
} finally {await browser.close();}
