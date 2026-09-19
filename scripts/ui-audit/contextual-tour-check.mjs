// Workflow entry/replay compatibility, using the live contextual guide rather
// than assuming each workflow is the former fixed two-step tour.
import assert from 'node:assert/strict';
import {browser,setup,inspectGuide,out} from './tour-browser-harness.mjs';
const base=process.env.AUDIT_URL||'http://127.0.0.1:5198';
try {
 for(const width of [440,820,1180]) for(const role of ['artist','client','merchant']) {
  const {page,context,errors}=await setup(role);
  try {
   await page.setViewportSize({width,height:1100});
   const title=role==='artist'?'Run your day':role==='client'?'Follow your booking':'Review your store day';
   const route=(role==='merchant'?'/account-settings':'/settings')+'?section=how-tos';
   await page.goto(base+route);
   const safeTop=width===440?62:24;
   await page.evaluate(top=>document.documentElement.style.setProperty('--app-safe-top',top+'px'),safeTop);
   await page.getByText(title,{exact:true}).click();
   const bubble=page.locator('.tooltip-tour-bubble');
   await bubble.waitFor();
   await page.waitForTimeout(400);
   const first=await bubble.boundingBox();
   assert.ok(first.y>=safeTop && first.x>=0 && first.x+first.width<=width+1,'Guide respects safe area');
   const nav=await page.locator('#bottom-nav').boundingBox();
   if(nav) assert.ok(first.y+first.height<=nav.y,'Guide stays above navigation');
   const initial=await bubble.getAttribute('data-tour-target');
   await bubble.getByRole('button',{name:'Next',exact:true}).click();
   await page.waitForTimeout(250);
   assert.notEqual(await bubble.getAttribute('data-tour-target'),initial,'Next follows a different component');
   const second=await bubble.boundingBox();
   assert.ok(Math.abs(first.x-second.x)>1||Math.abs(first.y-second.y)>1,'Island visibly moves between components');
   await bubble.getByRole('button',{name:'Back',exact:true}).click();
   await page.waitForTimeout(250);
   assert.equal(await bubble.getAttribute('data-tour-target'),initial);
   await page.screenshot({path:out+'/screens/workflow-'+role+'-'+width+'.png'});
   await bubble.getByRole('button',{name:'Skip',exact:true}).click();
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('manus_completed_tours')||'[]').length),0);
   await page.goto(base+route);
   await page.getByText(title,{exact:true}).click();
   await inspectGuide(page);
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('manus_completed_tours')||'[]').length),1);
   assert.deepEqual(errors,[]);
   console.log('PASS workflow',role,width);
  } finally {await context.close();}
 }
} finally {await browser.close();}
