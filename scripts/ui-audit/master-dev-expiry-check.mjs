import assert from 'node:assert/strict';
import {browser,setup} from './tour-browser-harness.mjs';
const base=process.env.AUDIT_URL||'http://127.0.0.1:5241';
try {
 for(const section of ['People','Suppliers']){
  const {page,context}=await setup('artist',{'auth.me':{id:'owner',role:'master_dev',hasCompletedOnboarding:1},'masterDev.overview':{people:[],bookings:[],money:[],active:[],activity:[],locations:[],styles:[],averageBookingsPerAccount:0}});
  await page.route('**/api/trpc/masterDev.'+section.toLowerCase()+'*',route=>route.fulfill({status:403,json:[{error:{json:{message:'Private developer session required. Sign in again.',code:-32003,data:{code:'FORBIDDEN',httpStatus:403}}}}]}));
  await page.goto(base+'/dev');await page.getByRole('tab',{name:section,exact:true}).click();
  await page.getByRole('heading',{name:'Sign in to continue',exact:true}).waitFor();
  assert.equal(await page.getByText('Something didn’t load',{exact:true}).count(),0);
  await page.getByRole('button',{name:'Sign in again',exact:true}).click();
  await page.waitForURL('**/login');
  await context.close();console.log('PASS expired session recovery:',section);
 }
} finally {await browser.close();}
