import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {response} from './fixtures.mjs';
const {chromium}=createRequire(process.cwd()+'/package.json')('playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.AUDIT_BROWSER || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const output='output/main-refresh/interactions';await mkdir(output,{recursive:true});
const results=[];
for(const width of [320,390,820,1440]) for(const [role,path] of [['artist','/dashboard'],['artist','/calendar'],['artist','/settings'],['client','/bookings'],['merchant','/merchant/products']]){
 const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',hasTouch:width<1000});
 await context.addInitScript(()=>{localStorage.setItem('authToken','test');localStorage.setItem('tattoi-theme-override','light');localStorage.setItem('manus_completed_tours',JSON.stringify(['dashboard-overview','profile-onboarding']));sessionStorage.setItem('splashShown','true')});
 const mutations=[];
 await context.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='127.0.0.1')return r.abort();if(u.pathname.startsWith('/api/trpc/')){if(r.request().method()==='POST')mutations.push(u.pathname);return r.fulfill({json:u.pathname.split('/').at(-1).split(',').map(n=>({result:{data:{json:response(n,role)}}}))});}if(u.pathname.startsWith('/api/'))return r.fulfill({json:{version:'2.10.0'}});return r.continue()});
 const page=await context.newPage();page.setDefaultTimeout(4000);await page.clock.install({time:new Date('2026-09-09T22:00:00Z')});
 const result={width,role,path,checks:[],status:'pass'};
 try{
  await page.goto('http://127.0.0.1:5201'+path,{waitUntil:'networkidle'});
  if(path==='/dashboard'){
   for(const label of ['Clients','Supplies','Today']){await page.getByRole('button',{name:label,exact:true}).click();result.checks.push('Selected '+label);}
  }else if(path==='/bookings'){
   await page.getByRole('button',{name:'Past',exact:true}).click();await page.getByRole('button',{name:'Upcoming',exact:true}).click();result.checks.push('Past and Upcoming tabs');
   const reschedule=page.getByRole('button',{name:'Reschedule',exact:true}).first();if(await reschedule.count()){await reschedule.click();await page.waitForURL('**/chat/12');result.checks.push('Reschedule control opens original destination');}
  }else if(path==='/merchant/products'){
   await page.getByRole('button',{name:'Add New',exact:true}).click();
   if(await page.getByRole('dialog').count()===0){result.status='baseline-limitation';result.checks.push('Main Add New is an unwired placeholder; no product form opens');}
   const input=page.getByPlaceholder('Search products...');await input.fill('Fixture test product');if(await input.inputValue()!=='Fixture test product')throw Error('Input lost value');
   await input.focus();if(!await input.evaluate(e=>e===document.activeElement))throw Error('Input focus failed');
   result.checks.push('Existing search input accepts text and retains focus');
  }else if(path==='/settings'){
   const toggle=page.getByRole('switch').first();await toggle.click();await page.waitForTimeout(100);
   if(!await page.evaluate(()=>document.documentElement.classList.contains('dark')))throw Error('Theme did not switch');
   await toggle.click();result.checks.push('Existing theme switch toggles dark and returns light');
  }else{
   const scrolling=await page.evaluate(()=>{const el=[...document.querySelectorAll('*')].find(e=>e.scrollHeight>e.clientHeight+30&&['auto','scroll'].includes(getComputedStyle(e).overflowY));if(!el)return null;el.scrollTop=100;return {moved:el.scrollTop>0,overflow:getComputedStyle(el).overflowY};});
   if(scrolling&&!scrolling.moved)throw Error('Scrollable calendar did not move');
   result.checks.push(scrolling?'Calendar scroll container moves':'Calendar has no overflowing content in fixture');
  }
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Horizontal viewport overflow');
  result.checks.push('No horizontal overflow');
  await page.waitForTimeout(350);
  await page.screenshot({path:`${output}/${role}-${path.replaceAll('/','-')}-${width}.png`});
 }catch(e){result.status='failed';result.error=e.message;}
 result.mutations=mutations;results.push(result);await context.close();
}
await browser.close();await writeFile(output+'/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results.filter(x=>x.status!=='pass'),null,2));console.log(results.filter(x=>x.status==='pass').length+'/'+results.length,'passed');
