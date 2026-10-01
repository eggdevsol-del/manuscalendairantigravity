import { chromium } from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {response} from './ivory-fixtures.mjs';
const out='output/tattoi-promotions';await mkdir(out,{recursive:true});
const rules={name:'A little space for something special',description:'A Friday sitting for your next idea.',kind:'discount',valueType:'percentage',value:15,currency:'AUD',eligibility:'new',expiresAt:'2027-10-09T13:59:59Z',sittingFrom:'2027-10-08T14:00:00Z',sittingUntil:'2027-10-09T13:59:59Z',backgroundImageUrl:''};
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const results=[];
for(const theme of ['light','dark']) for(const width of [390,320]) for(const role of ['artist','client']) {
 const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block',isMobile:true,hasTouch:true});
 await context.addInitScript(theme=>{localStorage.setItem('tattoi-theme-override',theme);localStorage.setItem('authToken','test');sessionStorage.setItem('splashShown','true');localStorage.setItem('ui_debug_enabled','false');},theme);
 await context.route('**/*',async route=>{
  const u=new URL(route.request().url());if(u.hostname!=='127.0.0.1')return route.abort();
  if(u.pathname.startsWith('/api/trpc/')) return route.fulfill({json:u.pathname.split('/').at(-1).split(',').map(name=>{
   let data;
   if(name==='offers.list') data={enabled:true,role,campaigns:role==='artist'?[{id:1,rules}]:[],offers:role==='client'?[{id:1,artistName:'Ella Morgan',rules,remainingValue:15,transferTo:null},{id:2,artistName:'Ella Morgan',rules:{...rules,name:'A gift for your next tattoo',kind:'voucher',valueType:'fixed',value:10000,eligibility:'unpaid',expiresAt:null,sittingFrom:null,sittingUntil:null},remainingValue:10000,transferTo:null},{id:3,artistName:'Ella Morgan',rules:{...rules,name:'Give someone their next tattoo',kind:'voucher',funding:'sale',valueType:'fixed',value:10000,validityYears:3,expiresAt:null,sittingFrom:null,sittingUntil:null},remainingValue:0,purchaseRequired:1,transferTo:null}]:[],incoming:[]};
   else if(name==='offers.audience')data={count:3,smsAvailable:true,pushAvailable:true,smsCount:2,pushCount:3};
   else if(name==='offers.deliveries')data=[{id:1,channel:'sms',status:'delivered',attempts:1,error:null},{id:2,channel:'push',status:'failed',attempts:1,error:'No active device accepted the push.'}];
   else if(name==='offers.preferences')data={enabled:true,sms:false,push:true,verifiedPhone:null,smsAvailable:true,pushAvailable:true};
   else if(name==='offers.purchase')data={clientSecret:'pi_test_secret',fees:{baseAmountCents:10000,platformFeeCents:500,clientTotalCents:10500}};
   else if(name==='funnel.getBalanceInfo')data={artistName:'Ella Morgan',projectType:'Botanical sleeve',status:'deposit_paid',remainingBalanceCents:30000,platformFeeCents:1020,clientTotalCents:31020,paymentMethods:{stripe:true,bank:false,cash:false}};
   else if(name==='offers.balanceQuote')data={active:false,choices:[{id:2,name:'A gift for your next tattoo',reason:null}],quote:{due:30000,discountCents:0,creditCents:10000,cashCents:20000,platformFeeCents:680,totalCents:20680,offerId:2}};
   else if(name==='sessionPlans.offerOptions')data={choices:[],applied:null};
   else if(name==='offers.issue')data={issued:3,skipped:0,delivery:'in-app only'};
   else data=response(name,role);
   return {result:{data:{json:data}}};
  })});
  if(u.pathname==='/api/version')return route.fulfill({json:{version:'3.2.3'}});
  return route.continue();
 });
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:5230/${role==='artist'?'dashboard':'bookings'}`,{waitUntil:'networkidle'});
 if(role==='artist') {
  await page.getByRole('button',{name:'Promotions',exact:true}).click();
  await page.getByRole('button',{name:'Choose audience'}).waitFor();
 }
 await page.waitForTimeout(500);
 await page.screenshot({path:`${out}/${role}-${width}-${theme}.png`});
 if(role==='artist') {
  await page.getByRole('button',{name:'Delivery activity',exact:true}).click();
  await page.getByText('SMS · delivered').waitFor();
  await page.screenshot({path:`${out}/delivery-${width}-${theme}.png`});
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Choose audience'}).click();await page.getByRole('heading',{name:'3 clients'}).waitFor();
  await page.waitForTimeout(500);
 await page.screenshot({path:`${out}/audience-${width}-${theme}.png`});
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.getByRole('button',{name:'Create promotion',exact:true}).click();
  await page.getByLabel('Name',{exact:true}).fill('Friday space');
  await page.waitForTimeout(500);
 await page.screenshot({path:`${out}/editor-${width}-${theme}.png`});
 }
 if(role==='client') {
  await page.getByRole('button',{name:'Buy gift voucher'}).click();
  await page.getByRole('button',{name:'Review price & fees'}).click();
  await page.getByText('Platform fee',{exact:true}).waitFor();
  await page.screenshot({path:`${out}/purchase-${width}-${theme}.png`});
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Transfer gift'}).click();
  await page.getByLabel('Recipient email').fill('mia@example.com');
  await page.waitForTimeout(500);
  await page.screenshot({path:`${out}/transfer-${width}-${theme}.png`});
  await page.keyboard.press('Escape');
  await page.goto('http://127.0.0.1:5230/balance/1',{waitUntil:'networkidle'});
  await page.getByLabel('Apply an offer').waitFor();
  await page.getByLabel('Apply an offer').selectOption('2');
  await page.screenshot({path:`${out}/balance-${width}-${theme}.png`});
  await page.goto('http://127.0.0.1:5230/settings?section=notifications',{waitUntil:'networkidle'});
  await page.getByText('Promotions from your artists',{exact:true}).waitFor();
  await page.screenshot({path:`${out}/preferences-${width}-${theme}.png`});
 }
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
 results.push({role,width,theme,errors,overflow});await context.close();
}
await browser.close();await writeFile(`${out}/checks.json`,JSON.stringify(results,null,2));
if(results.some(r=>r.errors.length||r.overflow))throw new Error(JSON.stringify(results));
console.log(JSON.stringify(results));
