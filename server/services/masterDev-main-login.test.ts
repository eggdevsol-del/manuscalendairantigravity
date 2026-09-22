// @vitest-environment node
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
const mocks=vi.hoisted(()=>({get:vi.fn(),compare:vi.fn(),update:vi.fn(),ordinary:vi.fn()}));
vi.mock('../db',()=>({getUserByEmail:mocks.get,updateUserLastSignedIn:mocks.update}));
vi.mock('../_core/auth-new',()=>({comparePassword:mocks.compare,generateToken:mocks.ordinary}));
import {authRouter} from '../_core/auth-router';
const caller=()=>authRouter.createCaller({req:{ip:'test-'+Math.random()},res:{}} as any);
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('MASTER_DEV_USER_ID','owner');mocks.get.mockResolvedValue({id:'owner',email:'owner@example.test',role:'master_dev',password:'hashed',name:'Owner',hasCompletedOnboarding:1});mocks.compare.mockResolvedValue(true);mocks.ordinary.mockReturnValue('ordinary');});
afterEach(()=>vi.unstubAllEnvs());
it('issues a dedicated 30-minute session from the ordinary sign-in endpoint',async()=>{const result=await caller().login({email:'owner@example.test',password:'test-only'});const payload=jwt.decode(result.token) as any;expect(payload.masterDev).toBe(true);expect(payload.exp-payload.iat).toBe(1800);expect(mocks.ordinary).not.toHaveBeenCalled();});
it('denies an unconfigured developer account',async()=>{vi.stubEnv('MASTER_DEV_USER_ID','someone-else');await expect(caller().login({email:'owner@example.test',password:'test-only'})).rejects.toMatchObject({code:'UNAUTHORIZED'});});
it('denies an incorrect password',async()=>{mocks.compare.mockResolvedValue(false);await expect(caller().login({email:'owner@example.test',password:'wrong'})).rejects.toMatchObject({code:'UNAUTHORIZED'});expect(mocks.update).not.toHaveBeenCalled();});
it('preserves ordinary sign-in',async()=>{mocks.get.mockResolvedValue({id:'artist',email:'artist@example.test',role:'artist',password:'hashed'});expect((await caller().login({email:'artist@example.test',password:'test-only'})).token).toBe('ordinary');});
