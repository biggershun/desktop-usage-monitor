'use strict';
const fs=require('node:fs'),path=require('node:path');

function createCookieSession({session,file,encryption,url,now=Date.now}){
 const host=new URL(url).hostname;
 let authenticated=false,pending=Promise.resolve(),timer,disposed=false;
 const belongs=c=>{const domain=c.domain?.replace(/^\./,'');return domain&&(domain===host||host.endsWith('.'+domain));};
 const enqueue=operation=>{pending=pending.then(operation,operation).catch(()=>{});return pending;};
 const removeBackup=()=>{try{fs.unlinkSync(file);}catch(e){if(e.code!=='ENOENT')throw e;}};
 async function save(){
  if(!authenticated){removeBackup();return;}
  if(!encryption.isEncryptionAvailable())return;
  const cookies=(await session.cookies.get({})).filter(belongs);
  const data=encryption.encryptString(JSON.stringify({version:1,savedAt:now(),cookies}));
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file+'.tmp',data);fs.renameSync(file+'.tmp',file);
 }
 async function restore(){
  try{
   if(!encryption.isEncryptionAvailable())return;
   const data=JSON.parse(encryption.decryptString(fs.readFileSync(file)));
   if(data.version!==1||!Number.isFinite(data.savedAt)||now()-data.savedAt>7*86400000||!Array.isArray(data.cookies))return;
   const current=await session.cookies.get({});
   for(const c of data.cookies){
    if(!belongs(c)||typeof c.name!=='string'||typeof c.value!=='string')continue;
    if(c.expirationDate!==undefined&&c.expirationDate<=now()/1000)continue;
    if(current.some(v=>v.name===c.name&&v.domain===c.domain&&v.path===c.path))continue;
    const details={url:`${c.secure?'https':'http'}://${c.domain.replace(/^\./,'')}${c.path||'/'}`,name:c.name,value:c.value,path:c.path||'/',secure:!!c.secure,httpOnly:!!c.httpOnly};
    if(!c.hostOnly)details.domain=c.domain;
    if(c.sameSite)details.sameSite=c.sameSite;
    if(!c.session&&c.expirationDate!==undefined)details.expirationDate=c.expirationDate;
    await session.cookies.set(details);
   }
   await session.cookies.flushStore();
  }catch{}
 }
 function changed(_event,c){
  if(disposed||!authenticated||!belongs(c))return;
  clearTimeout(timer);timer=setTimeout(()=>enqueue(save),150);
 }
 session.cookies.on('changed',changed);
 return {
  restore,
  setAuthenticated(value){authenticated=!!value;clearTimeout(timer);return enqueue(save);},
  flush(){clearTimeout(timer);return enqueue(async()=>{await save();await session.cookies.flushStore();session.flushStorageData();});},
  dispose(){disposed=true;clearTimeout(timer);session.cookies.removeListener('changed',changed);}
 };
}
module.exports={createCookieSession};
