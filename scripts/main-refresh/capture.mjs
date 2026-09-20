import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {response} from './fixtures.mjs';
const require=createRequire(process.cwd()+'/package.json');
const {chromium}=require('playwright');
const phase=process.argv[2];
const theme=process.env.REFRESH_THEME || 'light';
const out=process.cwd()+'/output/main-refresh/'+phase+(theme==='dark'?'-dark':'');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.AUDIT_BROWSER || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const cases=[['artist','/dashboard'],['artist','/calendar'],['artist','/conversations'],['artist','/settings'],['artist','/clients'],['client','/bookings'],['client','/discover'],['merchant','/merchant/products'],['merchant','/merchant/orders'],['public','/login'],['public','/start/ella-morgan']];
const results=[];
for(const width of (process.env.REFRESH_WIDTHS?process.env.REFRESH_WIDTHS.split(',').map(Number):theme==='dark'?[390,820]:[320,390,820,1440])) for(const [role,path] of cases){
 const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',hasTouch:width<1000,isMobile:width<500});
 await context.addInitScript((theme)=>{localStorage.setItem('tattoi-theme-override',theme);localStorage.setItem('authToken','test');localStorage.setItem('manus_completed_tours',JSON.stringify(['dashboard-overview','profile-onboarding']));sessionStorage.setItem('splashShown','true')},theme);
 await context.route('**/*',async r=>{const u=new URL(r.request().url());if(u.hostname!=='127.0.0.1')return r.abort();if(u.pathname.startsWith('/api/trpc/'))return r.fulfill({json:u.pathname.split('/').at(-1).split(',').map(n=>({result:{data:{json:response(n,role)}}}))});if(u.pathname.startsWith('/api/'))return r.fulfill({json:{version:'2.10.0'}});return r.continue()});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install({time:new Date('2026-09-09T22:00:00Z')});
 await page.goto((process.env.AUDIT_URL || (phase==='before'?'http://127.0.0.1:5202':'http://127.0.0.1:5201'))+path,{waitUntil:'networkidle'});await page.waitForTimeout(300);
 const id=role+'-'+path.replaceAll('/','-')+'-'+width;
 const data=await page.evaluate(()=>({text:document.body.innerText,overflow:document.documentElement.scrollWidth>innerWidth,controls:[...document.querySelectorAll('button,a,input,select,textarea,[role=tab]')].map(e=>({tag:e.tagName,text:e.textContent?.trim(),href:e.getAttribute('href'),type:e.getAttribute('type')})),boxes:[...document.querySelectorAll('header,nav,button,input')].map(e=>{const r=e.getBoundingClientRect();return {tag:e.tagName,x:r.x,y:r.y,w:r.width,h:r.height}})}));
 await page.screenshot({path:out+'/'+id+'.png'});results.push({id,role,path,width,...data,errors});await context.close();
}
await writeFile(out+'/results.json',JSON.stringify(results,null,2));await browser.close();console.log(phase,results.length,'captures',results.filter(r=>r.errors.length).length,'with errors');
