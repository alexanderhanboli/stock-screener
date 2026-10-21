"""Import a complete split-adjusted broker benchmark series, never synthetic bars."""
import argparse,datetime as dt,json,math

def normalize(payload):
 if payload.get('source')!='Robinhood MCP' or payload.get('adjustment')!='split':raise ValueError('Unexpected benchmark source')
 closes={r['close']['symbol']:r['close'] for r in payload['quotes']['results'] if r.get('close')}
 rows=[]
 for series in payload['historicals']['results']:
  symbol=series['symbol']
  if symbol not in {'SPY','IVV'}:raise ValueError('Unexpected benchmark')
  bars=[b for b in series['bars'] if b and not b.get('interpolated')]
  if len(bars)<250:continue
  official=closes.get(symbol)
  # A last-day gap must not be filled with just a close; OHLCV remain unknown.
  if not official or official.get('interpolated') or bars[-1]['begins_at'][:10]!=official['date']:continue
  for b in bars:
   row={'symbol':symbol,'date':dt.date.fromisoformat(b['begins_at'][:10]),**{k:float(b[k+'_price']) for k in ['open','high','low','close']},'volume':int(b['volume'])}
   if not all(math.isfinite(row[k]) and row[k]>0 for k in ['open','high','low','close']) or row['volume']<0:raise ValueError('Invalid bar')
   if row['date'].isoformat()==official['date']:row['close']=float(official['price'])
   row['adj_close']=row['close'];rows.append(row)
 if not rows:raise ValueError('No complete non-synthetic benchmark series')
 return rows

def main():
 from app.database import SessionLocal
 from app.models.stock import StockPrice
 from app.scripts._runtime import prepare_runtime
 p=argparse.ArgumentParser();p.add_argument('input');a=p.parse_args();rows=normalize(json.load(open(a.input)));prepare_runtime()
 with SessionLocal() as db:
  for symbol in {r['symbol'] for r in rows}:
   # Replace the whole series so adjustment conventions are never spliced.
   db.query(StockPrice).filter(StockPrice.symbol==symbol).delete(synchronize_session=False)
  db.bulk_insert_mappings(StockPrice,rows);db.commit()
 print(json.dumps({'source':'Robinhood MCP','symbols':sorted({r['symbol'] for r in rows}),'lastDate':max(r['date'] for r in rows).isoformat(),'bars':len(rows)}))
if __name__=='__main__':main()
