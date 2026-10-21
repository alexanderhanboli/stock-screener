"""On-demand private Site broker supplement worker. Never schedules market reads."""
import argparse,json,subprocess,time,urllib.request,fcntl,os
from pathlib import Path

def main():
 p=argparse.ArgumentParser();p.add_argument('--url',required=True);p.add_argument('--token-file',type=Path,required=True);p.add_argument('--gateway-command',required=True);p.add_argument('--once',action='store_true');a=p.parse_args()
 if not a.url.startswith('https://'):p.error('HTTPS required')
 command=json.loads(a.gateway_command)
 if not isinstance(command,list) or not command or not all(isinstance(s,str) for s in command):p.error('gateway-command must be a JSON argv array')
 lockpath=Path.home()/'.local/share/hengyuan-screener/worker.lock';lockpath.parent.mkdir(mode=0o700,parents=True,exist_ok=True)
 def call(path,data):
  req=urllib.request.Request(a.url.rstrip('/')+'/api/screener/'+path,data=json.dumps(data).encode(),headers={'OAI-Sites-Authorization':'Bearer '+a.token_file.read_text().strip(),'Content-Type':'application/json'},method='POST')
  with urllib.request.urlopen(req,timeout=15) as response:return json.load(response)
 with lockpath.open('w') as lock:
  try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  except BlockingIOError:return
  pipeline_poll=0
  while True:
   try:
    job=call('agent',{}) .get('job')
    if time.monotonic()-pipeline_poll>60:
     pipeline_poll=time.monotonic()
     task=call('pipeline/agent',{}).get('job')
     if task:
      pipeline_command=command.copy();pipeline_command[1]=str(Path(command[1]).with_name('pipeline_gateway.py'))
      body={'operation':task['operation'],'id':task['id'],'runId':(task.get('payload') or {}).get('runId')}
      try:
       done=subprocess.run(pipeline_command,input=json.dumps(body),capture_output=True,text=True,timeout=160)
       if done.returncode:raise RuntimeError('Pipeline runner failed')
       result=json.loads(done.stdout)
      except Exception:
       # A dispatch may have succeeded; retain its identifier and resolve status
       # on the next poll instead of dispatching a duplicate or claiming failure.
       result={'state':'dispatched','runId':body['runId'],'errors':['运行记录暂不可读，正在重连；不会重复发起扫描。']}
      call('pipeline/result',{'id':task['id'],'result':result})
      call('agent',{'claim':False})
    if job:
     start=time.monotonic();process=subprocess.Popen(command,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True)
     payload=json.dumps({'market':job['market'],'symbols':job['symbols']})
     while True:
      try:out,_=process.communicate(payload,timeout=20);break
      except subprocess.TimeoutExpired:
       payload=None
       try:call('agent',{'claim':False})
       except Exception:
        process.kill();process.communicate();raise
       if time.monotonic()-start>600:process.kill();process.communicate();raise RuntimeError('Read timeout')
     try:result=json.loads(out) if process.returncode==0 else None
     except ValueError:result=None
     if result is None:result={'capturedAt':__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),'rows':[],'errors':['券商连接失败，请检查本机连接后重试']}
     call('result',{'id':job['id'],'result':result})
   except Exception as e:
    print(json.dumps({'state':'connection_error','type':type(e).__name__}),flush=True)
   if a.once:return
   time.sleep(8)
if __name__=='__main__':main()
