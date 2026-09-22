import assert from 'node:assert/strict';
import {browser,setup,out} from './tour-browser-harness.mjs';
const base=process.env.AUDIT_URL||'http://127.0.0.1:5240';
async function idea(page){await page.goto(base+'/book/ella-morgan');await page.getByLabel('What would you like tattooed?').fill('A botanical sleeve with native leaves');await page.getByRole('checkbox',{name:'Fine Line',exact:true}).check();}
try {
 for(const width of [320,390]){
  let attempts=0;
  const {page,context,calls,errors}=await setup('client',{'consultations.create':()=>++attempts===1?null:{id:91,conversationId:12}});
  await page.setViewportSize({width,height:844});await idea(page);
  for(let i=0;i<5;i++)await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('button',{name:'Send booking request',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'could not be confirmed'}).waitFor();
  assert.equal(await page.getByText('Your request has been received',{exact:true}).count(),0);
  await page.getByText('A botanical sleeve with native leaves',{exact:true}).waitFor();
  await page.screenshot({path:`${out}/retry-${width}.png`});
  await page.getByRole('button',{name:'Send booking request',exact:true}).click();
  await page.getByText('Your request has been received',{exact:true}).waitFor();
  assert.equal(await page.getByRole('link',{name:'Open your messages',exact:true}).getAttribute('href'),'/chat/12');
  const submissions=calls.filter(c=>c.name==='consultations.create');assert.equal(submissions.length,2);assert(submissions[0].input.requestId);assert.equal(submissions[0].input.requestId,submissions[1].input.requestId);
  assert.deepEqual(errors,[]);await context.close();console.log('PASS confirmed save, preserved form, stable retry ID and thread link',width);
 }
 const {page,context,calls,errors}=await setup('client',{'auth.me':null,'funnel.submitPublicBooking':{success:true,leadId:91,conversationId:12,leadToken:'fixture-token',existingUser:false}});
 await idea(page);for(let i=0;i<4;i++)await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByLabel('First name',{exact:true}).fill('Jordan');await page.getByLabel('Last name',{exact:true}).fill('Test');await page.getByLabel('Email',{exact:true}).fill('jordan@example.com');await page.getByLabel('Phone',{exact:true}).fill('0400 000 000');await page.getByLabel('Date of birth',{exact:true}).fill('1990-01-01');await page.getByLabel('Gender',{exact:true}).selectOption('other');await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('button',{name:'Send booking request',exact:true}).click();await page.getByText('Your request has been received',{exact:true}).waitFor();
 assert(calls.find(c=>c.name==='funnel.submitPublicBooking')?.input.requestId);assert.deepEqual(errors,[]);await page.screenshot({path:`${out}/guest-success.png`});await context.close();console.log('PASS guest submission and account-claim screen');
}finally{await browser.close();}
