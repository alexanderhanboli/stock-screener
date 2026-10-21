import {afterEach,describe,expect,it,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup,act} from '@testing-library/react';
describe('private broker supplements',()=>{
 afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllEnvs();vi.unstubAllGlobals();vi.resetModules()});
 it('is disabled by default',async()=>{vi.stubEnv('VITE_BROKER_REFRESH','');const {default:Panel}=await import('./BrokerRefreshPanel');const {container}=render(<Panel market="US" rows={[]}/>);expect(container).toBeEmptyDOMElement()});
 it('bounds a user-triggered read and reports offline honestly',async()=>{vi.stubEnv('VITE_BROKER_REFRESH','true');const fetch=vi.fn().mockResolvedValue({ok:false,json:async()=>({error:'本机取数服务离线'})});vi.stubGlobal('fetch',fetch);const {default:Panel}=await import('./BrokerRefreshPanel');render(<Panel market="US" rows={Array.from({length:70},(_,i)=>({symbol:'A'+i}))}/>);expect(fetch).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:/用Robinhood/}));await waitFor(()=>expect(screen.getByText('本机取数服务离线')).toBeInTheDocument());expect(JSON.parse(fetch.mock.calls[0][1].body).symbols).toHaveLength(50)});
 it('reports the A-share permission boundary',async()=>{vi.stubEnv('VITE_BROKER_REFRESH','true');const {default:Panel}=await import('./BrokerRefreshPanel');render(<Panel market="CN" rows={[]}/>);expect(screen.getByText(/受账户行情权限限制/)).toBeInTheDocument()});
 it('does not poll an old terminal job while a new request is still in flight',async()=>{
  vi.stubEnv('VITE_BROKER_REFRESH','true');vi.useFakeTimers();let accept;
  const fetch=vi.fn().mockImplementation((url)=>url.endsWith('/request')?new Promise(resolve=>{accept=resolve}):Promise.resolve({ok:true,json:async()=>({job:{id:'new',state:'completed'},result:{rows:[]}})}));vi.stubGlobal('fetch',fetch);
  const {default:Panel}=await import('./BrokerRefreshPanel');render(<Panel market="US" rows={[{symbol:'AAPL'}]}/>);
  fireEvent.click(screen.getByRole('button',{name:/用Robinhood/}));
  await act(async()=>{await vi.advanceTimersByTimeAsync(3000)});expect(fetch).toHaveBeenCalledTimes(1);
  await act(async()=>{accept({ok:true,json:async()=>({job:{id:'new',state:'pending'}})})});
  await act(async()=>{await vi.advanceTimersByTimeAsync(2500)});
  expect(screen.getByRole('status')).toHaveTextContent('完成');expect(screen.getByRole('button',{name:/用Robinhood/})).toBeEnabled();expect(fetch).toHaveBeenCalledTimes(2);
 });
 it('ignores a late response after switching away and back to a market',async()=>{
  vi.stubEnv('VITE_BROKER_REFRESH','true');let accept;vi.stubGlobal('fetch',vi.fn(()=>new Promise(resolve=>{accept=resolve})));
  const {default:Panel}=await import('./BrokerRefreshPanel');const {rerender}=render(<Panel market="US" rows={[{symbol:'AAPL'}]}/>);
  fireEvent.click(screen.getByRole('button',{name:/用Robinhood/}));rerender(<Panel market="HK" rows={[{symbol:'0700.HK'}]}/>);rerender(<Panel market="US" rows={[{symbol:'AAPL'}]}/>);
  await act(async()=>{accept({ok:true,json:async()=>({job:{id:'stale',state:'pending'}})})});expect(screen.queryByRole('status')).not.toBeInTheDocument();expect(screen.getByRole('button',{name:/用Robinhood/})).toBeEnabled();
 });

});
