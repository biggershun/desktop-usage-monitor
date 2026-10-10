'use strict';
const {app,session,safeStorage}=require('electron');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createCookieSession}=require('./cookie-session');
const [phase,root]=process.argv.slice(2);
app.setPath('userData',path.join(root,'profile'));
app.whenReady().then(async()=>{
 try{
  assert(safeStorage.isEncryptionAvailable());
  const s=session.fromPath(path.join(root,'cookies'));
  const url='https://api-flowercloud.com/';
  const manager=createCookieSession({session:s,file:path.join(root,'session.bin'),encryption:safeStorage,url});
  if(phase==='seed'){
   await s.cookies.set({url,name:'WHMCS-test',value:'test-only-session',secure:true,httpOnly:true,sameSite:'lax'});
   await manager.setAuthenticated(true);await manager.flush();
   assert(!fs.readFileSync(path.join(root,'session.bin')).includes(Buffer.from('test-only-session')));
  }else{
   // Simulate Chromium dropping a session cookie during application shutdown.
   await s.cookies.remove(url,'WHMCS-test');
   await manager.restore();
   const saved=(await s.cookies.get({url,name:'WHMCS-test'}))[0];
   assert.equal(saved.value,'test-only-session');assert(saved.httpOnly);assert(saved.secure);assert(saved.session);assert(saved.hostOnly);assert.equal(saved.sameSite,'lax');
   await manager.setAuthenticated(false);
   assert.equal(fs.existsSync(path.join(root,'session.bin')),false);
  }
  manager.dispose();console.log('PASS: Electron session '+phase);app.exit(0);
 }catch(e){console.error(e);app.exit(1);}
});
