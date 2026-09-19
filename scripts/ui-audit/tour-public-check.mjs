import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {browser,setup,inspectGuide,out} from './tour-browser-harness.mjs';
const url=process.env.AUDIT_URL||'http://127.0.0.1:5198',results=[];
const cases=[
 '/login','/signup?role=client','/signup?role=artist','/signup?role=merchant',
 '/forgot-password','/auth/reset-password?token=test','/auth/magic',
 '/ella-morgan','/book/ella-morgan','/start/ella-morgan','/shop/ella-morgan','/events/ella-morgan','/studio/northside',
 '/deposit/test','/balance/101','/pay/test',
];
try {
 for(const path of cases) {
  const {page,context,errors}=await setup('public');
  try {
   await page.goto(url+path);
   const help=page.getByRole('button',{name:/^Tour this (page|feature)$/}).filter({visible:true}).last();
   await help.waitFor();
   await page.waitForTimeout(600);
   await help.click();
   const steps=await inspectGuide(page);
   assert.deepEqual(errors,[]);
   results.push({path,steps,passed:true});console.log('PASS',path,steps.length);
  }catch(error){results.push({path,error:error.message,errors});console.log('FAIL',path,error.message.split('\n')[0]);await page.screenshot({path:out+'/screens/public-'+results.length+'.png'});}
  finally{await context.close();}
  await writeFile(out+'/public-pages.json',JSON.stringify(results,null,2));
 }
 assert.ok(results.every(row=>row.passed),'All public tours pass');
}finally{await browser.close();}
