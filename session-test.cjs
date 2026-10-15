'use strict';
const {app,session}=require('electron');
const assert=require('node:assert/strict'),path=require('node:path');
const {createCookieSession}=require('./cookie-session');
const [phase,root]=process.argv.slice(2);
app.setPath('userData',path.join(root,'profile'));
app.whenReady().then(async()=>{
 try{
  const s=session.fromPath(path.join(root,'cookies'));
  const url='https://api-flowercloud.com/';
  const manager=createCookieSession({session:s,url});
  if(phase==='seed'){
   // A real WHMCS session cookie carries no expiry of its own.
   await s.cookies.set({url,name:'WHMCSUser',value:'test-only-session',secure:true,httpOnly:true,sameSite:'lax'});
   await manager.flush();
   const saved=(await s.cookies.get({url,name:'WHMCSUser'}))[0];
   assert(saved.expirationDate>Date.now()/1000,'cookie must now carry an expiry');
   assert.equal(saved.session,false,'cookie must no longer be a session cookie');
  }else{
   // The partition's own store is the only thing that carried state across the restart.
   const restored=(await s.cookies.get({url,name:'WHMCSUser'}))[0];
   assert(restored,'cookie must survive the restart without any backup file');
   assert.equal(restored.value,'test-only-session');
   assert(restored.httpOnly);assert(restored.secure);assert(restored.hostOnly);
   assert.equal(restored.sameSite,'lax');
   assert.equal(restored.domain,'api-flowercloud.com');
  }
  manager.dispose();console.log('PASS: Electron session '+phase);app.exit(0);
 }catch(e){console.error(e);app.exit(1);}
});
