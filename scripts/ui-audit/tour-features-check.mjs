import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {browser,setup,inspectGuide,out} from './tour-browser-harness.mjs';
import {cases} from './tour-feature-cases.mjs';
const url=process.env.AUDIT_URL||'http://127.0.0.1:5198',results=[];

try {
 for(const test of cases.filter(test=>(!process.env.TOUR_CASE||test.name===process.env.TOUR_CASE)&&(!process.env.TOUR_GROUP||new RegExp(process.env.TOUR_GROUP).test(test.name)))) {
  const {page,context,errors,calls}=await setup(test.role||'artist',test.override||{});
  try {
   await page.goto(url+test.path);
   for(const action of test.open) {await action(page);await page.waitForTimeout(180);}
   await page.waitForTimeout(700);
   assert.equal(await page.getByText('Something went wrong',{exact:true}).count(),0);
   const modal=page.getByRole('button',{name:'Tour this feature',exact:true});
   await (await modal.count()?modal.last():page.getByRole('button',{name:'Tour this page',exact:true}).first()).click();
   const before=calls.filter(call=>call.method==='POST').length;
   const steps=await inspectGuide(page);
   assert.equal(calls.filter(call=>call.method==='POST').length,before,'Tour does not submit business changes');
   assert.deepEqual(errors,[]);
   if(test.expected) assert.ok(steps.some(step=>step.body.includes(test.expected)),'Tour explains the state-specific effect: '+test.expected);
   results.push({name:test.name,path:test.path,role:test.role||'artist',steps,passed:true});console.log('PASS',test.name,steps.length);
  } catch(error) {
   results.push({name:test.name,path:test.path,error:error.message,errors,calls:[...new Set(calls.map(c=>c.name))]});console.log('FAIL',test.name,error.message.split('\n')[0]);
   await page.screenshot({path:out+'/screens/feature-'+test.name+'.png'});
  } finally {await context.close();}
  await writeFile(out+'/features'+(process.env.TOUR_CASE?'-'+process.env.TOUR_CASE:process.env.TOUR_GROUP?'-'+process.env.TOUR_GROUP.replace(/[^a-z0-9]+/gi,'-'):'')+'.json',JSON.stringify(results,null,2));
 }
 assert.ok(results.every(row=>row.passed),'All feature tours pass');
} finally {await browser.close();}
