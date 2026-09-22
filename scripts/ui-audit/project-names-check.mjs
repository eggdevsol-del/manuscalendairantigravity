import assert from 'node:assert/strict';
import {browser,setup,out} from './tour-browser-harness.mjs';
import {response} from './launch-fixtures.mjs';
const base=process.env.AUDIT_URL||'http://127.0.0.1:5241';
try {
 for(const width of [320,390]){
  for(const role of ['client','artist']){
   const summary=structuredClone(response('projects.summary',role));
   summary.sessions.forEach(s=>{s.sessionPlanId=11;s.projectName=null;});
   summary.plans[0].projectName=null;
   const {page,context,calls,errors}=await setup(role,{'projects.summary':()=>summary,'projects.setProjectName':input=>{summary.sessions[0].projectName=input.name;summary.plans[0].projectName=input.name;return {projectName:input.name};}});
   await page.setViewportSize({width,height:844});
   await page.goto(base+'/projects/12?project=plan:11');
   await page.getByRole('heading',{name:'Tattoo project',exact:true}).waitFor();
   assert.equal(calls.filter(c=>c.name==='projects.nameProject').length,0);
   assert.equal(await page.getByText(/Some project names|couldn’t name every project/).count(),0);
   if(role==='artist'){
    await page.getByRole('button',{name:'Edit project name',exact:true}).click();
    await page.getByLabel('Name this tattoo design').fill('Native flower sleeve');
    await page.waitForTimeout(500);
    await page.screenshot({path:`${out}/artist-name-editor-${width}.png`});
    await page.getByRole('button',{name:'Save name',exact:true}).click();
    await page.getByRole('heading',{name:'Native flower sleeve',exact:true}).waitFor();
    assert.equal(calls.find(c=>c.name==='projects.setProjectName').input.sessionPlanId,11);
   } else assert.equal(await page.getByRole('button',{name:'Edit project name'}).count(),0);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   assert.deepEqual(errors,[]);await page.screenshot({path:`${out}/${role}-project-${width}.png`});await context.close();console.log('PASS',role,width);
  }
 }
}finally{await browser.close();}
