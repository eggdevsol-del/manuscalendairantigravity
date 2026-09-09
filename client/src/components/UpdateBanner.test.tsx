import {afterEach,describe,it,expect,vi} from 'vitest';
import {render,screen,waitFor,fireEvent,cleanup} from '@testing-library/react';
const update=vi.hoisted(()=>vi.fn().mockResolvedValue(undefined));
vi.mock('@/lib/pwa',()=>({triggerSWUpdate:update,forceUpdate:vi.fn().mockResolvedValue(undefined)}));
import {UpdateBanner} from './UpdateBanner';
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.clearAllTimers();vi.useRealTimers();});
describe('PWA update availability',()=>{
 it('finds an update that was already waiting before the banner mounted',async()=>{Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{getRegistration:async()=>({waiting:{}})}});render(<UpdateBanner/>);await waitFor(()=>expect(screen.getByRole('button',{name:'Update Now'})).toBeTruthy());});
 it('offers an update from the worker event without an authenticated context',async()=>{Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{getRegistration:async()=>undefined}});render(<UpdateBanner/>);fireEvent(window,new CustomEvent('pwa-update-available'));expect(screen.getByRole('button',{name:'Update Now'})).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Dismiss update'}));await waitFor(()=>expect(screen.queryByRole('button',{name:'Update Now'})).toBeNull());});
});
