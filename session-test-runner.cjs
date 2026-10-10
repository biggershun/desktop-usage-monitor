'use strict';
const {spawnSync}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'usage-monitor-electron-session-'));
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
try{
 for(const phase of ['seed','restore']){
  const result=spawnSync(require('electron'),[path.join(__dirname,'session-test.cjs'),phase,root],{env,stdio:'inherit',timeout:30000});
  if(result.error)throw result.error;if(result.status!==0)throw Error('Session '+phase+' failed');
 }
}catch(e){console.error(e);process.exitCode=1;}
finally{fs.rmSync(root,{recursive:true,force:true});}
