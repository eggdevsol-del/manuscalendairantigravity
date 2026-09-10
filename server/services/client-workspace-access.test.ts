// @vitest-environment node
import { describe,it,expect,vi,beforeEach } from 'vitest';
const mocks=vi.hoisted(()=>({select:vi.fn(),where:vi.fn(),db:vi.fn()}));
vi.mock('./core',()=>({getDb:mocks.db}));
import { projectsRouter } from '../routers/projects';
const caller=(role='artist')=>projectsRouter.createCaller({user:{id:'artist',role},req:{},res:{}} as any);
beforeEach(()=>{vi.clearAllMocks();mocks.where.mockResolvedValue([]);mocks.select.mockReturnValue({from:()=>({where:mocks.where})});mocks.db.mockResolvedValue({select:mocks.select});});
describe('artist client workspace access',()=>{
 it('rejects client and supplier roles before reading the database',async()=>{await expect(caller('client').clientWorkspace({clientId:'other'})).rejects.toMatchObject({code:'FORBIDDEN'});expect(mocks.db).not.toHaveBeenCalled();});
 it('rejects unrelated clients before loading any profile, sessions, forms or notes',async()=>{await expect(caller().clientWorkspace({clientId:'other'})).rejects.toMatchObject({code:'FORBIDDEN'});expect(mocks.select).toHaveBeenCalledTimes(1);});
});
