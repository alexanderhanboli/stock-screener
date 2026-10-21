"""Read-only adapters for an existing Hengyuan local MCP installation.
No account, position, order, or credential data is returned.
"""
import argparse,datetime as dt,json,math,re,sys,time
from pathlib import Path

def number(value):
 try:
  if value is None or value=='':return None
  v=float(value);return v if math.isfinite(v) else None
 except (ValueError,TypeError):return None

def futu_code(symbol,market):
 if market=='HK' and re.fullmatch(r'\d{1,5}(\.HK)?',symbol):return 'HK.'+symbol.split('.')[0].zfill(5)
 if market=='CN' and re.fullmatch(r'\d{6}\.(SS|SZ)',symbol):return ('SH.' if symbol.endswith('.SS') else 'SZ.')+symbol[:6]
 raise ValueError('Unsupported security')

def rh_call(client,tool,args):
 if tool not in {'get_equity_fundamentals','get_scanner_filter_specs','preview_scan'}:raise PermissionError('Not an allowed market read')
 result=client.rpc('tools/call',{'name':tool,'arguments':args})
 if result.get('isError'):raise RuntimeError('Robinhood read failed')
 data=result.get('structuredContent')
 if data is None:data=json.loads('\n'.join(c['text'] for c in result.get('content',[]) if c.get('type')=='text'))
 if not isinstance(data,dict) or data.get('success') is False:raise RuntimeError('Invalid Robinhood response')
 return data['data']

def fetch(market,symbols):
 rows=[];errors=[]
 if market=='US':
  from capital_dashboard.robinhood_direct import DirectReadMcp
  with DirectReadMcp(budget=300) as c:
   by_symbol={}
   for i in range(0,len(symbols),10):
    try:
     data=rh_call(c,'get_equity_fundamentals',{'symbols':symbols[i:i+10]})
     for r in data.get('results') or []:
      if r:by_symbol[r['symbol']]={'symbol':r['symbol'],'currency':'USD','marketDate':r.get('market_date'),**{k:number(r.get(k)) for k in ['market_cap','pe_ratio','pb_ratio']}}
     for s in data.get('not_found') or []:errors.append(s+'：Robinhood 未返回数据')
    except Exception:errors.append('Robinhood 基本面读取失败；未返回字段保持缺失')
   try:
    rh_call(c,'get_scanner_filter_specs',{})
    data=rh_call(c,'preview_scan',{'filters':[{'expression':'symbol','predicate':'PREDICATE_ANY_OF','values':symbols}],'columns':[{'display_name':'Insider ownership','expression':'fundamental.insiderPercentOwned'},{'display_name':'Institutional ownership','expression':'fundamental.institutionPercentOwned'}]})['result']
    for r in data.get('results') or []:
     s=r['ticker'];row=by_symbol.setdefault(s,{'symbol':s,'currency':'USD'});cols=r['columns'];row['price']=number(cols.get('Last'))
     for k,col in [('insider_ownership','Insider ownership'),('institutional_ownership','Institutional ownership')]:
      v=number(cols.get(col));row[k]=v*100 if v is not None else None
    if data.get('total_items',0)>len(data.get('results') or []):errors.append('Robinhood 返回结果被截断')
   except Exception:errors.append('Robinhood 持股比例／价格读取失败；未返回字段保持缺失')
   rows=list(by_symbol.values())
 else:
  from persona_chat.futu_mcp_client import call
  pairs=[]
  for s in symbols:
   try:pairs.append((s,futu_code(s,market)))
   except ValueError:errors.append(s+'：当前富途接口不支持该证券')
  for i in range(0,len(pairs),8):
   batch=pairs[i:i+8]
   try:
    result=call('futu_market_snapshot',{'codes':[c for _,c in batch]})
    if not result.get('ok'):
     errors.append(('A股行情权限不足或富途数据不可用' if market=='CN' else '富途报价读取失败')+'：'+str(result.get('error','未返回数据'))[:110]);continue
    names={c:s for s,c in batch};received=set()
    for r in result.get('data') or []:
     if r.get('code') not in names:continue
     s=names[r['code']];received.add(s)
     rows.append({'symbol':s,'currency':'HKD' if market=='HK' else 'CNY','timezone':'Asia/Hong_Kong' if market=='HK' else 'Asia/Shanghai','quoteAsOf':r.get('update_time'),'price':number(r.get('last_price')),'market_cap':number(r.get('total_market_val')),'pe_ratio':number(r.get('pe_ttm_ratio')),'pb_ratio':number(r.get('pb_ratio'))})
    errors.extend(s+'：富途未返回报价' for s,_ in batch if s not in received)
   except Exception:errors.append('富途连接失败，请检查 Mac 和 OpenD')
   if i+8<len(pairs):time.sleep(3)
 return {'capturedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'rows':rows,'errors':list(dict.fromkeys(errors))}

def main():
 p=argparse.ArgumentParser();p.add_argument('--investment-root',type=Path,required=True);a=p.parse_args();sys.path.insert(0,str(a.investment_root.resolve()))
 b=json.loads(sys.stdin.read(12000));market=b.get('market');symbols=b.get('symbols')
 if market not in {'US','HK','CN'} or not isinstance(symbols,list) or not 0<len(symbols)<=50 or any(not isinstance(s,str) or len(s)>20 for s in symbols):raise ValueError('Invalid request')
 result=fetch(market,symbols);print(json.dumps(result,allow_nan=False))
if __name__=='__main__':main()
