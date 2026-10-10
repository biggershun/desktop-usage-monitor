'use strict';
const {app,BrowserWindow,session,ipcMain,screen,Menu,Tray,nativeImage,shell,safeStorage}=require('electron');
const fs=require('fs'),path=require('path');
const queries={api:fs.readFileSync(path.join(__dirname,'api-query.js'),'utf8'),vpn:fs.readFileSync(path.join(__dirname,'vpn-query.js'),'utf8')};
const {createRefreshController}=require('./refresh-controller');
const {createCookieSession}=require('./cookie-session');
const {WIDTH,COLLAPSED_HEIGHT,clampAnchor,snapAnchor,layout}=require('./geometry');
const configs={api:{name:'To-Tokens',url:'https://totokens.cc/keys',folder:'totokens-monitor',partition:'totokens'},vpn:{name:'FlowerCloud',url:'https://api-flowercloud.com/clientarea.php',folder:'flowercloud-monitor',partition:'flowercloud'}};
const sites={},controllers={},latest={},loading={},ready={},restoreAttempted={},reloadRequested={};
let vpnSession,shuttingDown=false;
let widget,tray,timer,moveTimer,anchor,expanded=false,direction,dragging=false;
const launch=process.env.PORTABLE_EXECUTABLE_FILE||app.getPath('exe');
const positionFile=path.join(app.getPath('userData'),'window-position.json');
if(!app.requestSingleInstanceLock())app.quit();
else {
app.on('second-instance',()=>{widget?.show();updateTray();});
function emit(k,d){if(widget&&!widget.isDestroyed())widget.webContents.send('data',k,d);}
function setLoading(k,value){loading[k]=value;emit(k,{loading:value});}
function updateTray(){if(tray&&widget)tray.setContextMenu(menu());}
function menu(){return Menu.buildFromTemplate([
 {label:widget.isVisible()?'隐藏窗口':'显示窗口',click:()=>{widget.isVisible()?widget.hide():widget.show();updateTray();}},
 {label:'开机启动',type:'checkbox',enabled:app.isPackaged,checked:app.getLoginItemSettings({path:launch}).openAtLogin,click:i=>{app.setLoginItemSettings({openAtLogin:i.checked,path:launch,args:[]});updateTray();}},
 {type:'separator'},...Object.entries(configs).map(([k,c])=>({label:'打开 '+c.name+' 账户',click:()=>sites[k]?.show()})),
 {label:'刷新全部',click:()=>Object.keys(configs).forEach(k=>requestRefresh(k))},{type:'separator'},{label:'退出',click:()=>app.quit()}
]);}
function savePosition(){try{fs.mkdirSync(path.dirname(positionFile),{recursive:true});fs.writeFileSync(positionFile,JSON.stringify({x:anchor.x,y:anchor.y}));}catch{}}
function applyLayout(keepDirection=true){const next=layout(anchor,screen.getDisplayMatching(anchor).workArea,expanded,keepDirection?direction:undefined);anchor=next.anchor;direction=next.direction;widget.webContents.send('layout',next);widget.setBounds(next.bounds);}
function requestRefresh(k,reload=true){if(shuttingDown)return;if(reload&&k==='vpn'&&!controllers[k]?.busy)reloadRequested[k]=true;controllers[k]?.run();}
const tokenFile=path.join(app.getPath('appData'),'totokens-monitor','session.bin');
async function restoreApi(w){if(restoreAttempted.api)return;restoreAttempted.api=true;try{if(!safeStorage.isEncryptionAvailable())return;const stored=JSON.parse(safeStorage.decryptString(fs.readFileSync(tokenFile)));const saved=Object.fromEntries(['auth_token','refresh_token','token_expires_at','auth_user'].filter(k=>typeof stored[k]==='string').map(k=>[k,stored[k]]));await w.webContents.executeJavaScript(`(()=>{if(!localStorage.getItem('auth_token')){const saved=${JSON.stringify(saved)};for(const [key,value]of Object.entries(saved))localStorage.setItem(key,value);}})()`);}catch{}}
function waitForDocument(w,k,url){return new Promise((resolve,reject)=>{
 const wc=w.webContents;let timer;
 const cleanup=()=>{clearTimeout(timer);wc.removeListener('dom-ready',done);wc.removeListener('did-fail-load',fail);};
 const done=()=>{ready[k]=true;cleanup();resolve();};const fail=(_e,code,_description,_url,main)=>{if(main&&code!==-3){cleanup();reject(Error('页面加载失败，请重试'));}};
 wc.on('dom-ready',done);wc.on('did-fail-load',fail);timer=setTimeout(()=>{cleanup();wc.stop();reject(Error('网站加载超时，请重试'));},18000);
 if(url)w.loadURL(url).catch(()=>{});else if(ready[k])done();
});}
app.whenReady().then(async()=>{
 const area=screen.getPrimaryDisplay().workArea;anchor={x:area.x+area.width-WIDTH-8,y:area.y+40,width:WIDTH,height:COLLAPSED_HEIGHT};
 try{const saved=JSON.parse(fs.readFileSync(positionFile,'utf8'));if(Number.isFinite(saved.x)&&Number.isFinite(saved.y))anchor=clampAnchor({...anchor,...saved},screen.getDisplayMatching({...anchor,...saved}).workArea);}catch{}
 widget=new BrowserWindow({...anchor,frame:false,transparent:true,alwaysOnTop:true,resizable:false,skipTaskbar:true,webPreferences:{preload:path.join(__dirname,'preload.js'),sandbox:true,contextIsolation:true}});widget.loadFile('index.html');
 widget.on('system-context-menu',event=>{event.preventDefault();menu().popup({window:widget});});
 // will-move identifies user dragging; setBounds must never update the collapsed anchor.
 widget.on('will-move',(_,bounds)=>{dragging=true;clearTimeout(moveTimer);anchor={x:bounds.x,y:bounds.y+(expanded&&direction==='up'?bounds.height-COLLAPSED_HEIGHT:0),width:WIDTH,height:COLLAPSED_HEIGHT};});
 widget.on('moved',()=>{if(!dragging)return;clearTimeout(moveTimer);moveTimer=setTimeout(()=>{dragging=false;anchor=snapAnchor(anchor,screen.getDisplayMatching(anchor).workArea);applyLayout(false);savePosition();},160);});
 for(const [k,c]of Object.entries(configs)){
  const s=session.fromPath(path.join(app.getPath('appData'),c.folder,'Partitions',c.partition));
  if(k==='vpn'){
   vpnSession=createCookieSession({session:s,file:path.join(app.getPath('appData'),c.folder,'session.bin'),encryption:safeStorage,url:c.url});
   await vpnSession.restore();
  }
  const w=sites[k]=new BrowserWindow({width:1100,height:780,show:false,webPreferences:{session:s,sandbox:true,contextIsolation:true,nodeIntegration:false}});
  w.webContents.setWindowOpenHandler(({url})=>{if(url.startsWith('https://'))shell.openExternal(url);return {action:'deny'};});
  controllers[k]=createRefreshController({
   execute:async()=>{
    if(!ready[k])await waitForDocument(w,k,w.webContents.isLoadingMainFrame()?undefined:c.url);
    if(reloadRequested[k]){reloadRequested[k]=false;const current=w.webContents.getURL();if(!w.isVisible()||current.includes('action=productdetails'))await waitForDocument(w,k,new URL(current).origin===new URL(c.url).origin?current:c.url);}
    if(new URL(w.webContents.getURL()).origin!==new URL(c.url).origin)throw Error('请打开账户，返回 '+c.name+' 页面');
    if(k==='api')await restoreApi(w);
    return w.webContents.executeJavaScript(queries[k]);
   },navigate:target=>{if(new URL(target).origin!==new URL(c.url).origin)throw Error('套餐地址异常');return waitForDocument(w,k,target);},
   onLoading:value=>setLoading(k,value),onTimeout:()=>w.webContents.stop(),
   onData:d=>{if(shuttingDown)return;if(d.auth){try{if(safeStorage.isEncryptionAvailable())fs.writeFileSync(tokenFile,safeStorage.encryptString(JSON.stringify(d.auth)));}catch{}delete d.auth;}if(k==='vpn'&&!d.error)vpnSession.setAuthenticated(!d.login);w.webContents.session.flushStorageData();latest[k]=d.error?{...latest[k],...d}:d;emit(k,d);}
  });
  w.webContents.on('did-start-navigation',(_event,_url,inPlace,isMain)=>{if(isMain&&!inPlace)ready[k]=false;});
  w.webContents.on('dom-ready',()=>{ready[k]=true;if(!controllers[k].busy)requestRefresh(k,false);});
  w.webContents.on('did-fail-load',(_,code,_description,_url,isMain)=>{if(isMain&&code!==-3&&!controllers[k].busy){emit(k,{error:'页面加载失败，请重试或打开账户'});setLoading(k,false);}});
  w.on('close',e=>{if(!app.quitting){e.preventDefault();w.hide();requestRefresh(k,false);}});w.loadURL(c.url).catch(()=>{});requestRefresh(k,false);
 }
 widget.webContents.on('did-finish-load',()=>{applyLayout();for(const k of Object.keys(configs)){if(latest[k])emit(k,latest[k]);emit(k,{loading:!!loading[k]});}});
 const pixels=Buffer.alloc(32*32*4);for(let y=0;y<32;y++)for(let x=0;x<32;x++){const i=(y*32+x)*4;const frame=x>=3&&x<=28&&y>=3&&y<=28&&(x<=5||x>=26||y<=5||y>=26);const bar=x>=9&&x<=12&&y>=13&&y<=22||x>=15&&x<=18&&y>=9&&y<=22||x>=21&&x<=23&&y>=16&&y<=22;if(frame||bar){const c=x<16?[167,220,188]:[139,203,227];pixels[i]=c[2];pixels[i+1]=c[1];pixels[i+2]=c[0];pixels[i+3]=255;}}
 tray=new Tray(nativeImage.createFromBitmap(pixels,{width:32,height:32}).resize({width:16,height:16}));tray.setToolTip('API 余额与 VPN 流量');updateTray();tray.on('double-click',()=>{widget.show();updateTray();});
 timer=setInterval(()=>Object.keys(configs).forEach(k=>requestRefresh(k)),60000);
 screen.on('display-metrics-changed',()=>applyLayout(false));screen.on('display-removed',()=>applyLayout(false));
});
ipcMain.on('expand',(event,value)=>{if(event.sender!==widget?.webContents)return;clearTimeout(moveTimer);dragging=false;expanded=!!value;direction=undefined;applyLayout(false);});
ipcMain.on('action',(event,a,k)=>{if(event.sender!==widget?.webContents||shuttingDown)return;if(a==='menu')menu().popup({window:widget});else if(configs[k]){if(a==='login')sites[k]?.show();if(a==='website')shell.openExternal(configs[k].url);if(a==='refresh')requestRefresh(k);}});
app.on('before-quit',event=>{
 if(app.quitting)return;event.preventDefault();if(shuttingDown)return;shuttingDown=true;
 clearInterval(timer);clearTimeout(moveTimer);if(anchor)savePosition();
 const flush=Promise.allSettled([vpnSession?.flush(),...Object.values(sites).map(w=>w.webContents.session.cookies.flushStore())]);
 const deadline=setTimeout(finish,5000);
 function finish(){if(app.quitting)return;clearTimeout(deadline);vpnSession?.dispose();app.quitting=true;app.quit();}
 flush.then(finish);
});app.on('window-all-closed',()=>app.quit());
}
