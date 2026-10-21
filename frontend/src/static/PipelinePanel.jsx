import {useEffect,useState} from 'react';
import {Alert,Box,Button,Link,Typography} from '@mui/material';
export default function PipelinePanel(){
 const [status,setStatus]=useState(null),[error,setError]=useState(''),[sending,setSending]=useState(false);
 const enabled=import.meta.env.VITE_OWN_PIPELINE==='true';
 useEffect(()=>{if(!enabled)return;let stopped=false;async function read(){try{const r=await fetch('/api/screener/pipeline/status',{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error||'读取任务失败');if(!stopped){setStatus(d);setError('')}}catch(e){if(!stopped)setError(e.message)}}read();const timer=setInterval(read,15000);return()=>{stopped=true;clearInterval(timer)}},[enabled]);
 if(!enabled)return null;
 const job=status?.job,busy=sending||['pending','running','dispatched'].includes(job?.state);
 async function scan(){setSending(true);setError('');try{const r=await fetch('/api/screener/pipeline/request',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const d=await r.json();if(!r.ok)throw Error(d.error||'启动失败');setStatus(old=>({...old,...d}));}catch(e){setError(e.message)}finally{setSending(false)}}
 const state={pending:'等待本机提交',running:'后台计算中',dispatched:'已提交，正在查运行记录',completed:'计算流程已完成，发布可能仍在进行',failed:'计算失败；保留上次成功快照'};
 return <Box sx={{p:2,mb:2,border:'1px solid',borderColor:'divider',borderRadius:2}}>
  <Typography variant="h6">我的独立扫描器</Typography>
  <Typography variant="body2" sx={{my:1}}>沿用原作者 Minervini／CANSLIM／VCP 评分，在你的 fork 独立运行美股、港股和 A 股全市场日线流水线。计算可能耗时数十分钟至数小时；只有有效的新结果发布后，下方数据日期才会更新。</Typography>
  <Box sx={{display:'flex',gap:1,flexWrap:'wrap'}}><Button variant="contained" disabled={busy||!status?.agentOnline} onClick={scan} sx={{minHeight:44}}>{busy?'启动全市场扫描 · 后台处理中…':'启动全市场扫描（美／港／A）'}</Button><Button variant="outlined" sx={{minHeight:44}} onClick={()=>location.reload()}>载入我的最新结果</Button><Button href="https://github.com/alexanderhanboli/stock-screener/actions/workflows/static-site.yml" target="_blank" rel="noopener" sx={{minHeight:44}}>运行记录 ↗</Button></Box>
  <Typography role="status" variant="body2" sx={{mt:1}}>本机提交服务：{status?(status.agentOnline?'在线':'离线，请确认 Mac 开机联网'):'连接中…'}。提交后由 GitHub 后台计算。</Typography>
  {job&&<Typography role="status" variant="body2" sx={{mt:1}}>{state[job.state]||job.state} · 提交时间 {new Date(job.requested_at).toLocaleString('zh-CN')} {job.payload?.url&&<Link href={job.payload.url} target="_blank" rel="noopener">查看本次进度 ↗</Link>}</Typography>}
  {job?.payload?.jobs?.filter(j=>j.name.startsWith('build-market')).map(j=><Typography key={j.name} variant="body2">{j.name}：{j.status==='completed'?(j.conclusion==='success'?'完成':j.conclusion):j.status==='in_progress'?'计算中':'排队中'}</Typography>)}
  {job?.payload?.errors?.map((e,i)=><Alert key={i} severity="warning" sx={{mt:1}}>{e}</Alert>)}
  {error&&<Alert severity="error" sx={{mt:1}}>{error}</Alert>}
 </Box>
}
