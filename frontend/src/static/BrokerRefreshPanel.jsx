import {useEffect, useRef, useState} from 'react';
import {Alert, Box, Button, Table, TableBody, TableCell, TableHead, TableRow, Typography} from '@mui/material';
export const BROKER_REFRESH_ENABLED = import.meta.env.VITE_BROKER_REFRESH === 'true';
const labels={US:'Robinhood',HK:'富途',CN:'富途'};
export default function BrokerRefreshPanel({market,rows}){
 const [state,setState]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const current=useRef(market);current.current=market;
 useEffect(()=>{setState(null);setError('');setBusy(false)},[market]);
 useEffect(()=>{if(!busy)return;let stopped=false;const timer=setInterval(async()=>{
  try{const r=await fetch(`/api/screener/status?market=${market}`,{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error||'读取失败');if(stopped)return;setState(d);if(!['pending','running'].includes(d.job?.state))setBusy(false)}catch(e){if(!stopped){setError(e.message);setBusy(false)}}
 },2500);return()=>{stopped=true;clearInterval(timer)}},[busy,market]);
 if(!BROKER_REFRESH_ENABLED)return null;
 async function refresh(){const requested=market;setError('');setBusy(true);try{
 const response=await fetch('/api/screener/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({market,symbols:rows.slice(0,50).map(r=>r.symbol)})});const data=await response.json();if(current.current!==requested)return;if(!response.ok)throw Error(data.error||'补查失败');setState(data);
 }catch(e){if(current.current===requested){setError(e.message);setBusy(false)}}}
 const records=state?.result?.rows||[];
 const num=(v)=>typeof v==='number'?v.toLocaleString(undefined,{maximumFractionDigits:3}):'—';
 return <Box sx={{mb:2,p:1.5,border:'1px solid',borderColor:'divider',borderRadius:2}}>
  <Box sx={{display:'flex',gap:1,flexWrap:'wrap',alignItems:'center'}}>
   <Button variant="outlined" sx={{minHeight:44}} onClick={()=>location.reload()}>载入最新日线快照</Button>
   <Button variant="contained" sx={{minHeight:44}} disabled={busy||!rows.length} onClick={refresh}>{busy?'补查当前页 · 处理中…':`用${labels[market]}补查当前页（最多50只）`}</Button>
  </Box>
  <Typography variant="body2" sx={{mt:1}}>全市场筛选与评分基于下方日期的日线快照。券商补查独立显示，不改写原评分；需要 Mac 和 OpenD 在线。持股比例的报告期若未返回则保持未知。</Typography>
  {market==='CN'&&<Alert severity="info" sx={{mt:1}}>A股日线筛选可用；富途补查受账户行情权限限制，失败时保留日线快照。</Alert>}
  {error&&<Alert severity="error" sx={{mt:1}}>{error}</Alert>}
  {state?.job&&<Typography role="status" sx={{mt:1}}>补查状态：{({pending:'等待本机',running:'正在读取',completed:'完成',partial:'部分完成',failed:'失败'})[state.job.state]||state.job.state} {state.result?.capturedAt?` · 查询时间 ${state.result.capturedAt}`:''}</Typography>}
  {state?.job?.error&&<Alert severity="error">{state.job.error}</Alert>}
  {state?.result?.errors?.length>0&&<Alert severity="warning">{state.result.errors.join('；')}</Alert>}
  {records.length>0&&<details><summary style={{minHeight:44,cursor:'pointer'}}>查看 {records.length} 只股票的券商补查结果（本次请求最多50只）</summary><Box sx={{overflowX:'auto',mt:1}}><Table size="small" aria-label="券商补查结果"><TableHead><TableRow>{['股票','价格 / 币种','市值','P/E','内部人持股%','机构持股%','来源时间'].map(s=><TableCell key={s}>{s}</TableCell>)}</TableRow></TableHead><TableBody>{records.map(r=><TableRow key={r.symbol}><TableCell>{r.symbol}</TableCell><TableCell>{num(r.price)} {r.currency}</TableCell><TableCell>{num(r.market_cap)}</TableCell><TableCell>{num(r.pe_ratio)}</TableCell><TableCell>{num(r.insider_ownership)}</TableCell><TableCell>{num(r.institutional_ownership)}</TableCell><TableCell>{r.quoteAsOf||r.marketDate||'未返回'}{r.timezone?` (${r.timezone})`:''}</TableCell></TableRow>)}</TableBody></Table></Box></details>}
 </Box>
}
