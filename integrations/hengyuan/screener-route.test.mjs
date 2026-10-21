import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {screenerRoute,validSymbols,cleanResult} from './screener-route.mjs';
function database(){const db=new DatabaseSync(':memory:');return {prepare(sql){return {bind(...args){this.args=args;return this},async run(){return db.prepare(sql).run(...(this.args||[]))},async first(){return db.prepare(sql).get(...(this.args||[]))}}}}}
const origin='https://private.example',now=new Date().toISOString();
const request=(path,body,user=false)=>new Request(origin+'/api/screener/'+path,{method:'POST',headers:{'Content-Type':'application/json',...(user?{'Origin':origin,'oai-authenticated-user-id':'owner'}:{})},body:JSON.stringify(body)});
test('symbol identity and read bounds',()=>{assert.ok(validSymbols('US',['BRK-B','AAPL']));assert.ok(validSymbols('HK',['0700.HK']));assert.ok(validSymbols('CN',['600519.SS','000001.SZ']));assert.ok(!validSymbols('KR',['AAPL']));assert.ok(!validSymbols('HK',['AAPL']));assert.ok(!validSymbols('US',Array(51).fill('AAPL')))});
test('result removes unexpected private fields and rejects out of scope or invalid data',()=>{const job={market:'US',requested_at:now,symbols:'["AAPL"]'};const result={capturedAt:now,rows:[{symbol:'AAPL',price:2,account:'private',institutional_ownership:66.3}],errors:[]};assert.equal(cleanResult(result,job).rows[0].account,undefined);assert.equal(cleanResult(result,job).scoreRecomputed,false);assert.throws(()=>cleanResult({...result,rows:[{symbol:'FRO'}]},job));assert.throws(()=>cleanResult({...result,rows:[{symbol:'AAPL',insider_ownership:101}]},job))});
test('on demand queue: heartbeat, owner request, claim, result, timeout identity and cross origin',async()=>{const env={DB:database()};assert.equal((await screenerRoute(request('agent',{},true),env)).status,403);const bad=request('request',{market:'US',symbols:['AAPL']},true);bad.headers.set('Origin','https://evil.example');assert.equal((await screenerRoute(bad,env)).status,403);
 assert.equal((await screenerRoute(request('request',{market:'US',symbols:['AAPL']},true),env)).status,503);
 await screenerRoute(request('agent',{claim:false}),env);
 const queued=await (await screenerRoute(request('request',{market:'US',symbols:['AAPL']},true),env)).json();assert.equal(queued.job.state,'pending');
 const claimed=await (await screenerRoute(request('agent',{}),env)).json();assert.equal(claimed.job.id,queued.job.id);
 assert.equal((await (await screenerRoute(request('agent',{}),env)).json()).job,null);
 const r=await screenerRoute(request('result',{id:claimed.job.id,result:{capturedAt:new Date().toISOString(),rows:[{symbol:'AAPL',price:100}],errors:[]}}),env);assert.equal(r.status,200);
 const result=await (await screenerRoute(new Request(origin+'/api/screener/status?market=US'),env)).json();assert.equal(result.job.state,'completed');assert.equal(result.result.rows[0].price,100);
 assert.equal((await screenerRoute(request('result',{id:claimed.job.id,result:{}}),env)).status,409)
});

test('reported institutional ownership above 100 is retained instead of rejecting the batch',()=>{const job={market:'US',requested_at:now,symbols:'["AAPL"]'};const result=cleanResult({capturedAt:now,rows:[{symbol:'AAPL',institutional_ownership:110}],errors:[]},job);assert.equal(result.rows[0].institutional_ownership,110)});
