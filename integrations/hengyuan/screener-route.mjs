const MARKETS=['US','HK','CN'];
const SAFE_FIELDS=['price','market_cap','pe_ratio','pb_ratio','insider_ownership','institutional_ownership'];
export function validSymbols(market,symbols){
 return MARKETS.includes(market)&&Array.isArray(symbols)&&symbols.length>0&&symbols.length<=50&&new Set(symbols).size===symbols.length&&symbols.every(s=>typeof s==='string'&&s.length<=20&&(market==='US'?/^[A-Z][A-Z0-9.^-]{0,14}$/.test(s):market==='HK'?/^\d{1,5}(\.HK)?$/.test(s):/^\d{6}\.(SS|SZ|BJ)$/.test(s)));
}
export function cleanResult(result,job){
 if(!result||!Array.isArray(result.rows)||result.rows.length>50||!Array.isArray(result.errors)||result.errors.length>50||!Number.isFinite(Date.parse(result.capturedAt))||Date.parse(result.capturedAt)>Date.now()+300000||Date.parse(result.capturedAt)<Date.parse(job.requested_at)-1000)throw Error('Invalid result');
 const symbols=JSON.parse(job.symbols),seen=new Set();
 const rows=result.rows.map(r=>{if(!symbols.includes(r.symbol)||seen.has(r.symbol))throw Error('Unexpected symbol');seen.add(r.symbol);const clean={symbol:r.symbol};for(const k of SAFE_FIELDS){if(r[k]!=null){if(typeof r[k]!=='number'||!Number.isFinite(r[k]))throw Error('Invalid number');if(k.endsWith('_ownership')&&(r[k]<0||(k==='insider_ownership'&&r[k]>100)))throw Error('Invalid percent');clean[k]=r[k]}}for(const k of ['currency','quoteAsOf','marketDate','timezone'])if(r[k]!=null){if(typeof r[k]!=='string'||r[k].length>80)throw Error('Invalid metadata');clean[k]=r[k]}return clean});
 return {source:job.market==='US'?'Robinhood MCP':'Futu MCP',market:job.market,capturedAt:result.capturedAt,rows,errors:result.errors.map(e=>String(e).slice(0,180)),ownershipReportPeriod:null,scoreRecomputed:false};
}
export async function screenerRoute(request,env){
 const url=new URL(request.url),path=url.pathname,db=env.DB;
 const json=(d,s=200)=>Response.json(d,{status:s,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 if(!db)return json({error:'扫描存储不可用'},503);
 const service=!request.headers.get('oai-authenticated-user-id');
 if(request.method==='POST'){
  if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'需要JSON请求'},415);
  const origin=request.headers.get('origin');if(origin&&origin!==url.origin)return json({error:'来源不匹配'},403);
  if(!service&&!origin)return json({error:'需要同源请求'},403);
 }
 if(['/api/screener/agent','/api/screener/result'].includes(path)&&!service)return json({error:'仅取数服务可调用'},403);
 await db.prepare('CREATE TABLE IF NOT EXISTS screener_agent (id TEXT PRIMARY KEY,last_seen TEXT NOT NULL)').run();
 await db.prepare('CREATE TABLE IF NOT EXISTS screener_jobs (market TEXT PRIMARY KEY,id TEXT NOT NULL,state TEXT NOT NULL,symbols TEXT NOT NULL,requested_at TEXT NOT NULL,finished_at TEXT,result TEXT,error TEXT)').run();
 const now=new Date().toISOString(),cutoff=new Date(Date.now()-900000).toISOString();
 await db.prepare("UPDATE screener_jobs SET state='failed',error='补查超时，请重试',finished_at=? WHERE state IN ('pending','running') AND requested_at<?").bind(now,cutoff).run();
 const status=async market=>{const [j,a]=await Promise.all([db.prepare('SELECT * FROM screener_jobs WHERE market=?').bind(market).first(),db.prepare("SELECT last_seen FROM screener_agent WHERE id='local'").first()]);return {agentOnline:!!a&&Date.parse(a.last_seen)>Date.now()-90000,job:j?{id:j.id,state:j.state,requestedAt:j.requested_at,error:j.error}:null,result:j?.result?JSON.parse(j.result):null}};
 if(path==='/api/screener/status'&&request.method==='GET'){const m=url.searchParams.get('market');return MARKETS.includes(m)?json(await status(m)):json({error:'不支持的市场'},400)}
 if(request.method!=='POST')return json({error:'Method not allowed'},405);
 const text=await request.text();if(text.length>120000)return json({error:'请求过大'},413);
 let b;try{b=JSON.parse(text)}catch{return json({error:'JSON无效'},400)}
 if(path==='/api/screener/agent'){
  await db.prepare("INSERT INTO screener_agent VALUES('local',?) ON CONFLICT(id) DO UPDATE SET last_seen=excluded.last_seen").bind(now).run();
  const job=b.claim===false?null:await db.prepare("UPDATE screener_jobs SET state='running' WHERE market=(SELECT market FROM screener_jobs WHERE state='pending' ORDER BY requested_at LIMIT 1) AND state='pending' RETURNING *").first();return json({job:job?{id:job.id,market:job.market,symbols:JSON.parse(job.symbols)}:null});
 }
 if(path==='/api/screener/request'){
  if(!validSymbols(b.market,b.symbols))return json({error:'市场或股票列表无效，最多50只'},400);
  const s=await status(b.market);if(s.job&&['pending','running'].includes(s.job.state))return json(s,202);
  if(!s.agentOnline)return json({error:'本机取数服务离线，请确认 Mac 开机联网；原日线筛选仍可使用。'},503);
  if(s.job&&Date.parse((await db.prepare('SELECT finished_at FROM screener_jobs WHERE market=?').bind(b.market).first()).finished_at)>Date.now()-15000)return json({error:'请在上次补查后等待15秒'},429);
  await db.prepare("INSERT INTO screener_jobs(market,id,state,symbols,requested_at) VALUES(?,?,'pending',?,?) ON CONFLICT(market) DO UPDATE SET id=excluded.id,state='pending',symbols=excluded.symbols,requested_at=excluded.requested_at,finished_at=NULL,result=NULL,error=NULL WHERE screener_jobs.state NOT IN ('pending','running')").bind(b.market,crypto.randomUUID(),JSON.stringify(b.symbols),now).run();return json(await status(b.market),202);
 }
 if(path==='/api/screener/result'){
  const job=await db.prepare("SELECT * FROM screener_jobs WHERE id=? AND state='running'").bind(b.id||'').first();if(!job)return json({error:'任务已结束'},409);
  let result;try{result=cleanResult(b.result,job)}catch{return json({error:'结果校验失败'},400)}
  const state=result.rows.length?(result.errors.length?'partial':'completed'):'failed';
  await db.prepare("UPDATE screener_jobs SET state=?,result=?,finished_at=? WHERE id=? AND state='running'").bind(state,JSON.stringify(result),now,b.id).run();return json({ok:true,state});
 }
 return json({error:'Not found'},404);
}
