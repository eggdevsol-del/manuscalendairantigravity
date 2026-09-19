import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {browser,setup,inspectGuide,out} from './tour-browser-harness.mjs';
const results=[];
const {readFile}=await import('node:fs/promises');
const {transform}=await import('esbuild');
const source=await readFile('client/src/components/tooltip-tour/tourCatalogue.ts','utf8');
const compiled=await transform(source,{loader:'ts',format:'esm'});
const {TOUR_CATALOGUE}=await import('data:text/javascript;base64,'+Buffer.from(compiled.code).toString('base64'));
const auditUrl=process.env.AUDIT_URL||'http://127.0.0.1:5198';
const cases=TOUR_CATALOGUE.flatMap(entry=>entry.roles.map(role=>({role,path:entry.route,title:entry.title})));
const unique=[...new Map(cases.map(c=>[c.role+c.path,c])).values()];
const selected=unique.filter(c=>(!process.env.TOUR_ROLE||c.role===process.env.TOUR_ROLE)&&(!process.env.TOUR_PATH||c.path===process.env.TOUR_PATH));
try {
 for(const test of selected) {
  const {page,context,errors,calls}=await setup(test.role);
  try {
    await page.goto(auditUrl+test.path);
    await page.getByRole('button',{name:'Tour this page',exact:true}).first().waitFor();
    await page.waitForTimeout(500);
    assert.equal(await page.getByText('Something went wrong',{exact:true}).count(),0,'No error boundary');
    const before=calls.filter(c=>c.method==='POST').map(c=>c.name);
    await page.getByRole('button',{name:'Tour this page',exact:true}).first().click();
    const steps=await inspectGuide(page);
    assert.deepEqual(errors,[],'No runtime errors');
    const unexpected=calls.filter(c=>c.method==='POST'&&!before.includes(c.name));
    assert.deepEqual(unexpected,[],'Tours do not invoke new mutations');
    results.push({...test,steps,passed:true});console.log('PASS',test.role,test.path,steps.length);
  } catch(error) {
    results.push({...test,error:error.message,errors,calls:[...new Set(calls.map(c=>c.name))]});console.log('FAIL',test.role,test.path,error.message.split('\n')[0]);
    await page.screenshot({path:out+'/screens/fail-'+results.length+'.png'});
  } finally {await context.close();}
  await writeFile(out+'/pages-'+(process.env.TOUR_ROLE||'all')+'.json',JSON.stringify(results,null,2));
 }
 assert.ok(results.every(r=>r.passed),'All contextual page tours pass');
} finally {await browser.close();}
