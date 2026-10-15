'use strict';
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {createCookieSession}=require('./cookie-session');
const timestamp=1800000000000;
const TTL=365*86400;
function fixture(initial=[]){
 const cookies=new EventEmitter();let values=initial,flushes=0;
 cookies.get=async()=>values;
 cookies.set=async c=>{
  // Mimic Electron: a set with expirationDate overwrites, without it stays a session cookie.
  const domain=c.domain||new URL(c.url).hostname;
  const idx=values.findIndex(v=>v.name===c.name&&(v.domain||domain)===domain&&v.path===(c.path||'/'));
  const next={...c,domain,hostOnly:!c.domain,session:c.expirationDate===undefined};
  if(idx===-1)values.push(next);else values[idx]=next;
  cookies.emit('changed',{},next,'inserted',false);
 };
 cookies.flushStore=async()=>{flushes++;};
 const manager=createCookieSession({session:{cookies,flushStorageData(){}},url:'https://api-flowercloud.com/clientarea.php',now:()=>timestamp});
 return {manager,cookies,get values(){return values;},replace:v=>{values=v;},get flushes(){return flushes;}};
}
const auth={name:'WHMCSUser',value:'test-only-secret',domain:'api-flowercloud.com',hostOnly:true,path:'/',secure:true,httpOnly:true,session:true,sameSite:'lax'};
const settle=()=>new Promise(r=>setTimeout(r,250));
async function run(){
 // A session cookie gains an explicit expiry so Chromium will persist it.
 const a=fixture([auth]);await a.manager.flush();
 assert.equal(a.values.length,1);
 assert.equal(a.values[0].expirationDate,Math.floor(timestamp/1000)+TTL);
 assert.equal(a.values[0].session,false);
 assert.equal(a.values[0].value,auth.value);
 a.manager.dispose();

 // WHMCS randomises its session cookie name, so the prefix match is what matters.
 const names=fixture(['PHPSESSID','WHMCSUser','WHMCSy551iLvnhYt7','whmcsinstanceid'].map(n=>({...auth,name:n})));
 await names.manager.flush();
 assert(names.values.every(c=>c.expirationDate===Math.floor(timestamp/1000)+TTL));
 names.manager.dispose();

 // Cloudflare and chat-widget cookies must stay session-scoped, not pinned for a year.
 const foreign=fixture([{...auth,name:'cf_clearance'},{...auth,name:'crisp-client/session/abc'},{...auth,name:'tipsMd5'}]);
 await foreign.manager.flush();
 assert(foreign.values.every(c=>c.expirationDate===undefined));
 foreign.manager.dispose();

 // Already-persistent cookies and unrelated names are never rewritten.
 const untouched=fixture([{...auth,expirationDate:999},{...auth,name:'cf_clearance'},{...auth,name:'other',domain:'example.com'}]);
 await untouched.manager.flush();
 assert.equal(untouched.values[0].expirationDate,999);
 assert.equal(untouched.values[1].expirationDate,undefined);
 assert.equal(untouched.values[2].expirationDate,undefined);
 untouched.manager.dispose();

 // Flags survive the rewrite, or the cookie becomes a different cookie.
 const flags=fixture([auth]);await flags.manager.flush();
 assert.equal(flags.values[0].httpOnly,true);
 assert.equal(flags.values[0].secure,true);
 assert.equal(flags.values[0].sameSite,'lax');
 assert.equal(flags.values[0].domain,auth.domain);
 flags.manager.dispose();

 // Our own write re-enters 'changed' but must not loop.
 const loop=fixture([auth]);loop.cookies.on('changed',()=>{});
 await loop.manager.flush();await settle();
 assert.equal(loop.values.length,1);
 loop.manager.dispose();

 // A cookie landing in the store fires 'changed'; the debounced path must pick it up
 // without waiting for an explicit flush.
 const rotation=fixture([auth]);
 rotation.cookies.emit('changed',{},auth,'inserted',false);
 await settle();
 assert.equal(rotation.values[0].expirationDate,Math.floor(timestamp/1000)+TTL);
 rotation.manager.dispose();

 // A server-side rotation to a new session cookie is re-pinned with the new value.
 const rotate=fixture([{...auth,value:'rotated',session:true,expirationDate:undefined}]);
 await rotate.manager.flush();
 assert.equal(rotate.values[0].value,'rotated');
 assert.equal(rotate.values[0].expirationDate,Math.floor(timestamp/1000)+TTL);
 rotate.manager.dispose();

 // Removals and foreign domains are ignored.
 const removed=fixture([auth]);
 removed.cookies.emit('changed',{},auth,'explicit',true);
 await settle();
 assert.equal(removed.values[0].expirationDate,undefined);
 removed.manager.dispose();

 console.log('PASS: session cookies pinned, rotation preserved, flags retained, no rewrite loop');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
