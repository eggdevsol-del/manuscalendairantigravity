import {afterEach,expect,it,vi} from 'vitest';
import {finishSignIn} from './auth-session';
afterEach(()=>{vi.unstubAllGlobals();localStorage.clear();sessionStorage.clear();});
it('routes developer sign-in to the private dashboard without persistent storage',()=>{
 const assign=vi.fn();vi.stubGlobal('window',{location:{assign}});
 sessionStorage.setItem('tattoi-return-to','/bookings');
 finishSignIn({token:'fixture',user:{role:'master_dev'}},true);
 expect(assign).toHaveBeenCalledWith('/dev');expect(localStorage.getItem('authToken')).toBeNull();expect(sessionStorage.getItem('authToken')).toBe('fixture');
});
it('preserves ordinary client navigation and remember-me',()=>{const assign=vi.fn();vi.stubGlobal('window',{location:{assign}});finishSignIn({token:'fixture',user:{role:'client'}},true);expect(assign).toHaveBeenCalledWith('/bookings');expect(localStorage.getItem('authToken')).toBe('fixture');});
