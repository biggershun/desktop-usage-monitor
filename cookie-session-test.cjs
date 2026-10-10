'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {EventEmitter}=require('node:events');
const {createCookieSession}=require('./cookie-session');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'usage-monitor-session-'));
const file=path.join(root,'session.bin'),url='https://api-flowercloud.com/clientarea.php';
const timestamp=1800000000000;
const encryption={isEncryptionAvailable:()=>true,encryptString:s=>Buffer.from(s).map(v=>v^93),decryptString:b=>Buffer.from(b).map(v=>v^93).toString()};
function fixture(initial=[]){
 const cookies=new EventEmitter();let values=initial,flushes=0;
 cookies.get=async()=>values;cookies.set=async c=>values.push({...c,domain:c.domain||new URL(c.url).hostname,hostOnly:!c.domain,session:c.expirationDate===undefined});cookies.flushStore=async()=>{flushes++;};
 const manager=createCookieSession({session:{cookies,flushStorageData(){}},file,encryption,url,now:()=>timestamp});
 return {manager,cookies,get values(){return values;},replace:v=>{values=v;},get flushes(){return flushes;}};
}
const auth={name:'WHMCSsession',value:'test-only-secret',domain:'api-flowercloud.com',hostOnly:true,path:'/',secure:true,httpOnly:true,session:true,sameSite:'lax'};
async function run(){
 const a=fixture([auth,{...auth,name:'expired',session:false,expirationDate:timestamp/1000-10},{...auth,name:'other-site',domain:'example.com'}]);
 await a.manager.setAuthenticated(true);await a.manager.flush();a.manager.dispose();
 assert(!fs.readFileSync(file).includes(Buffer.from(auth.value)));assert(a.flushes>0);
 const b=fixture();await b.manager.restore();
 assert.equal(b.values.length,1);assert.equal(b.values[0].value,auth.value);assert.equal(b.values[0].httpOnly,true);assert.equal(b.values[0].session,true);assert.equal(b.values[0].sameSite,'lax');assert.equal(b.values[0].domain,auth.domain);
 b.manager.dispose();
 const fresh=fixture([{...auth,value:'newer-cookie'}]);await fresh.manager.restore();assert.equal(fresh.values.length,1);assert.equal(fresh.values[0].value,'newer-cookie');fresh.manager.dispose();
 const rotation=fixture([auth]);await rotation.manager.setAuthenticated(true);rotation.replace([{...auth,value:'rotated'}]);rotation.cookies.emit('changed',{},auth);await rotation.manager.flush();rotation.manager.dispose();
 const c=fixture();await c.manager.restore();assert.equal(c.values[0].value,'rotated');await c.manager.setAuthenticated(false);assert.equal(fs.existsSync(file),false);c.manager.dispose();
 const logout=fixture();await logout.manager.restore();assert.equal(logout.values.length,0);logout.manager.dispose();
 fs.writeFileSync(file,encryption.encryptString(JSON.stringify({version:1,savedAt:timestamp-8*86400000,cookies:[auth]})));
 const expired=fixture();await expired.manager.restore();assert.equal(expired.values.length,0);expired.manager.dispose();
 fs.writeFileSync(file,'corrupt');const corrupt=fixture();await corrupt.manager.restore();assert.equal(corrupt.values.length,0);corrupt.manager.dispose();
 console.log('PASS: encrypted session restore, cookie rotation, expiry, fresh-cookie preservation and logout');
}
run().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>fs.rmSync(root,{recursive:true,force:true}));
