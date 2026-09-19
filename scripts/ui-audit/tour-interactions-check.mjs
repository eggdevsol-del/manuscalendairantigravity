import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {browser,setup,out} from './tour-browser-harness.mjs';
const results=[],url=process.env.AUDIT_URL||'http://127.0.0.1:5198';
try {
 for(const width of [320,390,820]) {
  const {page,context,calls,errors}=await setup('artist');
  try {
   await page.setViewportSize({width,height:874});
   await page.emulateMedia({reducedMotion:'reduce'});
   await page.goto(url+'/calendar');
   await page.getByRole('button',{name:'New booking',exact:true}).click();
   const help=page.getByRole('button',{name:'Tour this feature',exact:true});
   await help.waitFor();
   await page.waitForTimeout(700);
   const heading=page.locator('[data-slot="sheet-title"]');
   const h=await heading.boundingBox(),b=await help.boundingBox();
   assert.ok(h&&b,'Sheet header is visible');
   assert.ok(h.x>=b.x+b.width || h.y>=b.y+b.height || h.y+h.height<=b.y,'Help does not overlap sheet title');
   const before=calls.filter(c=>c.method==='POST').length;
   await help.click();
   const island=page.locator('.tooltip-tour-bubble');
   await island.waitFor();
   await page.waitForTimeout(250);
   const initial=await island.getAttribute('data-tour-target');
   await island.getByRole('button',{name:'Next',exact:true}).click();
   await page.waitForTimeout(250);
   assert.notEqual(await island.getAttribute('data-tour-target'),initial);
   await island.getByRole('button',{name:'Back',exact:true}).click();
   await page.waitForTimeout(250);
   assert.equal(await island.getAttribute('data-tour-target'),initial);
   await island.getByRole('button',{name:'Minimise guide'}).click();
   await island.getByRole('button',{name:'Expand guide'}).click();
   await page.setViewportSize({width,height:500});
   await page.waitForTimeout(300);
   const box=await island.boundingBox();
   assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=width+1&&box.y+box.height<=501,'Island fits a reduced viewport');
   await page.keyboard.press('Escape');
   await island.waitFor({state:'hidden'});
   assert.ok(await heading.isVisible(),'Escape preserves the booking sheet');
   assert.ok(await help.evaluate(el=>document.activeElement===el),'Focus returns to tour trigger');
   await help.click();
   await island.getByRole('button',{name:'Skip',exact:true}).click();
   await island.waitFor({state:'hidden'});
   assert.equal(calls.filter(c=>c.method==='POST').length,before,'Tour controls do not submit business mutations');
   assert.deepEqual(errors,[]);
   results.push({width,passed:true});console.log('PASS interactions',width);
  }catch(error){results.push({width,error:error.message});console.log('FAIL interactions',width,error.message);await page.screenshot({path:out+'/screens/interactions-'+width+'.png'});}
  finally{await context.close();}
 }
 await writeFile(out+'/interactions.json',JSON.stringify(results,null,2));
 assert.ok(results.every(r=>r.passed),'All interaction cases pass');
}finally{await browser.close();}
