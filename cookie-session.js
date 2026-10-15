'use strict';
// Chromium drops session cookies (no expirationDate) when the app exits. Rather than
// snapshotting them to a separate file, give each authentication cookie an explicit
// expiry so Chromium persists it in the partition's own cookie store.
// WHMCS randomises its PHP session cookie name (observed: WHMCSy551iLvnhYt7), so match the
// prefix rather than an exact list. cf_clearance and crisp-client* must stay session-scoped.
const AUTH_COOKIES=/^(PHPSESSID|WHMCS)/i;
const TTL=365*86400;

function createCookieSession({session,url,now=Date.now}){
 const host=new URL(url).hostname;
 let pending=Promise.resolve(),timer,disposed=false;
 const belongs=c=>{const domain=c.domain?.replace(/^\./,'');return domain&&(domain===host||host.endsWith('.'+domain));};
 const enqueue=operation=>{pending=pending.then(operation,operation).catch(()=>{});return pending;};
 async function sync(){
  if(disposed)return;
  // Only unexpired session cookies are re-set; anything already carrying an expiry is
  // left alone. This also keeps our own writes from re-entering the cycle below.
  const targets=(await session.cookies.get({})).filter(c=>belongs(c)&&AUTH_COOKIES.test(c.name)&&c.expirationDate===undefined);
  for(const c of targets){
   if(disposed)return;
   const details={url:`${c.secure?'https':'http'}://${c.domain.replace(/^\./,'')}${c.path||'/'}`,name:c.name,value:c.value,path:c.path||'/',secure:!!c.secure,httpOnly:!!c.httpOnly,expirationDate:Math.floor(now()/1000)+TTL};
   if(!c.hostOnly)details.domain=c.domain;
   if(c.sameSite)details.sameSite=c.sameSite;
   await session.cookies.set(details);
  }
  if(targets.length)await session.cookies.flushStore();
 }
 function changed(_event,_cookie,_cause,removed){
  if(disposed||removed)return;
  clearTimeout(timer);timer=setTimeout(()=>enqueue(sync),150);
 }
 session.cookies.on('changed',changed);
 return {
  flush(){clearTimeout(timer);return enqueue(async()=>{await sync();await session.cookies.flushStore();session.flushStorageData();});},
  dispose(){disposed=true;clearTimeout(timer);session.cookies.removeListener('changed',changed);}
 };
}
module.exports={createCookieSession};
