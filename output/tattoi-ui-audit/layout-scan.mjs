import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import { response } from '../../scripts/ui-audit/ivory-fixtures.mjs';
import { cases } from '../../scripts/ui-audit/ivory-cases.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require('/Users/pip/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const results=[];
for(const c of cases){
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block',timezoneId:'Australia/Brisbane'});
 await context.addInitScript(()=>{localStorage.setItem('tattoi-theme-override','light');localStorage.setItem('authToken','test');sessionStorage.setItem('splashShown','true');});
 await context.route('**/*',async r=>{const u=new URL(r.request().url());if(u.hostname!=='127.0.0.1')return r.abort();if(u.pathname==='/__ivory_artwork.png')return r.fulfill({path:'output/tattoi-ivory-complete/assets/botanical.png',contentType:'image/png'});if(u.pathname.startsWith('/api/trpc/'))return r.fulfill({json:u.pathname.split('/').at(-1).split(',').map(name=>({result:{data:{json:response(name,c.role)}}}))});if(u.pathname==='/api/version')return r.fulfill({json:{version:'3.2.3'}});return r.continue();});
 const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.clock.install({time:new Date('2026-09-09T23:41:00Z')});await p.goto('http://127.0.0.1:5196'+c.path,{waitUntil:'networkidle',timeout:20000});await p.addStyleTag({content:':root{--app-safe-top:54px!important;--app-safe-bottom:34px!important}'});
  const data=await p.evaluate(()=>{const r=e=>{const b=e.getBoundingClientRect();return{x:Math.round(b.x*10)/10,y:Math.round(b.y*10)/10,width:Math.round(b.width*10)/10,height:Math.round(b.height*10)/10}};const visible=e=>{const s=getComputedStyle(e),b=e.getBoundingClientRect();return b.width>0&&b.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&b.top<innerHeight&&b.bottom>0};const name=e=>e.getAttribute('aria-label')||e.getAttribute('title')||e.innerText?.trim()||e.querySelector('img')?.alt||'';const control=e=>({tag:e.tagName,role:e.getAttribute('role'),name:name(e).slice(0,80),class:e.className,...r(e),disabled:e.disabled});const buttons=[...document.querySelectorAll('button,[role=button],a[href],summary,input[type=checkbox],input[type=radio]')].filter(visible).map(control);return{title:document.querySelector('h1')?.textContent,header:[...document.querySelectorAll('.v3-header,.client-home-header')].filter(visible).map(r),masthead:[...document.querySelectorAll('.v3-masthead')].map(r),subheader:[...document.querySelectorAll('.v3-subheader')].filter(visible).map(r),tabs:[...document.querySelectorAll('.v3-tabs,.v3-home-tabs')].filter(visible).map(e=>({...r(e),text:e.innerText,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth})),small:buttons.filter(b=>b.height<43.5||b.width<43.5),unlabelled:buttons.filter(b=>!b.name),overflow:document.documentElement.scrollWidth>innerWidth,errorBoundary:document.body.innerText.includes('Something went wrong')};});results.push({...c,...data,errors});console.log(c.id, data.small.length+'small',data.unlabelled.length+'unlabelled');
 }catch(e){results.push({...c,errors:[e.message]});}
 await context.close();
}
await browser.close();await writeFile('output/tattoi-ui-audit/layout-scan.json',JSON.stringify(results,null,2));
