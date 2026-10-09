const assert=require('node:assert/strict'),vm=require('vm'),fs=require('fs');
const {createRefreshController}=require('./refresh-controller');
async function run(){
 const events=[],values=[];let attempts=0,hang=true;
 const c=createRefreshController({execute:async()=>{attempts++;if(hang)return new Promise(()=>{});return {updated:123};},navigate:async()=>{},onData:d=>values.push(d),onLoading:l=>events.push(l),timeoutMs:25});
 await c.run();assert.match(values[0].error,/超时/);assert.equal(c.busy,false);assert.equal(events.at(-1),false);
 hang=false;await c.run();assert.equal(values[1].updated,123);assert.equal(c.busy,false);
 let page=0;const v=[];const n=createRefreshController({execute:async()=>page?{remaining:394.07}:{navigate:'https://example.test/details'},navigate:async()=>{page++},onData:d=>v.push(d),onLoading:()=>{}});await n.run();assert.equal(v[0].remaining,394.07);
 const api=fs.readFileSync('api-query.js','utf8');
 let apiCalls=0;const local=new Map([['auth_token','valid'],['token_expires_at',String(Date.now()+999999)]]);
 const data=await vm.runInNewContext(api,{localStorage:{getItem:k=>local.get(k),setItem:(k,v)=>local.set(k,v)},AbortSignal,Intl,Date,fetch:async url=>{apiCalls++;return {ok:true,status:200,json:async()=>({code:0,data:url.endsWith('/auth/me')?{balance:12.3}:url.includes('/stats')?{total_requests:5}:[]})};}});
 assert.equal(data.user.balance,12.3);assert.equal(apiCalls,4);assert.equal(data.partial,false);
 console.log('PASS: timeout releases loading, retry succeeds, navigation continues, API response queried');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
