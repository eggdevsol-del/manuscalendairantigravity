import {act,renderHook,waitFor,cleanup} from '@testing-library/react';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {TooltipTourProvider,useTooltipTour} from './TooltipTourProvider';
beforeEach(()=>{
 localStorage.clear();
 vi.spyOn(Element.prototype,'getClientRects').mockReturnValue([{width:44,height:44}] as unknown as DOMRectList);
 document.body.innerHTML='<main data-tour-surface="Home"><h1>Home</h1><button id="save">Save changes</button></main>';
});
afterEach(()=>{cleanup();vi.restoreAllMocks();document.body.replaceChildren();});
const setup=()=>renderHook(()=>useTooltipTour(),{wrapper:TooltipTourProvider});
it('reads every step without invoking a business control and persists only completion',async()=>{
 const save=vi.fn();document.getElementById('save')!.onclick=save;
 const hook=setup();
 act(()=>hook.result.current.startContextualTour());
 expect(hook.result.current.activeTour?.steps).toHaveLength(2);
 await act(async()=>{await hook.result.current.nextStep();});
 expect(hook.result.current.currentStep).toBe(1);
 act(()=>hook.result.current.skipTour());
 expect(hook.result.current.completedTours).toEqual([]);
 act(()=>hook.result.current.startContextualTour());
 await act(async()=>{await hook.result.current.nextStep();});
 await act(async()=>{await hook.result.current.nextStep();});
 expect(hook.result.current.activeTour).toBeNull();
 expect(hook.result.current.completedTours).toHaveLength(1);
 expect(JSON.parse(localStorage.getItem('manus_completed_tours')!)).toHaveLength(1);
 expect(save).not.toHaveBeenCalled();
});
it('follows newly opened feature sheets and returns to the page after closing',async()=>{
 const hook=setup();act(()=>hook.result.current.startContextualTour());
 document.body.insertAdjacentHTML('beforeend','<section role="dialog"><h2>New booking</h2><label>Date<input type="date"></label></section>');
 await waitFor(()=>expect(hook.result.current.activeTour?.steps[0].title).toBe('New booking'));
 expect(hook.result.current.activeTour?.steps.map(s=>s.title)).toContain('Date');
 document.querySelector('[role=dialog]')!.remove();
 await waitFor(()=>expect(hook.result.current.activeTour?.steps[0].title).toBe('Home'));
});
it('does not revive a skipped tour after an asynchronous legacy transition',async()=>{
 let resolve!:()=>void;const pending=new Promise<void>(done=>{resolve=done;});
 const hook=setup();
 act(()=>hook.result.current.startTour({id:'legacy',steps:[{targetId:'css:#save',title:'Save',body:'Read',onNext:()=>pending},{targetId:'css:#save',title:'Review',body:'Read'}]}));
 act(()=>{void hook.result.current.nextStep();hook.result.current.skipTour();});
 await act(async()=>{resolve();await pending;});
 expect(hook.result.current.activeTour).toBeNull();
 expect(hook.result.current.completedTours).toEqual([]);
});
it('ignores malformed completion storage',()=>{
 localStorage.setItem('manus_completed_tours','{"invalid":true}');
 expect(setup().result.current.completedTours).toEqual([]);
});

it('updates state-dependent guidance while preserving the highlighted control',async()=>{
 const button=document.getElementById('save')!;
 button.dataset.tourDescription='Cancel only this session.';
 const hook=setup();
 act(()=>hook.result.current.startContextualTour());
 await act(async()=>{await hook.result.current.nextStep();});
 const target=hook.result.current.activeTour!.steps[1].targetId;
 button.dataset.tourDescription='Cancel all remaining sessions in this plan.';
 await waitFor(()=>expect(hook.result.current.activeTour!.steps[1].body).toContain('all remaining sessions'));
 expect(hook.result.current.currentStep).toBe(1);
 expect(hook.result.current.activeTour!.steps[1].targetId).toBe(target);
});

it('refreshes labels changed in place without rebuilding their DOM element',async()=>{
 const button=document.getElementById('save')!;
 const hook=setup();act(()=>hook.result.current.startContextualTour());
 const target=hook.result.current.activeTour!.steps[1].targetId;
 button.firstChild!.nodeValue='Check confirmation';
 await waitFor(()=>expect(hook.result.current.activeTour!.steps[1].title).toBe('Check confirmation'));
 expect(hook.result.current.activeTour!.steps[1].targetId).toBe(target);
});
