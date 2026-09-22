import assert from 'node:assert/strict';
import {browser,setup,out} from './tour-browser-harness.mjs';
const base=process.env.AUDIT_URL||'http://127.0.0.1:5240';
const person={id:'artist-1',name:'Avery Rivers',email:'avery@example.com',role:'artist',city:'Brisbane',country:'Australia'};
const fixtures={
 'auth.me':{id:'owner',name:'Master developer',role:'master_dev',hasCompletedOnboarding:1},
 'masterDev.overview':{people:[{role:'artist',count:24},{role:'client',count:160}],bookings:[{status:'confirmed',count:48}],money:[{country:'AU',amountCents:1200000,artists:20}],active:[{role:'client',count:40}],activity:[{task:'booking.create',count:48}],locations:[{city:'Brisbane',country:'Australia',role:'artist',count:24}],suppressedLocations:3,styles:[{style:'Fine line',artists:12}],averageBookingsPerAccount:0.26},
 'masterDev.people':{rows:[person],total:1},
 'masterDev.person':{person,bookings:[{status:'completed',count:12}],ledger:[{type:'balance',country:'AU',amountCents:450000,feeCents:3000}],country:'AU',commerce:[],activity:[]},
 'masterDev.suppliers':[{id:1,name:'Studio Supply',websiteUrl:'https://example.com',contactEmail:'store@example.com',metrics:[{orders:12,currency:'AUD',salesCents:64000}]}],
 'masterDev.savePerson':{id:'new-user'},'masterDev.setAccountEnabled':{success:true},'masterDev.saveSupplier':{success:true},'masterDev.setSupplierVisible':{success:true},
};
try {
 for(const width of [320,390]){
  const {page,context,calls,errors}=await setup('artist',fixtures);
  await page.setViewportSize({width,height:844});await page.goto(base+'/dev');
  await page.getByText('Registered accounts',{exact:true}).waitFor();
  await page.screenshot({path:`${out}/overview-${width}.png`});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.getByRole('tab',{name:'People',exact:true}).click();
  await page.getByRole('button',{name:/Avery Rivers/}).click();
  await page.getByRole('button',{name:'Deactivate account',exact:true}).click();
  assert(!calls.some(c=>c.name==='masterDev.setAccountEnabled'));
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.getByRole('button',{name:'Edit account',exact:true}).click();
  await page.getByLabel('name',{exact:true}).fill('Avery Rivers Updated');
  await page.getByRole('button',{name:'Save account',exact:true}).click();
  await page.getByRole('button',{name:'Edit account',exact:true}).waitFor();
  assert(calls.some(c=>c.name==='masterDev.savePerson'&&c.input.name==='Avery Rivers Updated'));
  await page.screenshot({path:`${out}/person-${width}.png`});
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Add account',exact:true}).click();
  await page.getByLabel('name',{exact:true}).fill('Jordan Test');
  await page.getByLabel('email',{exact:true}).fill('jordan@example.com');
  await page.getByRole('button',{name:'Save account',exact:true}).click();
  await page.getByText(/Account created. The owner can use password recovery/).waitFor();
  assert(calls.some(c=>c.name==='masterDev.savePerson'&&c.input.email==='jordan@example.com'));
  await page.keyboard.press('Escape');
  await page.getByRole('tab',{name:'Suppliers',exact:true}).click();
  await page.getByRole('button',{name:'Add supplier',exact:true}).click();
  await page.getByLabel('Name',{exact:true}).fill('New Store');
  await page.getByLabel('Store URL',{exact:true}).fill('https://store.example.com');
  await page.getByRole('button',{name:'Save supplier',exact:true}).click();
  await page.getByRole('button',{name:'Add supplier',exact:true}).waitFor();
  assert(calls.some(c=>c.name==='masterDev.saveSupplier'&&c.input.name==='New Store'));
  await page.getByRole('button',{name:/Studio Supply/}).click();
  await page.getByRole('button',{name:'Remove from directory',exact:true}).click();
  assert(!calls.some(c=>c.name==='masterDev.setSupplierVisible'));
  await page.getByRole('button',{name:'Confirm removal',exact:true}).click();
  await page.getByRole('button',{name:'Add supplier',exact:true}).waitFor();
  assert(calls.some(c=>c.name==='masterDev.setSupplierVisible'&&c.input.visible===false));
  await page.getByRole('tab',{name:'Insights',exact:true}).click();
  await page.getByText('Geographic concentration',{exact:true}).waitFor();
  await page.screenshot({path:`${out}/insights-${width}.png`});
  assert.deepEqual(errors,[]);await context.close();console.log('PASS developer dashboard',width);
 }
 const {page,context,calls}=await setup('client',{'auth.me':{id:'client',role:'client'}});
 await page.goto(base+'/dev');await page.getByText('Private sign-in',{exact:true}).waitFor();
 assert(!calls.some(c=>c.name==='masterDev.overview'));
 await context.close();console.log('PASS ordinary account excluded from dashboard');
}finally{await browser.close();}
