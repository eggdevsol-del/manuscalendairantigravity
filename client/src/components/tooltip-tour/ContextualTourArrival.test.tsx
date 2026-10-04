import { render, act, cleanup } from "@testing-library/react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: {id:"artist-a"} as {id:string} | null, start:vi.fn(), go:vi.fn(), search:"", active:null as unknown }));
vi.mock("wouter",()=>({useLocation:()=>["/dashboard",mocks.go],useSearch:()=>mocks.search}));
vi.mock("@/_core/hooks/useAuth",()=>({useAuth:()=>({user:mocks.user,loading:false})}));
vi.mock("./TooltipTourProvider",()=>({useTooltipTour:()=>({startContextualTour:mocks.start,activeTour:mocks.active})}));
vi.mock("./contextualTargets",()=>({activeTourSurface:()=>document.querySelector("[data-tour-surface]"),surfaceTitle:()=>"Today",collectTourSteps:()=>[{title:"Next 7 days"}]}));
import { ContextualTourArrival } from "./ContextualTourArrival";
beforeEach(()=>{vi.useFakeTimers();localStorage.clear();mocks.start.mockClear();mocks.go.mockClear();mocks.user={id:"artist-a"};mocks.search="";mocks.active=null;Object.defineProperty(document,"visibilityState",{configurable:true,value:"visible"});document.body.innerHTML='<main data-tour-surface="Today"></main>';});
afterEach(()=>{cleanup();vi.useRealTimers();});
const tick=()=>act(()=>{vi.advanceTimersByTime(400);});
describe("automatic account guides",()=>{
 it("starts after sign-in, once per account, and keeps other accounts independent",()=>{
  const first=render(<ContextualTourArrival/>);tick();expect(mocks.start).toHaveBeenCalledTimes(1);first.unmount();
  const second=render(<ContextualTourArrival/>);tick();expect(mocks.start).toHaveBeenCalledTimes(1);second.unmount();
  mocks.user={id:"client-b"};render(<ContextualTourArrival/>);tick();expect(mocks.start).toHaveBeenCalledTimes(2);
 });
 it("does not start for signed-out visitors or replace an active guide",()=>{
  mocks.user=null;const first=render(<ContextualTourArrival/>);tick();expect(mocks.start).not.toHaveBeenCalled();first.unmount();
  mocks.user={id:"artist-a"};mocks.active={id:"manual"};render(<ContextualTourArrival/>);tick();expect(mocks.start).not.toHaveBeenCalled();
 });
 it("explicit guide links replay even after automatic playback",()=>{
  const first=render(<ContextualTourArrival/>);tick();first.unmount();mocks.search="walkthrough=1";
  render(<ContextualTourArrival/>);tick();expect(mocks.start).toHaveBeenCalledTimes(2);expect(mocks.go).toHaveBeenCalledWith("/dashboard",{replace:true});
 });
});
