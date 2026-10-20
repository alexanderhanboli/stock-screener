import {afterEach,describe,expect,it,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
describe('private broker supplements',()=>{
 afterEach(()=>{cleanup();vi.unstubAllEnvs();vi.unstubAllGlobals();vi.resetModules()});
 it('is disabled by default',async()=>{vi.stubEnv('VITE_BROKER_REFRESH','');const {default:Panel}=await import('./BrokerRefreshPanel');const {container}=render(<Panel market="US" rows={[]}/>);expect(container).toBeEmptyDOMElement()});
 it('bounds a user-triggered read and reports offline honestly',async()=>{vi.stubEnv('VITE_BROKER_REFRESH','true');const fetch=vi.fn().mockResolvedValue({ok:false,json:async()=>({error:'本机取数服务离线'})});vi.stubGlobal('fetch',fetch);const {default:Panel}=await import('./BrokerRefreshPanel');render(<Panel market="US" rows={Array.from({length:70},(_,i)=>({symbol:'A'+i}))}/>);expect(fetch).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:/用Robinhood/}));await waitFor(()=>expect(screen.getByText('本机取数服务离线')).toBeInTheDocument());expect(JSON.parse(fetch.mock.calls[0][1].body).symbols).toHaveLength(50)});
 it('reports the A-share permission boundary',async()=>{vi.stubEnv('VITE_BROKER_REFRESH','true');const {default:Panel}=await import('./BrokerRefreshPanel');render(<Panel market="CN" rows={[]}/>);expect(screen.getByText(/受账户行情权限限制/)).toBeInTheDocument()});
});
