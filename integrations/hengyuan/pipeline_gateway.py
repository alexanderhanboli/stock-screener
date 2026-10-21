"""Fixed GitHub workflow control; public market data only, no trade operations."""
import argparse,datetime as dt,json,subprocess,sys,time,tempfile
from pathlib import Path
REPO='alexanderhanboli/stock-screener'
def gh(*args):return subprocess.check_output(['/opt/homebrew/bin/gh',*args],text=True,timeout=35)
def benchmark(root):
 sys.path.insert(0,str(root))
 from capital_dashboard.robinhood_direct import DirectReadMcp
 with DirectReadMcp(budget=100) as client:
  def read(name,args):
   if name not in {'get_equity_historicals','get_equity_quotes'}:raise ValueError('Not a market getter')
   result=client.rpc('tools/call',{'name':name,'arguments':args})
   if result.get('isError'):raise RuntimeError('Benchmark read failed')
   data=result.get('structuredContent') or json.loads('\n'.join(x['text'] for x in result.get('content',[]) if x.get('type')=='text'))
   return data['data']
  start=(dt.datetime.now(dt.timezone.utc)-dt.timedelta(days=740)).isoformat()
  data={'source':'Robinhood MCP','capturedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'adjustment':'split','historicals':read('get_equity_historicals',{'symbols':['SPY','IVV'],'start_time':start,'interval':'day','bounds':'regular','adjustment_type':'split'}),'quotes':read('get_equity_quotes',{'symbols':['SPY','IVV']})}
 with tempfile.TemporaryDirectory(prefix='hengyuan-benchmark-') as directory:
  file=Path(directory)/'hengyuan-benchmark-us.json';file.write_text(json.dumps(data));gh('release','upload','daily-price-data','-R',REPO,str(file),'--clobber')

def main():
 p=argparse.ArgumentParser();p.add_argument('--investment-root',type=Path,required=True);a=p.parse_args();b=json.loads(sys.stdin.read(4000));op=b.get('operation');errors=[]
 if op=='start':
  identifier=b['id']
  if not __import__('re').fullmatch(r'[a-f0-9-]{36}',identifier):raise ValueError('Invalid request identifier')
  try:benchmark(a.investment_root)
  except Exception:errors.append('Robinhood 基准补查失败，将使用已有基准；未达到日期要求时不发布新评分。')
  gh('workflow','run','static-site.yml','-R',REPO,'--ref','main','-f','market_group=all','-f','request_id='+identifier)
  for _ in range(8):
   runs=json.loads(gh('run','list','-R',REPO,'--workflow','static-site.yml','--branch','main','--limit','10','--json','databaseId,displayTitle,url,status'))
   found=next((r for r in runs if identifier in r['displayTitle']),None)
   if found:print(json.dumps({'runId':str(found['databaseId']),'url':found['url'],'state':'running','errors':errors}));return
   time.sleep(2)
  # Dispatch was accepted. Do not blindly dispatch a second workflow.
  print(json.dumps({'runId':None,'state':'dispatched','errors':errors+['GitHub 已接受任务，运行记录暂未出现；请查看运行记录。']}));return
 if op=='status':
  run_id=b.get('runId')
  if run_id is None:
   runs=json.loads(gh('run','list','-R',REPO,'--workflow','static-site.yml','--branch','main','--limit','20','--json','databaseId,displayTitle,url'))
   run=next((r for r in runs if b['id'] in r['displayTitle']),None)
   if not run:print(json.dumps({'state':'dispatched','runId':None}));return
   run_id=str(run['databaseId'])
  if not str(run_id).isdigit():raise ValueError('Invalid run')
  run=json.loads(gh('run','view',str(run_id),'-R',REPO,'--json','status,conclusion,url,jobs'))
  state='running' if run['status']!='completed' else ('completed' if run['conclusion']=='success' else 'failed')
  jobs=[{'name':r['name'],'status':r['status'],'conclusion':r['conclusion']} for r in run.get('jobs',[])]
  print(json.dumps({'runId':str(run_id),'state':state,'url':run['url'],'jobs':jobs}));return
 raise ValueError('Unsupported operation')
if __name__=='__main__':main()
